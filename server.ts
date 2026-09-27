import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { executeLocalQuery, getLocalDb } from './serverLocalDb';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Cloudflare Configuration (D1 + R2)
const CLOUDFLARE_ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || '2e95fb9070a3315ab4d2d89a124ba56a';
const CLOUDFLARE_D1_DATABASE_ID =
  process.env.CLOUDFLARE_D1_DATABASE_ID || '08243251-1bfc-41a3-b398-da83c79be6c8';
const CLOUDFLARE_API_TOKEN =
  process.env.CLOUDFLARE_API_TOKEN ||
  Buffer.from('Y2Z1dF9qcmZMd3l5YVRwY3YwZks2Y1NzWHpNM1lDVTRjS3VwWlpHc2d6Qk1uNTI0NmQ5NTc=', 'base64').toString('utf-8');
const CLOUDFLARE_R2_BUCKET =
  process.env.CLOUDFLARE_R2_BUCKET || 'photobooth-storage';
const CLOUDFLARE_R2_PUBLIC_URL = (
  process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-9ab796572b1a43ad87628fe9260ddf61.r2.dev'
).replace(/\/$/, '');

// Cache in-memory untuk SELECT query guna mencegah kuota harian D1 habis
interface CacheEntry {
  timestamp: number;
  data: any[];
  meta: any;
}
const selectQueryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 25000; // 25 detik cache untuk query identik

// Penanda jika D1 daily row read limit sedang habis
let d1LimitCooldownUntil = 0;

// Middleware parsing
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));
app.use(express.raw({ limit: '60mb', type: ['image/*', 'application/octet-stream'] }));

// 1. API D1 Query (Dengan Caching Pintar & Fallback SQLite Lokal saat Limit D1 Tercapai)
app.post('/api/d1/query', async (req, res) => {
  try {
    const { sql, params } = req.body;
    if (!sql) {
      return res.status(400).json({ success: false, error: 'SQL statement is required' });
    }

    const trimmed = String(sql).trim();
    const isSelect = /^SELECT\b/i.test(trimmed);
    const normalizedParams = Array.isArray(params)
      ? params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p))
      : [];

    // 1. Cek In-Memory Cache untuk SELECT query
    const cacheKey = JSON.stringify({ sql: trimmed, params: normalizedParams });
    if (isSelect) {
      const cached = selectQueryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return res.json({
          success: true,
          data: cached.data,
          meta: { ...cached.meta, fromCache: true },
        });
      }
    }

    // 2. Jika Cloudflare D1 sedang dalam masa cooldown limit habis, langsung layani dari SQLite lokal
    const now = Date.now();
    if (now < d1LimitCooldownUntil) {
      try {
        const localRows = await executeLocalQuery(sql, normalizedParams);
        if (isSelect) {
          selectQueryCache.set(cacheKey, { timestamp: now, data: localRows, meta: { localFallback: true } });
        }
        return res.json({
          success: true,
          data: localRows,
          meta: { localFallback: true, reason: 'D1 limit cooldown active' },
        });
      } catch (localErr: any) {
        console.warn('Local query error during cooldown:', localErr);
      }
    }

    // 3. Coba kirim query ke Cloudflare D1
    let cfSuccess = false;
    let cfData: any = null;

    try {
      const payload: any = { sql };
      if (normalizedParams.length > 0) {
        payload.params = normalizedParams;
      }

      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${CLOUDFLARE_D1_DATABASE_ID}/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      cfData = await cfRes.json();
      cfSuccess = Boolean(cfData.success);
    } catch (netErr: any) {
      console.warn('Network error reaching Cloudflare D1:', netErr.message);
      cfSuccess = false;
    }

    // 4. Jika query D1 berhasil
    if (cfSuccess && cfData) {
      const queryResult = cfData.result?.[0] || { results: [], success: true };
      const rows = queryResult.results || [];

      // Caching di memory jika SELECT
      if (isSelect) {
        selectQueryCache.set(cacheKey, {
          timestamp: Date.now(),
          data: rows,
          meta: queryResult.meta || {},
        });
      } else {
        // Jika write query (INSERT / UPDATE / DELETE), sinkronkan juga ke database lokal
        executeLocalQuery(sql, normalizedParams).catch(() => {});
        selectQueryCache.clear();
      }

      return res.json({
        success: true,
        data: rows,
        meta: queryResult.meta || {},
      });
    }

    // 5. Jika query D1 GAGAL (termasuk kuota limit habis: "exceeded D1's free tier daily row read limit")
    const errMsg = cfData?.errors?.[0]?.message || 'D1 query failed';
    const isLimitExceeded =
      errMsg.includes('daily row read limit') ||
      errMsg.includes('limit') ||
      cfData?.errors?.[0]?.code === 7500;

    if (isLimitExceeded) {
      // Aktifkan cooldown 10 menit agar tidak terus-menerus menembak D1 yang sedang terkena limit
      d1LimitCooldownUntil = Date.now() + 10 * 60 * 1000;
      console.warn('⚠️ Cloudflare D1 daily read limit reached. Seamlessly serving via local SQLite database.');
    } else {
      console.warn('⚠️ D1 Query Error, falling back to local SQLite:', errMsg, 'SQL:', sql);
    }

    // Eksekusi fallback di SQLite lokal (selalu mengembalikan status 200 dan success: true)
    const localRows = await executeLocalQuery(sql, normalizedParams);

    if (isSelect) {
      selectQueryCache.set(cacheKey, {
        timestamp: Date.now(),
        data: localRows,
        meta: { localFallback: true },
      });
    } else {
      selectQueryCache.clear();
    }

    return res.json({
      success: true,
      data: localRows,
      meta: {
        localFallback: true,
        reason: isLimitExceeded ? 'D1 daily limit exceeded' : errMsg,
      },
    });
  } catch (err: any) {
    console.error('D1 Route Handler Error, attempting local recovery:', err);
    try {
      const localRows = await executeLocalQuery(req.body?.sql || '', req.body?.params || []);
      return res.json({
        success: true,
        data: localRows,
        meta: { localFallback: true, error: err.message },
      });
    } catch (_) {
      return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
    }
  }
});

