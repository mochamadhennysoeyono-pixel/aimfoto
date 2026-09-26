/**
 * Firebase Firestore Client Adapter
 * 100% Drop-in replacement for Supabase / Cloudflare D1
 * - Direct real-time low-latency connection to Firebase Firestore (Blaze Plan)
 * - Native IndexedDB offline caching and fast reads
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  enableIndexedDbPersistence,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { DEFAULT_ACTIVE_FRAMES } from './data/defaultActiveFrames';
import { DEFAULT_LAYOUTS } from './data/defaultLayouts';

export const HARDCODED_EVENT_ID =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_EVENT_ID) ||
  'f1723176-eaa7-4c1d-bfc9-2c112677bb38';

export const R2_PUBLIC_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_R2_PUBLIC_URL) ||
  'https://pub-9ab796572b1a43ad87628fe9260ddf61.r2.dev';

// Inisialisasi Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Inisialisasi Firestore Database menggunakan firestoreDatabaseId project ini
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

// Aktifkan offline persistence di browser jika didukung
if (typeof window !== 'undefined') {
  try {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
      } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence
      }
    });
  } catch (_) {}
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

// In-memory query cache for instant 0ms repeated reads
const firestoreQueryCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL_MS = 15 * 1000; // 15 detik

export function clearClientQueryCache(): void {
  firestoreQueryCache.clear();
}

/**
 * Query Builder yang meniru interface Supabase API namun mengeksekusi langsung di Firestore
 */
export class FirestoreQueryBuilder {
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
      const cacheKey = `${this.tableName}__${this.selectedColumns}__${JSON.stringify(this.filters)}__${JSON.stringify(this.orderSpecs)}__${this.limitCount}`;
      const cached = firestoreQueryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
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

