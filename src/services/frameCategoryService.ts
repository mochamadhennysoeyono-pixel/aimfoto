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
  { id: 'cat-fun', name: 'Unik' },
  { id: 'cat-1790227706808', name: 'Game' },
  { id: 'cat-1790246125914', name: 'Simple' },
  { id: 'cat-minimalist', name: 'Lainya' },
];

export const DEFAULT_FRAME_CATEGORY_MAP: Record<string, string> = {
  '29fc7ccb-4218-4297-a8a9-99b9669c92e3': 'Unik',
  '44c9de7e-632f-44d5-8ee9-9623f08fda3c': 'Unik',
  'ececd242-faa6-4ab2-8068-e17a0c7c5655': 'Unik',
  '4f0034df-c338-45b4-a764-cb462571bd01': 'Unik',
  'fd798b76-ea57-4efa-a904-e21443de6140': 'Unik',
  'ee21caff-debd-41f9-ab5e-55cd63d8fac9': 'Unik',
  '914b183e-8986-4a1b-901e-61334d145fce': 'Unik',
  '0e9faee8-ddf6-4e3e-95d6-5d0bf976603e': 'Unik',
  'a6870b16-917c-4c68-a07a-cb776c9f38a3': 'Unik',
  'ece60e9d-8535-498b-9668-64ad34d90a55': 'Lainya',
  '63a04824-e15d-4c17-8b1e-78fee4085fe4': 'Unik',
  '0a97ace2-414d-4bfb-87d3-f01f827683b9': 'Unik',
  '917bbbbf-e33b-4ead-bf19-b9f3a81b2231': 'Unik',
  'ddacb16b-783b-4921-a51d-14de6f99daf1': 'Unik',
  'f316784b-f86c-4b5b-a8c8-6a74afdabd22': 'Unik',
  '361ed9b9-51b4-418a-a33a-05cf3170612f': 'Unik',
  'a326b265-2f4e-4fc1-9d8d-96611cb9ced4': 'Unik',
  'e5a056f8-4114-4f19-9e8a-bc235bf8806b': 'Game',
  '0231e134-6927-4f5c-9239-635a0d770cc8': 'Game',
  '3846f3aa-5c06-40d5-ba23-2ebc05cd1a43': 'Game',
  'f07994b9-cc28-40b1-b75e-b4513f139579': 'Game',
  '898785b9-972f-4505-94a0-7ad0fb638094': 'Simple',
  '7b09b146-05be-4329-a0f7-1e395be4c884': 'Simple',
  '18fb22fb-c046-4789-8967-08f2876db8ee': 'Lainya',
  '146111aa-86c0-44ee-9bb6-b2fb4c12a10d': 'Lainya',
  '2c77f003-5c6d-46c2-88f5-e2f6fd603394': 'Lainya',
  '6471eb67-9fcc-4892-b3ff-e1cbbfbd5192': 'Simple',
  '01b20fad-5504-429c-be56-d1100f8b1625': 'Simple',
  'f5cfa915-50cc-4ea0-ac90-83fe39331a89': 'Simple',
};

export const CATEGORY_CONFIG_ROW_ID = '00000000-0000-0000-0000-000000000006';
export const CATEGORY_CONFIG_ROW_NAME = '__FRAME_CATEGORIES_CONFIG__';
const STORAGE_KEY = 'photobooth_frame_categories_meta';

// In-memory cache for 0ms synchronous access
let cachedCategories: FrameCategory[] = [...DEFAULT_FRAME_CATEGORIES];
let cachedCategoryMap: Record<string, string> = { ...DEFAULT_FRAME_CATEGORY_MAP };
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
