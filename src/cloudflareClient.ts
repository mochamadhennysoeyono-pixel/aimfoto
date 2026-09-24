/**
 * Cloudflare D1 & R2 Client Adapter
 * 100% Drop-in replacement for Supabase
 * - Database queries executed directly on Cloudflare D1
 * - File uploads/downloads stored on Cloudflare R2 with ZERO egress fees
 */

import { DEFAULT_ACTIVE_FRAMES } from './data/defaultActiveFrames';
import { DEFAULT_LAYOUTS } from './data/defaultLayouts';

export const HARDCODED_EVENT_ID =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EVENT_ID) ||
  'f1723176-eaa7-4c1d-bfc9-2c112677bb38';

export const R2_PUBLIC_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_R2_PUBLIC_URL) ||
  'https://pub-9ab796572b1a43ad87628fe9260ddf61.r2.dev';

// Client-side in-memory query cache for SELECT statements
interface ClientCacheEntry {
  data: any[];
  timestamp: number;
}
const clientQueryCache = new Map<string, ClientCacheEntry>();
const CLIENT_CACHE_TTL_MS = 30 * 1000; // 30 detik

export function clearClientQueryCache(): void {
  clientQueryCache.clear();
}

interface QueryFilter {
  column: string;
  op: '=' | '!=' | 'IN' | 'IS NULL' | 'IS NOT NULL' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'NOT LIKE';
  value: any;
}

interface OrderSpec {
  column: string;
  ascending: boolean;
}

export class D1QueryBuilder {
  private tableName: string;
  private selectedColumns: string = '*';
  private filters: QueryFilter[] = [];
  private orderSpecs: OrderSpec[] = [];
  private limitCount?: number;
  private isSingleResult: boolean = false;
  private isMaybeSingleResult: boolean = false;

  constructor(table: string) {
    this.tableName = table;
  }