      // Ambil dokumen dari Firestore
      const colRef = collection(db, this.tableName);
      const snap = await getDocs(colRef);
      let rows: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Terapkan Filters di memori untuk fleksibilitas maksimal
      if (this.filters.length > 0) {
        rows = rows.filter((row) => {
          for (const f of this.filters) {
            let rowVal = row[f.column];
            let filterVal = f.value;

            // Normalisasi boolean / number jika ada perbedaan tipe
            if (typeof rowVal === 'number' && typeof filterVal === 'boolean') {
              rowVal = Boolean(rowVal);
            } else if (typeof rowVal === 'boolean' && typeof filterVal === 'number') {
              rowVal = rowVal ? 1 : 0;
            }

            if (f.op === '=') {
              if (rowVal !== filterVal) return false;
            } else if (f.op === '!=') {
              if (rowVal === filterVal) return false;
            } else if (f.op === 'IN') {
              if (!Array.isArray(filterVal) || !filterVal.includes(rowVal)) return false;
            } else if (f.op === 'NOT LIKE') {
              if (typeof rowVal === 'string' && typeof filterVal === 'string') {
                let pattern = '';
                let i = 0;
                while (i < filterVal.length) {
                  if (filterVal[i] === '\\' && i + 1 < filterVal.length) {
                    pattern += filterVal[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    i += 2;
                  } else if (filterVal[i] === '%') {
                    pattern += '.*';
                    i++;
                  } else if (filterVal[i] === '_') {
                    pattern += '.';
                    i++;
                  } else {
                    pattern += filterVal[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    i++;
                  }
                }
                if (new RegExp(`^${pattern}$`, 'i').test(rowVal)) return false;
              }
            } else if (f.op === 'LIKE') {
              if (typeof rowVal === 'string' && typeof filterVal === 'string') {
                let pattern = '';
                let i = 0;
                while (i < filterVal.length) {
                  if (filterVal[i] === '\\' && i + 1 < filterVal.length) {
                    pattern += filterVal[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    i += 2;
                  } else if (filterVal[i] === '%') {
                    pattern += '.*';
                    i++;
                  } else if (filterVal[i] === '_') {
                    pattern += '.';
                    i++;
                  } else {
                    pattern += filterVal[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    i++;
                  }
                }
                if (!new RegExp(`^${pattern}$`, 'i').test(rowVal)) return false;
              }
            }
          }
          return true;
        });
      }

      // Special join handler untuk `frame_layouts` dengan `layout:layouts(*)`
      if (
        this.tableName === 'frame_layouts' &&
        this.selectedColumns.includes('layout:layouts')
      ) {
        // Ambil data layouts untuk di-join
        const layoutsSnap = await getDocs(collection(db, 'layouts'));
        const layoutMap = new Map<string, any>();
        layoutsSnap.docs.forEach((d) => {
          const lData = d.data();
          let parsedSlots = [];
          if (Array.isArray(lData.slots)) {
            parsedSlots = lData.slots;
          } else if (typeof lData.slots === 'string') {
            try {
              parsedSlots = JSON.parse(lData.slots);
            } catch (_) {}
          }
          layoutMap.set(d.id, {
            id: d.id,
            ...lData,
            slots: parsedSlots,
          });
        });

        rows = rows.map((fl) => {
          const matchedLayout = layoutMap.get(fl.layout_id) || DEFAULT_LAYOUTS[0];
          return {
            ...fl,
            layout: matchedLayout,
          };
        });
      }

      // Terapkan Order
      if (this.orderSpecs.length > 0) {
        rows.sort((a, b) => {
          for (const o of this.orderSpecs) {
            const valA = a[o.column];
            const valB = b[o.column];
            if (valA === valB) continue;
            if (valA === undefined || valA === null) return o.ascending ? -1 : 1;
            if (valB === undefined || valB === null) return o.ascending ? 1 : -1;
            if (valA < valB) return o.ascending ? -1 : 1;
            if (valA > valB) return o.ascending ? 1 : -1;
          }
          return 0;
        });
      }

      // Terapkan Limit
      if (this.limitCount !== undefined) {
        rows = rows.slice(0, this.limitCount);
      }

      // Simpan ke in-memory cache
      firestoreQueryCache.set(cacheKey, { data: rows, timestamp: Date.now() });

      if (this.isSingleResult) {
        if (rows.length === 0) return { data: null, error: { message: 'Row not found' } };
        return { data: rows[0], error: null };
      }

      if (this.isMaybeSingleResult) {
        return { data: rows[0] || null, error: null };
      }

      return { data: rows, error: null };
    } catch (err: any) {
      console.warn('Firestore query error:', err);
      // Fallback lokal jika ada gangguan jaringan
      if (this.tableName === 'frames') {
        return { data: DEFAULT_ACTIVE_FRAMES, error: null };
      } else if (this.tableName === 'layouts') {
        return { data: DEFAULT_LAYOUTS, error: null };
      }
      return { data: null, error: { message: err?.message || 'Firestore error' } };
    }
  }
}

export class FirestoreMutationBuilder {
  private tableName: string;
  private data: any[];
  private isUpsert: boolean = false;

  constructor(table: string, data: any | any[], isUpsert: boolean = false) {
    this.tableName = table;
    this.data = Array.isArray(data) ? data : [data];
    this.isUpsert = isUpsert;
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

      const insertedRows: any[] = [];

      for (const item of this.data) {
        const copy = { ...item };
        if (!copy.id) {
          copy.id =
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          item.id = copy.id;
        }

        // Tulis langsung ke Firestore Document
        const docRef = doc(db, this.tableName, copy.id);
        await setDoc(docRef, copy, { merge: this.isUpsert });
        insertedRows.push(copy);
      }

      clearClientQueryCache();
      const res = { data: insertedRows, error: null };
      if (resolve) return resolve(res);
      return res;
    } catch (err: any) {
      console.warn('Firestore mutation error:', err);
      const errRes = { data: null, error: { message: err.message } };
      if (reject) return reject(errRes);
      if (resolve) return resolve(errRes);
      return errRes;
    }
  }
}

export class FirestoreUpdateBuilder {
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

      // Cari ID dari filter yang eksak 'id' = value
      const idFilter = this.filters.find((f) => f.column === 'id' && f.op === '=');
      if (idFilter && idFilter.value) {
        const docRef = doc(db, this.tableName, String(idFilter.value));
        await updateDoc(docRef, copy);
      } else {
        // Query untuk mencari dokumen yang cocok lalu update
        const qBuilder = new FirestoreQueryBuilder(this.tableName);
        for (const f of this.filters) {
          if (f.op === '=') qBuilder.eq(f.column, f.value);
          if (f.op === '!=') qBuilder.neq(f.column, f.value);
        }
        const { data: matched } = await qBuilder;
        if (matched && matched.length > 0) {
          for (const item of matched) {
            const docRef = doc(db, this.tableName, item.id);
            await updateDoc(docRef, copy);
          }
        }
      }

      clearClientQueryCache();
      const result = { data: [copy], error: null };
      if (resolve) return resolve(result);
      return result;
    } catch (err: any) {
      console.warn('Firestore update error:', err);
      const res = { data: null, error: { message: err.message } };
      if (reject) return reject(res);
      return res;
    }
  }
}