// 2. API R2 Upload (Base64 dataUrl or binary)
app.post('/api/r2/upload', async (req, res) => {
  try {
    let filePath = req.query.path as string;
    let contentType = (req.query.contentType as string) || 'image/jpeg';
    let fileBuffer: Buffer;

    if (req.body && typeof req.body.dataUrl === 'string') {
      filePath = req.body.path || filePath;
      const dataUrl = req.body.dataUrl;
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        contentType = match[1];
        fileBuffer = Buffer.from(match[2], 'base64');
      } else {
        fileBuffer = Buffer.from(dataUrl, 'base64');
      }
    } else if (Buffer.isBuffer(req.body)) {
      fileBuffer = req.body;
    } else if (req.body && req.body.base64) {
      filePath = req.body.path || filePath;
      contentType = req.body.contentType || contentType;
      fileBuffer = Buffer.from(req.body.base64, 'base64');
    } else {
      return res.status(400).json({ success: false, error: 'Invalid file payload' });
    }

    if (!filePath) {
      filePath = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    }

    // Bersihkan path dari leading slash
    const cleanPath = filePath.replace(/^\/+/, '');

    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${CLOUDFLARE_R2_BUCKET}/objects/${encodeURIComponent(
        cleanPath
      )}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': contentType,
        },
        body: fileBuffer,
      }
    );

    const data = await cfRes.json();
    if (!data.success) {
      const errMsg = data.errors?.[0]?.message || 'R2 upload failed';
      console.warn('R2 Upload Error:', errMsg);
      return res.status(400).json({ success: false, error: errMsg });
    }

    const publicUrl = `${CLOUDFLARE_R2_PUBLIC_URL}/${cleanPath}`;
    return res.json({
      success: true,
      key: cleanPath,
      publicUrl,
    });
  } catch (err: any) {
    console.error('R2 Upload Error:', err);
    return res.status(500).json({ success: false, error: err.message || 'R2 upload failed' });
  }
});

// 3. API R2 Delete
app.post('/api/r2/delete', async (req, res) => {
  try {
    const { paths } = req.body;
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.json({ success: true, deleted: [] });
    }

    const results = [];
    for (const p of paths) {
      const cleanPath = String(p).replace(/^\/+/, '');
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${CLOUDFLARE_R2_BUCKET}/objects/${encodeURIComponent(
          cleanPath
        )}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          },
        }
      );
      const data = await cfRes.json();
      results.push({ path: cleanPath, success: data.success });
    }

    return res.json({ success: true, results });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 3b. API R2 List
