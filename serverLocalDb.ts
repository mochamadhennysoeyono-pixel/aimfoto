import fs from 'fs';
import path from 'path';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'local_d1.sqlite');

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let saveTimeout: NodeJS.Timeout | null = null;

// R2 Public URL for frame fallback assets
const R2_PUBLIC_URL = (
  process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-9ab796572b1a43ad87628fe9260ddf61.r2.dev'
).replace(/\/$/, '');

// Known R2 Frame assets uploaded by user
const R2_FRAME_KEYS = [
  'photobooth-frames/frames/1790227165354_a04c1a5d.png',
  'photobooth-frames/frames/1790227260554_0e3ab5c0.png',
  'photobooth-frames/frames/1790227292382_32e39b8d.png',
  'photobooth-frames/frames/1790227328069_9fc96872.png',
  'photobooth-frames/frames/1790227348541_18c28903.png',
  'photobooth-frames/frames/1790227400368_05dec599.png',
  'photobooth-frames/frames/1790227470476_d50d8bc5.png',
  'photobooth-frames/frames/1790227512010_22f2f6a6.png',
  'photobooth-frames/frames/1790227537702_e1a74e0b.png',
  'photobooth-frames/frames/1790227568373_7a0e067b.png',
  'photobooth-frames/frames/1790227601223_ed30d2dd.png',
  'photobooth-frames/frames/1790227625924_3bfcdae1.png',
  'photobooth-frames/frames/1790227674134_35f19a4d.png',
  'photobooth-frames/frames/1790227719394_46ed44e7.png',
  'photobooth-frames/frames/1790244218449_df8ba651.png',
  'photobooth-frames/frames/1790244262773_272973e1.png',
  'photobooth-frames/frames/1790244285075_881d33c7.png',
  'photobooth-frames/frames/1790246307991_d9e869ac.png',
  'photobooth-frames/frames/1790246327057_913e8e35.png',
  'photobooth-frames/frames/1790246352664_31afe75e.png',
  'photobooth-frames/frames/1790246374547_19132e6a.png',
  'photobooth-frames/frames/1790246392927_3ef1f99a.png',
];

export async function getLocalDb(): Promise<Database> {
  if (db) return db;

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
      console.log('📦 Loaded existing local SQLite database from', DB_FILE);
      return db;
    } catch (e) {
      console.warn('⚠️ Error loading existing SQLite file, creating fresh DB:', e);
    }
  }

  db = new SQL.Database();
  initSchemaAndSeed(db);
  saveLocalDbSync();
  console.log('✨ Initialized fresh local SQLite database at', DB_FILE);
  return db;
}

export function saveLocalDbSync(): void {
  if (!db) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to save local SQLite DB to disk:', err);
  }
}

function scheduleSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveLocalDbSync();
  }, 500);
}