  select(columns: string = '*') {
    this.selectedColumns = columns;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, op: '=', value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ column, op: '!=', value });
    return this;
  }

  not(column: string, operator: string, value: any) {
    if (operator.toLowerCase() === 'like') {
      this.filters.push({ column, op: 'NOT LIKE', value });
    } else if (operator === 'eq' || operator === '=') {
      this.filters.push({ column, op: '!=', value });
    } else {
      this.filters.push({ column, op: '!=', value });
    }
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ column, op: 'IN', value: values });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderSpecs.push({
      column,
      ascending: options.ascending !== false,
    });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingleResult = true;
    this.limitCount = 1;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingleResult = true;
    this.limitCount = 1;
    return this;
  }

  // Thenable to allow `await supabase.from(table).select(...)`
  async then(resolve?: (val: any) => any, reject?: (err: any) => any): Promise<any> {
    try {
      const result = await this.execute();
      if (resolve) return resolve(result);
      return result;
    } catch (err) {
      if (reject) return reject(err);
      return { data: null, error: err };
    }
  }

  private async execute(): Promise<{ data: any; error: any }> {
    try {
      const params: any[] = [];
      let sql = '';

      // Special join handler for `frame_layouts` with `layout:layouts(*)`
      if (
        this.tableName === 'frame_layouts' &&
        this.selectedColumns.includes('layout:layouts')
      ) {
        sql = `
          SELECT 
            fl.*,
            l.id AS _l_id,
            l.name AS _l_name,
            l.photo_count AS _l_photo_count,
            l.slots AS _l_slots,
            l.ratio AS _l_ratio,
            l.canvas_width AS _l_canvas_width,
            l.canvas_height AS _l_canvas_height,
            l.is_active AS _l_is_active,
            l.created_at AS _l_created_at
          FROM frame_layouts fl
          LEFT JOIN layouts l ON fl.layout_id = l.id
        `;
      } else {
        sql = `SELECT * FROM ${this.tableName}`;
      }

      // WHERE clause
      if (this.filters.length > 0) {
        const whereClauses: string[] = [];
        for (const f of this.filters) {
          if (f.op === 'IN') {
            const placeholders = f.value.map(() => '?').join(', ');
            whereClauses.push(`${f.column} IN (${placeholders})`);
            const normalizedIn = f.value.map((v: any) => typeof v === 'boolean' ? (v ? 1 : 0) : v);
            params.push(...normalizedIn);
          } else if (f.value === null) {
            whereClauses.push(`${f.column} IS NULL`);
          } else {
            whereClauses.push(`${f.column} ${f.op} ?`);
            const normalizedVal = typeof f.value === 'boolean' ? (f.value ? 1 : 0) : f.value;
            params.push(normalizedVal);
          }
        }
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      // ORDER BY clause
      if (this.orderSpecs.length > 0) {
        const orderClauses = this.orderSpecs.map(
          (o) => `${o.column} ${o.ascending ? 'ASC' : 'DESC'}`
        );
        sql += ` ORDER BY ${orderClauses.join(', ')}`;
      }

      // LIMIT clause
      if (this.limitCount !== undefined) {
        sql += ` LIMIT ${this.limitCount}`;
      }

      const cacheKey = `${sql.trim()}__${JSON.stringify(params || [])}`;

      // Cek client in-memory cache
      const cached = clientQueryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS) {
        let rows = cached.data;
        if (this.isSingleResult) {
          if (rows.length === 0) return { data: null, error: { message: 'Row not found' } };
          return { data: rows[0], error: null };
        }
        if (this.isMaybeSingleResult) {
          return { data: rows[0] || null, error: null };
        }
        return { data: rows, error: null };
      }

      let resJson: any = null;
      try {
        const response = await fetch('/api/d1/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, params }),
        });
        resJson = await response.json();
      } catch (fetchErr: any) {
        resJson = { success: false, error: fetchErr.message || 'Network error' };
      }

      if (!resJson || !resJson.success) {
        const errMsg = String(resJson?.error || '');
        const isQuotaLimit =
          resJson?.isD1Limit ||
          errMsg.includes("exceeded D1's free tier daily row read limit") ||
          errMsg.includes('daily row read limit');

        // Jika terkena kuota limit atau error jaringan, kita berikan fallback data ril
        if (isQuotaLimit || !resJson) {
          console.warn('⚠️ Cloudflare D1 rate limit / error, menggunakan data fallback lokal untuk:', this.tableName);
          let fallbackRows: any[] = [];

          if (this.tableName === 'frames') {
            fallbackRows = DEFAULT_ACTIVE_FRAMES.map((item, idx) => {
              const f = item.frame || (item as any);
              return {
                id: item.frame_id || item.id,
                name: f.name || `Frame ${idx + 1}`,
                event_id: f.event_id || HARDCODED_EVENT_ID,
                image_url: item.image_url,
                sort_order: f.sort_order ?? (idx + 1),
                is_active: 1,
                category: item.category || 'Umum',
                created_at: '2026-09-24 10:00:00',
              };
            });
          } else if (this.tableName === 'layouts') {
            fallbackRows = DEFAULT_LAYOUTS.map((l) => ({
              id: l.id,
              name: l.name,
              photo_count: l.photo_count,
              slots: JSON.stringify(l.slots),
              is_active: 1,
              ratio: l.ratio || '2:3',
              canvas_width: l.canvas_width || 1200,
              canvas_height: l.canvas_height || 1800,
            }));
          } else if (this.tableName === 'frame_layouts') {
            fallbackRows = DEFAULT_ACTIVE_FRAMES.map((item) => ({
              id: item.id,
              frame_id: item.frame_id || item.id,
              layout_id: item.layout_id || item.layout?.id || DEFAULT_LAYOUTS[0].id,
              image_url: item.image_url,
              category: item.category || 'Umum',
              layout: item.layout,
            }));
          } else if (this.tableName === 'events') {
            fallbackRows = [
              {
                id: HARDCODED_EVENT_ID,
                name: 'AIM Photobooth',
                is_active: 1,
                is_default: 1,
                default_price: 10000,
                price: 10000,
                created_at: new Date().toISOString(),
                qr_code: HARDCODED_EVENT_ID,
              },
            ];
          }

          if (fallbackRows.length > 0) {
            if (this.isSingleResult) return { data: fallbackRows[0], error: null };
            if (this.isMaybeSingleResult) return { data: fallbackRows[0] || null, error: null };
            return { data: fallbackRows, error: null };
          }
        }

        return { data: null, error: { message: resJson?.error || 'D1 Query Error' } };
      }

      let rows: any[] = resJson.data || [];

      // Transform frame_layouts joined rows
      if (
        this.tableName === 'frame_layouts' &&
        this.selectedColumns.includes('layout:layouts')
      ) {
        rows = rows.map((row: any) => {
          let layoutObj = null;
          if (row._l_id) {
            let parsedSlots = [];
            try {
              parsedSlots =
                typeof row._l_slots === 'string'
                  ? JSON.parse(row._l_slots)
                  : row._l_slots || [];
            } catch (_) {}

            layoutObj = {
              id: row._l_id,
              name: row._l_name,
              photo_count: row._l_photo_count || (parsedSlots ? parsedSlots.length : 3),
              ratio: row._l_ratio || '2:3',
              canvas_width: row._l_canvas_width || 1200,
              canvas_height: row._l_canvas_height || 1800,
              slots: parsedSlots,
              is_active: Boolean(row._l_is_active),
              created_at: row._l_created_at,
            };
          }
          const {
            _l_id,
            _l_name,
            _l_photo_count,
            _l_slots,
            _l_ratio,
            _l_canvas_width,
            _l_canvas_height,
            _l_is_active,
            _l_created_at,
            ...rest
          } = row;
          return {
            ...rest,
            layout: layoutObj,
          };
        });
      }

      // Convert SQLite integer booleans for boolean-known columns
      rows = rows.map((r: any) => {
        const copy = { ...r };
        if (typeof copy.is_active === 'number') copy.is_active = Boolean(copy.is_active);
        if (typeof copy.free_mode === 'number') copy.free_mode = Boolean(copy.free_mode);
        if (copy.slots && typeof copy.slots === 'string') {
          try {
            copy.slots = JSON.parse(copy.slots);
          } catch (_) {}
        }
        return copy;
      });

      // Simpan ke in-memory cache jika query berhasil
      clientQueryCache.set(cacheKey, {
        data: rows,
        timestamp: Date.now(),
      });

      if (this.isSingleResult) {
        if (rows.length === 0) {
          return { data: null, error: { message: 'Row not found' } };
        }
        return { data: rows[0], error: null };
      }

      if (this.isMaybeSingleResult) {
        return { data: rows[0] || null, error: null };
      }

      return { data: rows, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Fetch failed' } };
    }
  }

  // INSERT
  insert(data: any | any[]) {
    return new D1InsertBuilder(this.tableName, data, false);
  }

  // UPSERT
  upsert(data: any | any[], options: { onConflict?: string } = {}) {
    return new D1InsertBuilder(this.tableName, data, true, options.onConflict);
  }

  // UPDATE
  update(data: any) {
    return new D1UpdateBuilder(this.tableName, data);
  }

  // DELETE
  delete() {
    return new D1DeleteBuilder(this.tableName);
  }
}

