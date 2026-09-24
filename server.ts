import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

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

// Middleware parsing
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));
app.use(express.raw({ limit: '60mb', type: ['image/*', 'application/octet-stream'] }));

// 1. API D1 Query
app.post('/api/d1/query', async (req, res) => {
  try {
    const { sql, params } = req.body;
    if (!sql) {
      return res.status(400).json({ success: false, error: 'SQL statement is required' });
    }

    const payload: any = { sql };
    if (Array.isArray(params) && params.length > 0) {
      payload.params = params.map((p) => (typeof p === 'boolean' ? (p ? 1 : 0) : p));
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

    const data = await cfRes.json();
    if (!data.success) {
      const errMsg = data.errors?.[0]?.message || 'D1 query failed';
      console.warn('D1 Query Error:', errMsg, 'SQL:', sql);
      return res.status(400).json({ success: false, error: errMsg, errors: data.errors });
    }

    const queryResult = data.result?.[0] || { results: [], success: true };
    return res.json({
      success: true,
      data: queryResult.results || [],
      meta: queryResult.meta || {},
    });
  } catch (err: any) {
    console.error('D1 Route Handler Error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
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