function initSchemaAndSeed(database: Database): void {
  // Create schema matching Cloudflare D1 tables
  database.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      date TEXT,
      location TEXT,
      qr_code TEXT,
      is_active INTEGER DEFAULT 1,
      is_default INTEGER DEFAULT 0,
      price REAL DEFAULT 25000,
      default_price REAL DEFAULT 25000,
      free_mode INTEGER DEFAULT 0,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS layouts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      photo_count INTEGER NOT NULL DEFAULT 3,
      slots TEXT NOT NULL,
      ratio TEXT DEFAULT '1:3',
      canvas_width INTEGER DEFAULT 600,
      canvas_height INTEGER DEFAULT 1800,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS frames (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      name TEXT NOT NULL,
      image_url TEXT,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS frame_layouts (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      frame_id TEXT,
      layout_id TEXT,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      event_id TEXT,
      amount REAL,
      status TEXT,
      payment_method TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      frame_layout_id TEXT,
      status TEXT,
      photos TEXT,
      video_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      url TEXT,
      slot_index INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed default event: AIM SPACE Studio
  const defaultEventId = 'f1723176-eaa7-4c1d-bfc9-2c112677bb38';
  database.run(
    `
    INSERT OR REPLACE INTO events (
      id, name, subtitle, description, date, location, qr_code, is_active, is_default, price, default_price, free_mode, metadata, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, 1, 1, 25000, 25000, 0, ?, datetime('now')
    )
  `,
    [
      defaultEventId,
      'AIM SPACE Studio',
      'Photobooth Rumahan & Event — Abadikan Momen Spesial Berkualitas Tinggi',
      'Hasil foto tajam resolusi tinggi 300 DPI, pencahayaan optimal, & cetak instan!',
      new Date().toISOString().slice(0, 10),
      'AIM SPACE Studio',
      'AIM-SPACE-MAIN',
      JSON.stringify({
        hargaDigital: 10000,
        hargaPrint: 25000,
        lokasi: 'AIM SPACE Studio',
        promoBadge: 'Promo Spesial Studio Rumahan',
        promoDescription: 'Hasil foto tajam resolusi tinggi 300 DPI, pencahayaan optimal, & cetak instan!',
        adminWhatsapp: '6282228031995',
      }),
    ]
  );

  // Seed Layouts
  const layoutStrip3 = 'b1000000-0000-0000-0000-000000000001';
  const layoutStrip4 = 'b1000000-0000-0000-0000-000000000002';
  const layoutGrid4 = 'b1000000-0000-0000-0000-000000000003';
  const layoutPortrait1 = 'b1000000-0000-0000-0000-000000000004';

  const slotsStrip3 = JSON.stringify([
    { index: 0, x: 7.33, y: 2.44, width: 85.33, height: 21.33 },
    { index: 1, x: 7.33, y: 24.89, width: 85.33, height: 21.33 },
    { index: 2, x: 7.33, y: 47.33, width: 85.33, height: 21.33 },
  ]);

  const slotsStrip4 = JSON.stringify([
    { index: 0, x: 7.33, y: 2.0, width: 85.33, height: 18.5 },
    { index: 1, x: 7.33, y: 21.5, width: 85.33, height: 18.5 },
    { index: 2, x: 7.33, y: 41.0, width: 85.33, height: 18.5 },
    { index: 3, x: 7.33, y: 60.5, width: 85.33, height: 18.5 },
  ]);

  const slotsGrid4 = JSON.stringify([
    { index: 0, x: 4.0, y: 3.1, width: 44.67, height: 34.58 },
    { index: 1, x: 51.33, y: 3.1, width: 44.67, height: 34.58 },
    { index: 2, x: 4.0, y: 39.74, width: 44.67, height: 34.58 },
    { index: 3, x: 51.33, y: 39.74, width: 44.67, height: 34.58 },
  ]);

  const slotsPortrait1 = JSON.stringify([
    { index: 0, x: 4.44, y: 3.56, width: 91.11, height: 78.52 },
  ]);

  database.run(
    `INSERT OR REPLACE INTO layouts (id, name, photo_count, slots, ratio, canvas_width, canvas_height, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [layoutStrip3, 'Strip 3 Foto (Layout 1)', 3, slotsStrip3, '1:3', 600, 1800]
  );
  database.run(
    `INSERT OR REPLACE INTO layouts (id, name, photo_count, slots, ratio, canvas_width, canvas_height, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [layoutStrip4, 'Strip 4 Foto (Layout 2)', 4, slotsStrip4, '3:10', 600, 2000]
  );
  database.run(
    `INSERT OR REPLACE INTO layouts (id, name, photo_count, slots, ratio, canvas_width, canvas_height, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [layoutGrid4, 'Grid 4 Foto (Layout 3)', 4, slotsGrid4, '3:4', 1200, 1550]
  );
  database.run(
    `INSERT OR REPLACE INTO layouts (id, name, photo_count, slots, ratio, canvas_width, canvas_height, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [layoutPortrait1, 'Single Portrait (Layout 4)', 1, slotsPortrait1, '4:5', 1080, 1350]
  );

  // Seed Frames & Frame Layouts from R2
  R2_FRAME_KEYS.forEach((key, idx) => {
    const frameId = `r2-frame-${idx + 1}`;
    const flId = `r2-fl-${idx + 1}`;
    const frameUrl = `/api/r2/file/${key}`;
    const frameName = `Frame Estetik #${idx + 1}`;

    // Alternate between layouts based on index
    const layoutId =
      idx % 3 === 0
        ? layoutStrip3
        : idx % 3 === 1
        ? layoutStrip4
        : layoutGrid4;

    database.run(
      `INSERT OR REPLACE INTO frames (id, event_id, name, image_url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, 1)`,
      [frameId, defaultEventId, frameName, frameUrl, idx]
    );

    database.run(
      `INSERT OR REPLACE INTO frame_layouts (id, event_id, frame_id, layout_id, image_url, is_active) VALUES (?, ?, ?, ?, ?, 1)`,
      [flId, defaultEventId, frameId, layoutId, frameUrl]
    );
  });
}

export async function executeLocalQuery(sql: string, params: any[] = []): Promise<any[]> {
  const database = await getLocalDb();

  const trimmed = sql.trim();
  const isSelect = /^SELECT\b/i.test(trimmed);

  // Normalisasi query LIKE / NOT LIKE yang memiliki escape underscore tapi tanpa klausa ESCAPE
  let normalizedSql = sql;
  const normalizedParams = Array.isArray(params) ? [...params] : [];

  if (
    normalizedSql.includes('NOT LIKE ?') &&
    !normalizedSql.toUpperCase().includes('ESCAPE')
  ) {
    // Tambahkan ESCAPE '\' pada NOT LIKE ? agar '\_\_%' tidak memfilter nama string biasa
    normalizedSql = normalizedSql.replace(
      /(\w+)\s+NOT\s+LIKE\s+\?/gi,
      "$1 NOT LIKE ? ESCAPE '\\'"
    );
  }

  // Normalisasi params jika ada boolean atau wildcard __% yang dimaksudkan literal
  for (let i = 0; i < normalizedParams.length; i++) {
    if (typeof normalizedParams[i] === 'boolean') {
      normalizedParams[i] = normalizedParams[i] ? 1 : 0;
    } else if (normalizedParams[i] === '__%') {
      // User bermaksud memfilter event internal yang diawali dua underscore (bukan semua string >= 2 huruf)
      normalizedParams[i] = '\\_\\_%';
      if (!normalizedSql.toUpperCase().includes('ESCAPE')) {
        normalizedSql = normalizedSql.replace(
          /NOT\s+LIKE\s+\?/gi,
          "NOT LIKE ? ESCAPE '\\'"
        );
      }
    }
  }

  if (isSelect) {
    try {
      const stmt = database.prepare(normalizedSql);
      if (normalizedParams.length > 0) {
        stmt.bind(normalizedParams);
      }
      const rows: any[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } catch (err: any) {
      console.warn('⚠️ local SQLite SELECT failed:', err.message, 'SQL:', normalizedSql);
      // Coba fallback dengan query original jika normalisasi error
      try {
        const stmt = database.prepare(sql);
        if (params && params.length > 0) stmt.bind(params);
        const rows: any[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      } catch (_) {
        return [];
      }
    }
  } else {
    // INSERT / UPDATE / DELETE / UPSERT
    try {
      database.run(normalizedSql, normalizedParams);
      scheduleSave();
      return [];
    } catch (err: any) {
      console.warn('⚠️ local SQLite write failed:', err.message, 'SQL:', normalizedSql);
      try {
        database.run(sql, params);
        scheduleSave();
        return [];
      } catch (_) {
        return [];
      }
    }
  }
}
