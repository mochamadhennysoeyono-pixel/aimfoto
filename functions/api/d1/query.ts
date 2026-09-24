/**
 * Cloudflare Pages Function: D1 Query API
 * Replaces REST API calls to api.cloudflare.com/.../d1/database/.../query
 * Uses Native D1 Binding: context.env.DB
 */

interface Env {
  DB: D1Database;
  [key: string]: any;
}

interface CacheEntry {
  data: any[];
  meta: any;
  expiresAt: number;
}

// In-memory query cache across Worker invocations on the same isolate
const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // Cache SELECT queries selama 60 detik

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  try {
    const { request, env } = context;

    if (!env.DB) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'D1 binding "DB" is not bound. Please configure D1 binding in Cloudflare Pages Settings -> Functions.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body = (await request.json()) as { sql?: string; params?: any[] };
    const { sql, params } = body;

    if (!sql || typeof sql !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'SQL query string is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const trimmedSql = sql.trim().toUpperCase();
    const isSelect = trimmedSql.startsWith('SELECT') || trimmedSql.startsWith('PRAGMA');
    const cacheKey = `${sql.trim()}__${JSON.stringify(params || [])}`;

    // 1. Jika SELECT, cek in-memory cache untuk hemat kuota D1 read
    if (isSelect) {
      const cached = queryCache.get(cacheKey);
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
              'X-D1-Cache': 'HIT',
              'Cache-Control': 'public, max-age=60',
            },
          }
        );
      }
    } else {
      // Jika INSERT/UPDATE/DELETE, invalidate cache agar data terbaru langsung terbaca
      queryCache.clear();
    }

    let stmt = env.DB.prepare(sql);
    if (Array.isArray(params) && params.length > 0) {
      stmt = stmt.bind(...params);
    }

    if (isSelect) {
      try {
        const queryResult = await stmt.all();
        const results = queryResult.results || [];
        const meta = queryResult.meta || {};

        // Simpan ke in-memory cache
        queryCache.set(cacheKey, {
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
              'X-D1-Cache': 'MISS',
              'Cache-Control': 'public, max-age=60',
            },
          }
        );
      } catch (selectErr: any) {
        const errMsg = String(selectErr?.message || '');
        const isQuotaExceeded =
          errMsg.includes("exceeded D1's free tier daily row read limit") ||
          errMsg.includes('daily row read limit') ||
          errMsg.includes('D1_ERROR') ||
          errMsg.includes('midnight UTC');

        // Jika terkena limit kuota D1 dan kita punya stale cache di memory, berikan stale cache
        const staleCached = queryCache.get(cacheKey);
        if (staleCached && isQuotaExceeded) {
          return new Response(
            JSON.stringify({
              success: true,
              data: staleCached.data,
              meta: staleCached.meta,
              cached: true,
              stale: true,
              d1LimitReached: true,
            }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'X-D1-Cache': 'STALE_FALLBACK',
              },
            }
          );
        }

        return new Response(
          JSON.stringify({
            success: false,
            isD1Limit: isQuotaExceeded,
            error: errMsg,
          }),
          {
            status: isQuotaExceeded ? 429 : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
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
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (err: any) {
    const errMsg = String(err?.message || 'Internal D1 Query Execution Error');
    const isQuotaExceeded =
      errMsg.includes("exceeded D1's free tier daily row read limit") ||
      errMsg.includes('daily row read limit') ||
      errMsg.includes('D1_ERROR') ||
      errMsg.includes('midnight UTC');

    return new Response(
      JSON.stringify({
        success: false,
        isD1Limit: isQuotaExceeded,
        error: errMsg,
      }),
      {
        status: isQuotaExceeded ? 429 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};