export class D1InsertBuilder {
  private tableName: string;
  private data: any[];
  private isUpsert: boolean;
  private conflictCol: string;

  constructor(table: string, data: any | any[], isUpsert = false, conflictCol = 'id') {
    this.tableName = table;
    this.data = Array.isArray(data) ? data : [data];
    this.isUpsert = isUpsert;
    this.conflictCol = conflictCol;
  }

  select(_cols: string = '*') {
    return this;
  }

  async then(resolve?: (val: any) => any, reject?: (err: any) => any): Promise<any> {
    try {
      if (this.data.length === 0) {
        const res = { data: [], error: null };
        if (resolve) return resolve(res);
        return res;
      }

      for (const item of this.data) {
        const copy = { ...item };
        if (!copy.id && ['layouts', 'frame_layouts', 'frames', 'events', 'orders', 'sessions'].includes(this.tableName)) {
          const generatedId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (`id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
          copy.id = generatedId;
          item.id = generatedId;
        }
        if (this.tableName === 'events' && 'default_price' in copy && !('price' in copy)) {
          copy.price = copy.default_price;
          delete copy.default_price;
        }
        Object.keys(copy).forEach((k) => {
          if (typeof copy[k] === 'boolean') {
            copy[k] = copy[k] ? 1 : 0;
          } else if (typeof copy[k] === 'object' && copy[k] !== null) {
            copy[k] = JSON.stringify(copy[k]);
          }
        });

        const columns = Object.keys(copy);
        const placeholders = columns.map(() => '?').join(', ');
        const params = Object.values(copy);

        let sql = '';
        if (this.isUpsert) {
          const updateAssignments = columns
            .filter((c) => c !== this.conflictCol)
            .map((c) => `${c} = excluded.${c}`)
            .join(', ');

          sql = `
            INSERT INTO ${this.tableName} (${columns.join(', ')}) 
            VALUES (${placeholders})
            ON CONFLICT (${this.conflictCol}) DO UPDATE SET ${updateAssignments || `${this.conflictCol}=${this.conflictCol}`}
          `;
        } else {
          sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        }

        const response = await fetch('/api/d1/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sql, params }),
        });

        const resJson = await response.json();
        if (!resJson.success) {
          const errRes = { data: null, error: { message: resJson.error || 'D1 Insert Error' } };
          if (resolve) return resolve(errRes);
          return errRes;
        }
      }

      clearClientQueryCache();
      const res = { data: this.data, error: null };
      if (resolve) return resolve(res);
      return res;
    } catch (err: any) {
      const errRes = { data: null, error: { message: err.message } };
      if (reject) return reject(errRes);
      if (resolve) return resolve(errRes);
      return errRes;
    }
  }
}

export class D1UpdateBuilder {
  private tableName: string;
  private updateData: any;
  private filters: QueryFilter[] = [];

  constructor(table: string, data: any) {
    this.tableName = table;
    this.updateData = data;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, op: '=', value });
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push({ column, op: '!=', value });
    return this;
  }

  select(_cols: string = '*') {
    return this;
  }

  async then(resolve?: (val: any) => any, reject?: (err: any) => any): Promise<any> {
    try {
      const copy = { ...this.updateData };
      if (this.tableName === 'events' && 'default_price' in copy && !('price' in copy)) {
        copy.price = copy.default_price;
      }
      Object.keys(copy).forEach((k) => {
        if (typeof copy[k] === 'boolean') {
          copy[k] = copy[k] ? 1 : 0;
        } else if (typeof copy[k] === 'object' && copy[k] !== null) {
          copy[k] = JSON.stringify(copy[k]);
        }
      });

      const setClauses: string[] = [];
      const params: any[] = [];

      Object.entries(copy).forEach(([col, val]) => {
        setClauses.push(`${col} = ?`);
        params.push(val);
      });

      let sql = `UPDATE ${this.tableName} SET ${setClauses.join(', ')}`;

      if (this.filters.length > 0) {
        const whereClauses: string[] = [];
        for (const f of this.filters) {
          whereClauses.push(`${f.column} ${f.op} ?`);
          const normalizedVal = typeof f.value === 'boolean' ? (f.value ? 1 : 0) : f.value;
          params.push(normalizedVal);
        }
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      const response = await fetch('/api/d1/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, params }),
      });

      const resJson = await response.json();
      if (resJson.success) clearClientQueryCache();
      const result = resJson.success
        ? { data: [copy], error: null }
        : { data: null, error: { message: resJson.error } };

      if (resolve) return resolve(result);
      return result;
    } catch (err: any) {
      const res = { data: null, error: { message: err.message } };
      if (reject) return reject(res);
      return res;
    }
  }
}

export class D1DeleteBuilder {
  private tableName: string;
  private filters: QueryFilter[] = [];

  constructor(table: string) {
    this.tableName = table;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, op: '=', value });
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push({ column, op: 'IN', value: values });
    return this;
  }

  select(_cols: string = '*') {
    return this;
  }

  async then(resolve?: (val: any) => any, reject?: (err: any) => any): Promise<any> {
    try {
      const params: any[] = [];
      let sql = `DELETE FROM ${this.tableName}`;

      if (this.filters.length > 0) {
        const whereClauses = this.filters.map((f) => {
          if (f.op === 'IN') {
            const placeholders = f.value.map(() => '?').join(', ');
            params.push(...f.value.map((v: any) => (typeof v === 'boolean' ? (v ? 1 : 0) : v)));
            return `${f.column} IN (${placeholders})`;
          } else {
            const normalizedVal = typeof f.value === 'boolean' ? (f.value ? 1 : 0) : f.value;
            params.push(normalizedVal);
            return `${f.column} ${f.op} ?`;
          }
        });
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      const response = await fetch('/api/d1/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, params }),
      });

      const resJson = await response.json();
      if (resJson.success) clearClientQueryCache();
      const result = resJson.success
        ? { data: [{ id: 'deleted' }], error: null }
        : { data: null, error: { message: resJson.error } };

      if (resolve) return resolve(result);
      return result;
    } catch (err: any) {
      const res = { data: null, error: { message: err.message } };
      if (reject) return reject(res);
      return res;
    }
  }
}

// Storage Adapter for Cloudflare R2
const storageAdapter = {
  from(bucket: string) {
    return {
      async upload(
        filePath: string,
        file: File | Blob | string,
        options: { contentType?: string; upsert?: boolean } = {}
      ) {
        try {
          const cleanPath = `${bucket}/${filePath}`.replace(/\/+/g, '/').replace(/^\//, '');
          let dataUrl = '';

          if (typeof file === 'string') {
            dataUrl = file;
          } else {
            dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          }

          const response = await fetch('/api/r2/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: cleanPath,
              dataUrl,
              contentType: options.contentType || (file instanceof Blob ? file.type : 'image/jpeg'),
            }),
          });

          const resJson = await response.json();
          if (!resJson.success) {
            return { data: null, error: { message: resJson.error || 'R2 Upload Failed' } };
          }

          return {
            data: { path: cleanPath, publicUrl: resJson.publicUrl || `/api/r2/file/${cleanPath}` },
            error: null,
          };
        } catch (err: any) {
          return { data: null, error: { message: err.message || 'Upload error' } };
        }
      },

      getPublicUrl(filePath: string) {
        const cleanPath = `${bucket}/${filePath}`.replace(/\/+/g, '/').replace(/^\//, '');
        // Prefer same-origin endpoint to prevent ISP DNS issues and eliminate CORS
        return {
          data: {
            publicUrl: `/api/r2/file/${cleanPath}`,
          },
        };
      },

      async remove(filePaths: string[]) {
        try {
          const paths = filePaths.map((p) => {
            const clean = String(p).replace(/^\/+/, '');
            // Jika path sudah diawali bucket name, jangan diduplikasi
            if (clean.startsWith(`${bucket}/`)) return clean;
            return `${bucket}/${clean}`.replace(/\/+/g, '/');
          });
          const response = await fetch('/api/r2/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths }),
          });
          const resJson = await response.json();
          return { data: resJson.results, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },

      async list(pathPrefix?: string, options?: { limit?: number; search?: string }) {
        try {
          const rawPrefix = pathPrefix ? `${bucket}/${pathPrefix}`.replace(/\/+/g, '/').replace(/^\//, '') : bucket;
          const searchParam = options?.search ? `&search=${encodeURIComponent(options.search)}` : '';
          const limitParam = options?.limit ? `&limit=${options.limit}` : '';
          const response = await fetch(`/api/r2/list?prefix=${encodeURIComponent(rawPrefix)}${searchParam}${limitParam}`);
          const resJson = await response.json();
          if (!resJson.success) {
            return { data: [], error: { message: resJson.error || 'Failed to list files' } };
          }
          let items = resJson.objects || [];
          if (options?.search) {
            const query = options.search.toLowerCase();
            items = items.filter((item: any) => item.name.toLowerCase().includes(query));
          }
          // Kembalikan objek dengan properti nama file yang ramah Supabase
          const formatted = items.map((item: any) => {
            const shortName = item.name.replace(new RegExp(`^${bucket}/`), '').replace(new RegExp(`^${pathPrefix}/`), '');
            return {
              name: shortName,
              id: item.name,
              metadata: item.metadata,
              created_at: item.created_at,
              updated_at: item.updated_at,
            };
          });
          return { data: formatted, error: null };
        } catch (err: any) {
          return { data: [], error: { message: err.message } };
        }
      },
    };
  },
};

/**
 * Universal client instance that mimics `supabase`
 */
export const cloudflareClient = {
  from(table: string) {
    return new D1QueryBuilder(table);
  },
  storage: storageAdapter,
  channel(_name: string) {
    return {
      on(_event: string, _filter: any, _callback: any) {
        return this;
      },
      subscribe(_callback?: any) {
        return {
          unsubscribe() {},
        };
      },
    };
  },
  removeChannel(_channel: any) {},
};

// Aliased as supabase for zero-refactor backward compatibility
export const supabase = cloudflareClient;