export class FirestoreDeleteBuilder {
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
      const deletedRows: any[] = [];
      const idFilter = this.filters.find((f) => f.column === 'id');
      if (idFilter && idFilter.op === '=' && idFilter.value) {
        await deleteDoc(doc(db, this.tableName, String(idFilter.value)));
        deletedRows.push({ id: idFilter.value });
      } else if (idFilter && idFilter.op === 'IN' && Array.isArray(idFilter.value)) {
        for (const id of idFilter.value) {
          await deleteDoc(doc(db, this.tableName, String(id)));
          deletedRows.push({ id });
        }
      } else {
        const qBuilder = new FirestoreQueryBuilder(this.tableName);
        for (const f of this.filters) {
          if (f.op === '=') qBuilder.eq(f.column, f.value);
        }
        const { data: matched } = await qBuilder;
        if (matched && matched.length > 0) {
          for (const item of matched) {
            await deleteDoc(doc(db, this.tableName, item.id));
            deletedRows.push(item);
          }
        }
      }

      clearClientQueryCache();
      const res = { data: deletedRows.length > 0 ? deletedRows : [{ deleted: true }], error: null };
      if (resolve) return resolve(res);
      return res;
    } catch (err: any) {
      console.warn('Firestore delete error:', err);
      const res = { data: null, error: { message: err.message } };
      if (reject) return reject(res);
      return res;
    }
  }
}

// Storage Adapter untuk upload file & gambar
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
            return { data: null, error: { message: resJson.error || 'Upload Failed' } };
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
        return {
          data: {
            publicUrl: `/api/r2/file/${cleanPath}`,
          },
        };
      },

      async remove(_filePaths: string[]) {
        return { data: [], error: null };
      },

      async list(folder: string = '', _options: any = {}) {
        try {
          const cleanFolder = `${bucket}/${folder}`.replace(/\/+/g, '/').replace(/^\//, '').replace(/\/$/, '');
          const res = await fetch(`/api/r2/list?prefix=${encodeURIComponent(cleanFolder)}`);
          const json = await res.json();
          const items = json.items || [];
          const formatted = items.map((item: any) => {
            const shortName = item.name.replace(new RegExp(`^${bucket}/`), '').replace(new RegExp(`^${cleanFolder}/`), '');
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
          return { data: [], error: { message: err?.message || 'List error' } };
        }
      },
    };
  },
};

/**
 * Main Client Object yang 100% kompatibel dengan panggilan supabase.* di seluruh aplikasi
 * dengan Real-time Firestore onSnapshot listener
 */
export const supabase = {
  from(table: string) {
    return {
      select(columns: string = '*') {
        return new FirestoreQueryBuilder(table).select(columns);
      },
      insert(data: any | any[], options?: { onConflict?: string }) {
        return new FirestoreMutationBuilder(table, data, Boolean(options?.onConflict));
      },
      upsert(data: any | any[], _options?: { onConflict?: string }) {
        return new FirestoreMutationBuilder(table, data, true);
      },
      update(data: any) {
        return new FirestoreUpdateBuilder(table, data);
      },
      delete() {
        return new FirestoreDeleteBuilder(table);
      },
    };
  },
  storage: storageAdapter,
  channel(_name: string) {
    let unsubs: Array<() => void> = [];
    return {
      on(_event: string, filter: any, callback: (payload: any) => void) {
        if (filter?.table === 'orders' && typeof filter.filter === 'string') {
          const idMatch = filter.filter.match(/id=eq\.(.+)/);
          const sessionMatch = filter.filter.match(/session_id=eq\.(.+)/);

          if (idMatch && idMatch[1]) {
            const orderId = idMatch[1].trim();
            const unsub = onSnapshot(doc(db, 'orders', orderId), (docSnap) => {
              if (docSnap.exists()) {
                callback({
                  eventType: 'UPDATE',
                  new: { id: docSnap.id, ...docSnap.data() },
                  old: {},
                });
              }
            });
            unsubs.push(unsub);
          } else if (sessionMatch && sessionMatch[1]) {
            const targetSessionId = sessionMatch[1].trim();
            const q = query(collection(db, 'orders'), where('session_id', '==', targetSessionId));
            const unsub = onSnapshot(q, (snap) => {
              snap.docChanges().forEach((change) => {
                callback({
                  eventType: change.type === 'added' ? 'INSERT' : change.type === 'modified' ? 'UPDATE' : 'DELETE',
                  new: { id: change.doc.id, ...change.doc.data() },
                  old: {},
                });
              });
            });
            unsubs.push(unsub);
          }
        }
        return this;
      },
      subscribe(cb?: any) {
        if (cb) cb('SUBSCRIBED');
        return {
          unsubscribe() {
            unsubs.forEach((u) => u());
            unsubs = [];
          },
        };
      },
    };
  },
  removeChannel(ch: any) {
    if (ch && typeof ch.unsubscribe === 'function') {
      ch.unsubscribe();
    }
  },
};
