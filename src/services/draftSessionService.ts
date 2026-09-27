/**
 * IndexedDB Service untuk menyimpan dan mengembalikan Draf Sesi Photobooth lokal (Client-Side)
 * Menyimpan foto hasil jepretan, frame yang dipilih, layout, boomerang, dan progres slot
 */

const DB_NAME = 'aimspace_photobooth_drafts_db';
const DB_VERSION = 1;
const STORE_NAME = 'saved_sessions';

export interface SavedDraftSession {
  id: string; // Session ID
  savedAt: string; // ISO date
  eventName?: string;
  eventId?: string;
  targetPhotoCount: number;
  capturedPhotos: string[];
  capturedBoomerangs?: (string | null)[];
  slotBoomerangConfig?: Record<number, boolean>;
  slotAssignments?: { [slotIndex: number]: string };
  selectedTheme?: any;
  selectedFrameLayout?: any;
  frameDipilih?: string;
  frame_layout_id?: string;
  layout?: any;
  filterDipilih?: string;
  currentStep?: string;
  photoCount: number;
  previewThumbnail?: string; // First photo as thumbnail
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB tidak didukung pada browser ini'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };

    request.onsuccess = (e: any) => {
      resolve(e.target.result);
    };

    request.onerror = (e: any) => {
      reject(e.target.error);
    };
  });
}

/**
 * Simpan atau perbarui draf sesi aktif ke IndexedDB
 */
export async function saveDraftSession(draft: SavedDraftSession): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const payload = {
        ...draft,
        savedAt: new Date().toISOString(),
        photoCount: draft.capturedPhotos?.length || 0,
        previewThumbnail: draft.capturedPhotos?.[0] || draft.slotAssignments?.[0] || '',
      };

      const req = store.put(payload);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Gagal menyimpan draf sesi ke IndexedDB:', err);
    return false;
  }
}

/**
 * Ambil semua daftar draf sesi yang tersimpan (diurutkan dari yang paling baru)
 */
export async function getSavedDraftSessions(): Promise<SavedDraftSession[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const list: SavedDraftSession[] = req.result || [];
        // Urutkan dari yang paling baru disimpan
        list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Gagal membaca draf sesi dari IndexedDB:', err);
    return [];
  }
}

/**
 * Ambil draf sesi terbaru jika ada
 */
export async function getLatestDraftSession(): Promise<SavedDraftSession | null> {
  const drafts = await getSavedDraftSessions();
  return drafts.length > 0 ? drafts[0] : null;
}

/**
 * Hapus draf sesi tertentu dari IndexedDB berdasarkan ID
 */
export async function deleteDraftSession(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Gagal menghapus draf sesi:', err);
    return false;
  }
}

/**
 * Bersihkan seluruh draf sesi yang tersimpan
 */
export async function clearAllDraftSessions(): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Gagal membersihkan draf sesi:', err);
    return false;
  }
}
