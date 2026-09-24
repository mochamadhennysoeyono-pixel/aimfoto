/**
 * Cloudflare Worker with Static Assets
 * Handles /api/* endpoints with Native D1 (env.DB) and Native R2 (env.STORAGE)
 * All other routes fall through to static assets in ./dist via env.ASSETS
 */

interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  R2_PUBLIC_URL?: string;
  CLOUDFLARE_R2_PUBLIC_URL?: string;
  [key: string]: any;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface CacheEntry {
  data: any[];
  meta: any;
  expiresAt: number;
}
const workerQueryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 60 detik

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 1. Health check
    if (url.pathname === '/api/health' && request.method === 'GET') {
      const hasD1 = Boolean(env.DB);
      const hasR2 = Boolean(env.STORAGE);
      return new Response(
        JSON.stringify({
          status: 'ok',
          provider: 'cloudflare-worker-assets',
          timestamp: new Date().toISOString(),
          bindings: {
            d1_database: hasD1 ? 'bound' : 'missing',
            r2_storage: hasR2 ? 'bound' : 'missing',
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. D1 Query
    if (url.pathname === '/api/d1/query' && request.method === 'POST') {
      try {
        if (!env.DB) {
          return new Response(
            JSON.stringify({ success: false, error: 'D1 binding "DB" is not bound.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = (await request.json()) as { sql?: string; params?: any[] };
        const { sql, params } = body;

        if (!sql || typeof sql !== 'string') {
          return new Response(
            JSON.stringify({ success: false, error: 'SQL query string is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let stmt = env.DB.prepare(sql);
        if (Array.isArray(params) && params.length > 0) {
          const normalizedParams = params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p));
          stmt = stmt.bind(...normalizedParams);
        }

        const trimmedSql = sql.trim().toUpperCase();
        const isSelect = trimmedSql.startsWith('SELECT') || trimmedSql.startsWith('PRAGMA');
        const cacheKey = `${sql.trim()}__${JSON.stringify(params || [])}`;

        if (isSelect) {
          const cached = workerQueryCache.get(cacheKey);
          if (cached && Date.now() < cached.expiresAt) {
            return new Response(
              JSON.stringify({
                success: true,
                data: cached.data,
                meta: cached.meta,
                cached: true,
              }),
              {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json',
                  'X-Cache': 'HIT',
                  'Cache-Control': 'public, max-age=60',
                },
              }
            );
          }
        } else {
          workerQueryCache.clear();
        }

        if (isSelect) {
          try {
            const queryResult = await stmt.all();
            const results = queryResult.results || [];
            const meta = queryResult.meta || {};

            workerQueryCache.set(cacheKey, {
              data: results,
              meta,
              expiresAt: Date.now() + CACHE_TTL_MS,
            });

            return new Response(
              JSON.stringify({
                success: true,
                data: results,
                meta,
              }),
              {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json',
                  'X-Cache': 'MISS',
                  'Cache-Control': 'public, max-age=60',
                },
              }
            );
          } catch (selErr: any) {
            const errMsg = String(selErr?.message || '');
            const isLimit =
              errMsg.includes("exceeded D1's free tier daily row read limit") ||
              errMsg.includes('daily row read limit') ||
              errMsg.includes('D1_ERROR') ||
              errMsg.includes('midnight UTC');

            const stale = workerQueryCache.get(cacheKey);
            if (stale && isLimit) {
              return new Response(
                JSON.stringify({
                  success: true,
                  data: stale.data,
                  meta: stale.meta,
                  cached: true,
                  stale: true,
                  d1LimitReached: true,
                }),
                {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
              );
            }

            return new Response(
              JSON.stringify({ success: false, isD1Limit: isLimit, error: errMsg }),
              { status: isLimit ? 429 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          const runResult = await stmt.run();
          return new Response(
            JSON.stringify({
              success: true,
              data: [runResult],
              meta: runResult.meta || {},
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (err: any) {
        const errMsg = String(err?.message || 'D1 Query Error');
        const isLimit =
          errMsg.includes("exceeded D1's free tier daily row read limit") ||
          errMsg.includes('daily row read limit') ||
          errMsg.includes('D1_ERROR') ||
          errMsg.includes('midnight UTC');

        return new Response(
          JSON.stringify({ success: false, isD1Limit: isLimit, error: errMsg }),
          { status: isLimit ? 429 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. R2 Upload
    if (url.pathname === '/api/r2/upload' && request.method === 'POST') {
      try {
        if (!env.STORAGE) {
          return new Response(
            JSON.stringify({ success: false, error: 'R2 binding "STORAGE" is not bound.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let filePath = url.searchParams.get('path') || '';
        let contentType = url.searchParams.get('contentType') || 'image/jpeg';
        let fileBuffer: ArrayBuffer | Uint8Array;

        const requestContentType = request.headers.get('content-type') || '';

        if (requestContentType.includes('application/json')) {
          const body = (await request.json()) as any;
          if (body && typeof body.dataUrl === 'string') {
            filePath = body.path || filePath;
            const dataUrl = body.dataUrl;
            const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              contentType = match[1];
              fileBuffer = base64ToUint8Array(match[2]);
            } else {
              fileBuffer = base64ToUint8Array(dataUrl);
            }
          } else if (body && body.base64) {
            filePath = body.path || filePath;
            contentType = body.contentType || contentType;
            fileBuffer = base64ToUint8Array(body.base64);
          } else {
            return new Response(
              JSON.stringify({ success: false, error: 'Invalid JSON file payload.' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          fileBuffer = await request.arrayBuffer();
        }

        if (!filePath) {
          filePath = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        }

        const cleanPath = filePath.replace(/^\/+/, '');
        await env.STORAGE.put(cleanPath, fileBuffer, {
          httpMetadata: { contentType },
        });

        const publicUrlBase =
          env.R2_PUBLIC_URL ||
          env.CLOUDFLARE_R2_PUBLIC_URL ||
          'https://pub-9ab796572b1a43ad87628fe9260ddf61.r2.dev';

        const publicUrl = `${publicUrlBase.replace(/\/+$/, '')}/${cleanPath}`;

        return new Response(
          JSON.stringify({ success: true, key: cleanPath, publicUrl }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, error: err.message || 'R2 Upload Error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. R2 Delete
    if (url.pathname === '/api/r2/delete' && request.method === 'POST') {
      try {
        if (!env.STORAGE) {
          return new Response(
            JSON.stringify({ success: false, error: 'R2 binding "STORAGE" is not bound.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = (await request.json()) as { paths?: string[] };
        const { paths } = body;

        if (!Array.isArray(paths) || paths.length === 0) {
          return new Response(JSON.stringify({ success: true, results: [] }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const results = [];
        for (const p of paths) {
          const cleanPath = String(p).replace(/^\/+/, '');
          await env.STORAGE.delete(cleanPath);
          results.push({ path: cleanPath, success: true });
        }

        return new Response(JSON.stringify({ success: true, results }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, error: err.message || 'R2 Delete Error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4.0b R2 List
    if (url.pathname === '/api/r2/list' && request.method === 'GET') {
      try {
        if (!env.STORAGE) {
          return new Response(
            JSON.stringify({ success: false, error: 'R2 binding "STORAGE" is not bound.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const prefix = (url.searchParams.get('prefix') || '').replace(/^\/+/, '');
        const limit = Number(url.searchParams.get('limit')) || 1000;
        const listed = await (env.STORAGE as any).list({ prefix, limit });

        const objects = (listed.objects || []).map((item: any) => ({
          name: item.key,
          id: item.key,
          size: item.size,
          created_at: item.uploaded,
          updated_at: item.uploaded,
          metadata: item.customMetadata,
        }));

        return new Response(JSON.stringify({ success: true, objects }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, error: err.message || 'R2 List Error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4.1 R2 File Proxy / Direct Serving (bypasses ISP blocks, guarantees 100% same-domain access, supports Range & Downloads)
    if (url.pathname.startsWith('/api/r2/file/') && (request.method === 'GET' || request.method === 'HEAD')) {
      try {
        if (!env.STORAGE) {
          return new Response('R2 binding not configured', { status: 500, headers: corsHeaders });
        }
        const filePath = decodeURIComponent(url.pathname.replace('/api/r2/file/', '')).replace(/^\/+/, '');
        const rangeHeader = request.headers.get('Range');

        const object = await (env.STORAGE as any).get(filePath, {
          range: rangeHeader ? request.headers : undefined,
          onlyIf: request.headers,
        });

        if (!object) {
          return new Response('File Not Found in R2 Storage', { status: 404, headers: corsHeaders });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        // Pastikan Content-Type akurat untuk video dan gambar
        if (filePath.endsWith('.mp4')) {
          headers.set('Content-Type', 'video/mp4');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          headers.set('Content-Type', 'image/jpeg');
        } else if (filePath.endsWith('.png')) {
          headers.set('Content-Type', 'image/png');
        } else if (filePath.endsWith('.webp')) {
          headers.set('Content-Type', 'image/webp');
        }

        let status = 200;
        if (object.range) {
          status = 206;
          const { offset, length } = object.range;
          headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
          headers.set('Content-Length', `${length}`);
        } else {
          headers.set('Content-Length', `${object.size}`);
        }

        const isDownload = url.searchParams.has('download');
        const customFilename = url.searchParams.get('filename');
        if (isDownload || customFilename) {
          const dlName = customFilename || filePath.split('/').pop() || 'download';
          headers.set('Content-Disposition', `attachment; filename="${dlName}"`);
        } else {
          headers.set('Content-Disposition', 'inline');
        }

        return new Response(request.method === 'HEAD' ? null : object.body, { status, headers });
      } catch (err: any) {
        return new Response('Storage Error: ' + err.message, { status: 500, headers: corsHeaders });
      }
    }

    // 5. Frontend SPA & Static Assets Fallback
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      // If it's a browser page route without file extension (e.g. /admin, /select-frame, /),
      // directly serve root index HTML so React Router handles routing seamlessly with 0 error
      if (!url.pathname.includes('.') && request.method === 'GET') {
        const rootResponse = await env.ASSETS.fetch(new Request(new URL('/', request.url), request));
        if (rootResponse.status === 200) {
          return new Response(rootResponse.body, {
            status: 200,
            headers: {
              ...Object.fromEntries(rootResponse.headers.entries()),
              'Content-Type': 'text/html; charset=utf-8',
            },
          });
        }
      }

      // Static assets (.js, .css, images, icons, fonts)
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status === 404 && request.method === 'GET') {
        return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
      }
      return assetResponse;
    }

    return new Response('Not Found', { status: 404 });
  },
};
