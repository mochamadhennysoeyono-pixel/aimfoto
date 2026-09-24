import { supabase } from '../supabaseClient.js';

export interface FrameCategory {
  id: string;
  name: string;
  color?: string;
}

export interface FrameCategoryStoragePayload {
  categories: FrameCategory[];
  frameCategoryMap: Record<string, string>; // frameId -> categoryName
}

export const DEFAULT_FRAME_CATEGORIES: FrameCategory[] = [
  { id: 'cat-korean', name: 'Korean Photostrip' },
  { id: 'cat-aesthetic', name: 'Aesthetic & Vintage' },
  { id: 'cat-wedding', name: 'Wedding & Romance' },
  { id: 'cat-birthday', name: 'Birthday & Party' },
  { id: 'cat-minimalist', name: 'Minimalist & Modern' },
  { id: 'cat-fun', name: 'Fun & Kids' },
];

export const CATEGORY_CONFIG_ROW_ID = '00000000-0000-0000-0000-000000000006';
export const CATEGORY_CONFIG_ROW_NAME = '__FRAME_CATEGORIES_CONFIG__';
const STORAGE_KEY = 'photobooth_frame_categories_meta';

// In-memory cache for 0ms synchronous access
let cachedCategories: FrameCategory[] = [...DEFAULT_FRAME_CATEGORIES];
let cachedCategoryMap: Record<string, string> = {};
let isInitialized = false;

function safeGet(key: string): string | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
  } catch (_) {
    return null;
  }
}

function safeSet(key: string, val: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, val);
    }
  } catch (_) {}
}

/**
 * Membaca data kategori dan mapping frame secara sinkron (0ms) dari RAM atau LocalStorage
 */
export function getFrameCategoriesSync(): {
  categories: FrameCategory[];
  frameCategoryMap: Record<string, string>;
} {
  if (!isInitialized) {
    const raw = safeGet(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.categories)) {
          cachedCategories = parsed.categories;
          cachedCategoryMap = parsed.frameCategoryMap || {};
        }
      } catch (_) {}
    }
    isInitialized = true;
  }

  return {
    categories: cachedCategories,
    frameCategoryMap: cachedCategoryMap,
  };
}

/**
 * Mengambil data kategori dan mapping frame dari Supabase
 */
export async function fetchFrameCategoriesData(): Promise<{
  categories: FrameCategory[];
  frameCategoryMap: Record<string, string>;
}> {
  // Sync first
  getFrameCategoriesSync();

  try {
    const { data, error } = await supabase
      .from('events')
      .select('qr_code')
      .eq('id', CATEGORY_CONFIG_ROW_ID)
      .maybeSingle();

    if (!error && data && data.qr_code) {
      try {
        const parsed = JSON.parse(data.qr_code);
        if (parsed && Array.isArray(parsed.categories)) {
          cachedCategories = parsed.categories;
          cachedCategoryMap = parsed.frameCategoryMap || {};
          safeSet(
            STORAGE_KEY,
            JSON.stringify({
              categories: cachedCategories,
              frameCategoryMap: cachedCategoryMap,
            })
          );
        }
      } catch (parseErr) {
        console.warn('Gagal parse frame categories json:', parseErr);
      }
    }
  } catch (err) {
    console.warn('Gagal fetch frame categories dari Supabase:', err);
  }

  return {
    categories: cachedCategories,
    frameCategoryMap: cachedCategoryMap,
  };
}

/**
 * Menyimpan seluruh data kategori dan mapping frame ke Supabase & LocalStorage
 */
export async function saveFrameCategoriesData(
  categories: FrameCategory[],
  frameCategoryMap: Record<string, string>
): Promise<boolean> {
  cachedCategories = [...categories];
  cachedCategoryMap = { ...frameCategoryMap };

  const payload: FrameCategoryStoragePayload = {
    categories: cachedCategories,
    frameCategoryMap: cachedCategoryMap,
  };

  const payloadJson = JSON.stringify(payload);
  safeSet(STORAGE_KEY, payloadJson);

  // Broadcast event agar UI lain langsung terupdate realtime
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('photobooth_categories_updated', {
        detail: payload,
      })
    );
  }

  try {
    const { error } = await supabase.from('events').upsert(
      [
        {
          id: CATEGORY_CONFIG_ROW_ID,
          name: CATEGORY_CONFIG_ROW_NAME,
          qr_code: payloadJson,
          is_active: false,
          created_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'id' }
    );

    if (error) {
      console.warn('Gagal simpan frame categories ke Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error upsert frame categories ke Supabase:', err);
    return false;
  }
}

/**
 * Mengaitkan kategori ke suatu Frame
 */
export async function setFrameCategory(
  frameId: string,
  categoryName: string
): Promise<void> {
  const current = getFrameCategoriesSync();
  const updatedMap = {
    ...current.frameCategoryMap,
    [frameId]: categoryName.trim(),
  };

  // Pastikan kategori juga ada di master data jika belum ada
  let updatedCategories = [...current.categories];
  const catName = categoryName.trim();
  if (catName && !updatedCategories.some((c) => c.name.toLowerCase() === catName.toLowerCase())) {
    updatedCategories.push({
      id: `cat-${Date.now()}`,
      name: catName,
    });
  }

  await saveFrameCategoriesData(updatedCategories, updatedMap);
}

/**
 * Mendapatkan nama kategori untuk frame tertentu
 */
export function getFrameCategory(frameId: string): string {
  const { frameCategoryMap } = getFrameCategoriesSync();
  return frameCategoryMap[frameId] || 'Umum';
}