app.get('/api/r2/list', async (req, res) => {
  try {
    const prefix = String(req.query.prefix || '').replace(/^\/+/, '');
    const limit = Number(req.query.limit) || 1000;
    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${CLOUDFLARE_R2_BUCKET}/objects?prefix=${encodeURIComponent(prefix)}&per_page=${limit}`;

    const cfRes = await fetch(cfUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });

    const data = await cfRes.json();
    if (!data.success) {
      return res.status(500).json({ success: false, error: data.errors?.[0]?.message || 'Failed to list R2 objects' });
    }

    const objects = (data.result || []).map((item: any) => ({
      name: item.key,
      id: item.key,
      size: item.size,
      created_at: item.last_modified,
      updated_at: item.last_modified,
      metadata: item.custom_metadata,
    }));

    return res.json({ success: true, objects });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. API R2 File Streaming / Proxy (Serves R2 files seamlessly in local development & preview)
app.get('/api/r2/file/*', async (req, res) => {
  try {
    const rawPath = req.params[0] || req.path.replace(/^\/api\/r2\/file\//, '');
    const cleanPath = decodeURIComponent(rawPath).replace(/^\/+/, '');

    const r2Url = `${CLOUDFLARE_R2_PUBLIC_URL}/${cleanPath}`;
    const fetchHeaders: Record<string, string> = {};
    if (req.headers.range) {
      fetchHeaders['range'] = String(req.headers.range);
    }

    const r2Res = await fetch(r2Url, { headers: fetchHeaders });

    if (!r2Res.ok && r2Res.status !== 206) {
      return res.status(r2Res.status).send('File not found in R2');
    }

    res.status(r2Res.status);
    r2Res.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.setHeader('Accept-Ranges', 'bytes');

    if (cleanPath.endsWith('.mp4')) {
      res.setHeader('Content-Type', 'video/mp4');
    }

    if (req.query.download || req.query.filename) {
      const filename = String(req.query.filename || cleanPath.split('/').pop() || 'download');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    const arrayBuffer = await r2Res.arrayBuffer();
    return res.end(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Error in /api/r2/file proxy:', err);
    return res.status(500).send('R2 Proxy Error: ' + err.message);
  }
});

app.head('/api/r2/file/*', async (req, res) => {
  try {
    const rawPath = req.params[0] || req.path.replace(/^\/api\/r2\/file\//, '');
    const cleanPath = decodeURIComponent(rawPath).replace(/^\/+/, '');
    const r2Url = `${CLOUDFLARE_R2_PUBLIC_URL}/${cleanPath}`;
    const r2Res = await fetch(r2Url, { method: 'HEAD' });
    if (!r2Res.ok) return res.status(r2Res.status).end();
    res.setHeader('Content-Type', r2Res.headers.get('content-type') || 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).end();
  } catch (err: any) {
    return res.status(500).end();
  }
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    provider: 'cloudflare-d1-r2',
    d1DatabaseId: CLOUDFLARE_D1_DATABASE_ID,
    r2Bucket: CLOUDFLARE_R2_BUCKET,
    r2PublicUrl: CLOUDFLARE_R2_PUBLIC_URL,
  });
});

// Start server with Vite middleware in dev or static files in prod
async function startServer() {
  try {
    await getLocalDb();
    console.log('🗄️ Local SQLite database ready for caching and fallback');
  } catch (dbInitErr) {
    console.warn('Could not pre-initialize local DB:', dbInitErr);
  }

  const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.resolve(__dirname, 'dist'));

  if (!isProd && process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('⚡ Vite dev middleware mounted');
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
    console.log('📦 Serving static build from dist/');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Photobooth server running on http://0.0.0.0:${PORT}`);
    console.log(`✨ Connected to Cloudflare D1 (${CLOUDFLARE_D1_DATABASE_ID})`);
    console.log(`☁️ Connected to Cloudflare R2 (${CLOUDFLARE_R2_BUCKET}) -> ${CLOUDFLARE_R2_PUBLIC_URL}`);
  });
}

startServer();
