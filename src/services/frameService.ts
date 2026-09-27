import { FrameLayoutItem, FrameTheme, PhotoboothLayout, LayoutSlot } from '../types';
import { supabase } from '../supabaseClient';
import { DEFAULT_LAYOUTS } from '../data/defaultLayouts';
import { DEFAULT_ACTIVE_FRAMES } from '../data/defaultActiveFrames';
import { getFrameCategoriesSync, fetchFrameCategoriesData } from './frameCategoryService';
import { clearClientQueryCache } from '../cloudflareClient';

// Memory Cache
interface MemoryCacheEntry {
  data: FrameLayoutItem[];
  timestamp: number;
  isFromServer: boolean;
}
const memoryCache = new Map<string, MemoryCacheEntry>();
const CACHE_TTL_MS = 20 * 1000; // 20 detik sebelum background revalidation jika sudah dari server

// Safe localStorage helper
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

// Set untuk menyimpan URL gambar frame yang sudah didecode ke RAM browser
export const preloadedImageUrls = new Set<string>();

/**
 * Mengubah URL frame R2 mentah menjadi URL proxy internal /api/r2/file
 * agar memiliki header CORS Access-Control-Allow-Origin: * lengkap dan tidak diblokir browser.
 */
export function resolveFrameImageUrl(url?: string): string {
  if (!url) return '';
  // Jika sudah relative proxy path
  if (url.startsWith('/api/r2/file')) return url;
  // Jika URL mengarah ke domain dev R2 langsung
  if (url.includes('.r2.dev/')) {
    const parts = url.split('.r2.dev/');
    if (parts[1]) {
      return `/api/r2/file/${parts[1].replace(/^\/+/, '')}`;
    }
  }
  // Jika tersimpan hanya nama path bucket
  if (url.startsWith('photobooth-frames/') || url.startsWith('photos/')) {
    return `/api/r2/file/${url}`;
  }
  return url;
}

export function isImagePreloaded(url?: string): boolean {
  if (!url) return false;
  const resolved = resolveFrameImageUrl(url);
  return preloadedImageUrls.has(resolved) || preloadedImageUrls.has(url);
}

/**
 * Preload dan decode gambar PNG frame langsung ke GPU/RAM browser
 * Menggunakan link rel="preload" prioritas tinggi dan off-thread img.decode()
 * sehingga gambar langsung muncul seketika secara utuh tanpa proses lambat dari atas ke bawah.
 */
export function preloadFrameImages(frames: FrameLayoutItem[]): void {
  if (typeof window === 'undefined' || !frames || frames.length === 0) return;

  frames.forEach((f) => {
    const rawUrl = f.image_url || f.frame?.image_url;
    if (!rawUrl) return;
    const url = resolveFrameImageUrl(rawUrl);
    if (!url || preloadedImageUrls.has(url)) return;

    // 1. Injeksi link rel="preload" ke <head> agar browser network scheduler memberi prioritas tinggi
    try {
      const existing = document.querySelector(`link[rel="preload"][href="${url}"]`);
      if (!existing && document.head) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = url;
        document.head.appendChild(link);
      }
    } catch (_) {}

    // 2. Decode off-thread menggunakan HTMLImageElement & img.decode()
    // Catatan: Tidak menggunakan crossOrigin='anonymous' pada image biasa agar tidak terhalang CORS
    const img = new Image();
    img.src = url;

    if (typeof (img as any).decode === 'function') {
      (img as any)
        .decode()
        .then(() => {
          preloadedImageUrls.add(url);
        })
        .catch(() => {
          preloadedImageUrls.add(url);
        });
    } else {
      img.onload = () => {
        preloadedImageUrls.add(url);
      };
    }
  });
}

/**
 * Helper untuk memvalidasi apakah array data frame valid (bukan dummy 1-slot)
 */
function isValidFrameList(arr: any): arr is FrameLayoutItem[] {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  const isDummy = arr.length === 1 && (arr[0].id === 'default-strip-3' || arr[0].frame_id === 'default-frame-1');
  return !isDummy;
}

/**
 * Mengambil frames secara instan (0ms) dari RAM atau LocalStorage jika ada
 */
export function getCachedFramesSync(eventId?: string): FrameLayoutItem[] | null {
  const cacheKey = eventId && eventId !== 'all' ? `event_${eventId}` : 'event_all';
  
  // 1. Cek memory cache key spesifik
  const inMemory = memoryCache.get(cacheKey);
  if (inMemory && isValidFrameList(inMemory.data)) {
    return inMemory.data;
  }

  // 1b. Cek memory cache event_all
  if (cacheKey !== 'event_all') {
    const inMemoryAll = memoryCache.get('event_all');
    if (inMemoryAll && isValidFrameList(inMemoryAll.data)) {
      return inMemoryAll.data;
    }
  }

  // 1c. Cek semua entri memory cache yang valid
  for (const entry of memoryCache.values()) {
    if (isValidFrameList(entry.data)) {
      return entry.data;
    }
  }

  // 2. Cek localStorage key spesifik
  const raw = safeGet(`photobooth_cached_frames_${cacheKey}`);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isValidFrameList(parsed)) {
        memoryCache.set(cacheKey, { data: parsed, timestamp: 0, isFromServer: false });
        return parsed;
      }
    } catch (_) {}
  }

  // 2b. Cek localStorage event_all
  if (cacheKey !== 'event_all') {
    const rawAll = safeGet('photobooth_cached_frames_event_all');
    if (rawAll) {
      try {
        const parsedAll = JSON.parse(rawAll);
        if (isValidFrameList(parsedAll)) {
          memoryCache.set(cacheKey, { data: parsedAll, timestamp: 0, isFromServer: false });
          return parsedAll;
        }
      } catch (_) {}
    }
  }

  // 3. Fallback instan ke DEFAULT_ACTIVE_FRAMES (25 frame ril dari D1/Supabase)
  if (DEFAULT_ACTIVE_FRAMES && DEFAULT_ACTIVE_FRAMES.length > 0) {
    memoryCache.set(cacheKey, { data: DEFAULT_ACTIVE_FRAMES, timestamp: 0, isFromServer: false });
    return DEFAULT_ACTIVE_FRAMES;
  }

  return null;
}

/**
 * Mengambil frames aktif dengan teknik Stale-While-Revalidate & query paralel super kencang
 */
export async function fetchActiveFrames(
  eventId?: string,
  forceRefresh = false
): Promise<FrameLayoutItem[]> {
  const cacheKey = eventId && eventId !== 'all' ? `event_${eventId}` : 'event_all';
  const cached = memoryCache.get(cacheKey);
  const now = Date.now();

  // Kembalikan langsung dari RAM HANYA jika data BENAR-BENAR sudah diambil dari server
  // dan masih dalam rentang masa berlaku CACHE_TTL_MS (20 detik) serta tidak dipaksa refresh
  if (!forceRefresh && cached && cached.isFromServer && now - cached.timestamp < CACHE_TTL_MS) {
    const isDummy = cached.data.length === 1 && (cached.data[0].id === 'default-strip-3' || cached.data[0].frame_id === 'default-frame-1');
    if (!isDummy) return cached.data;
  }

  // Cek cache sync untuk fast response
  const syncData = getCachedFramesSync(eventId);

  // Jalankan query paralel ke Cloudflare D1 / Supabase
  const queryPromise = (async () => {
    try {
      // 1. Eksekusi query frames dan frame_layouts secara PARALEL dengan Promise.all
      let framesQuery = supabase
        .from('frames')
        .select('*')
        .eq('is_active', true);

      if (eventId && eventId !== 'all') {
        framesQuery = framesQuery.eq('event_id', eventId);
      }

      const layoutsQuery = supabase
        .from('frame_layouts')
        .select('*, layout:layouts(*)');

      const [framesRes, layoutsRes, categoriesData] = await Promise.all([
        framesQuery.order('sort_order', { ascending: true }),
        layoutsQuery,
        fetchFrameCategoriesData(),
      ]);

      const catMap = categoriesData?.frameCategoryMap || getFrameCategoriesSync().frameCategoryMap;

      let dbFrames = framesRes.data || [];

      // Jika tidak ada frame khusus event_id ini, ambil frame aktif global dalam 1 roundtrip
      if (dbFrames.length === 0 && eventId && eventId !== 'all') {
        const { data: globalFrames } = await supabase
          .from('frames')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        dbFrames = globalFrames || [];
      }

      const flData = layoutsRes.data || [];

      // Map layouts dan slot
      const layoutMap = new Map<string, PhotoboothLayout>();
      const imageUrlMap = new Map<string, string>();
      const flIdMap = new Map<string, string>();

      flData.forEach((fl: any) => {
        if (fl.layout && !layoutMap.has(fl.frame_id)) {
          let parsedSlots: LayoutSlot[] = [];
          if (Array.isArray(fl.layout.slots)) {
            parsedSlots = fl.layout.slots;
          } else if (typeof fl.layout.slots === 'string') {
            try {
              parsedSlots = JSON.parse(fl.layout.slots);
            } catch (e) {
              parsedSlots = [];
            }
          }

          layoutMap.set(fl.frame_id, {
            id: fl.layout.id,
            name: fl.layout.name || 'Layout Photobooth',
            ratio: fl.layout.ratio || '2:3',
            canvas_width: fl.layout.canvas_width || 1200,
            canvas_height: fl.layout.canvas_height || 1800,
            photo_count: fl.layout.photo_count || parsedSlots.length || 1,
            slots: parsedSlots,
          });
        }
        if (fl.image_url && !imageUrlMap.has(fl.frame_id)) {
          imageUrlMap.set(fl.frame_id, fl.image_url);
        }
        if (!flIdMap.has(fl.frame_id)) {
          flIdMap.set(fl.frame_id, fl.id);
        }
      });

      let items: FrameLayoutItem[] = [];

      if (dbFrames.length > 0) {
        items = dbFrames.map((f: any) => {
          const matchedLayout = layoutMap.get(f.id) || DEFAULT_LAYOUTS[0];
          const rawUrl = imageUrlMap.get(f.id) || f.image_url || '';
          const finalImageUrl = resolveFrameImageUrl(rawUrl);
          const frameCategory = catMap[f.id] || 'Umum';
          const frameThemeObj: FrameTheme = {
            id: f.id,
            name: f.name || 'Frame Photobooth',
            event_id: f.event_id,
            sort_order: f.sort_order ?? 1,
            is_active: f.is_active ?? true,
            category: frameCategory,
            description: f.description,
            created_at: f.created_at,
            image_url: finalImageUrl,
            slots_count: matchedLayout.photo_count || matchedLayout.slots?.length || 3,
            layout: matchedLayout,
          };

          return {
            id: flIdMap.get(f.id) || f.id,
            frame_id: f.id,
            layout_id: matchedLayout.id,
            image_url: finalImageUrl,
            category: frameCategory,
            layout: matchedLayout,
            frame: frameThemeObj,
          };
        });
      } else {
        // Fallback default
        items = DEFAULT_ACTIVE_FRAMES && DEFAULT_ACTIVE_FRAMES.length > 0 ? DEFAULT_ACTIVE_FRAMES : [
          {
            id: 'default-strip-3',
            frame_id: 'default-frame-1',
            layout_id: DEFAULT_LAYOUTS[0].id,
            image_url: '',
            layout: DEFAULT_LAYOUTS[0],
            frame: {
              id: 'default-frame-1',
              name: 'Classic 3-Photo Strip',
              event_id: eventId,
              slots_count: 3,
              layout: DEFAULT_LAYOUTS[0],
            },
          },
        ];
      }

      // Deteksi perubahan data dibanding cache saat ini
      const prevIds = (cached?.data || syncData || []).map((x) => x.frame_id || x.id).join(',');
      const newIds = items.map((x) => x.frame_id || x.id).join(',');
      const hasChanged = prevIds !== newIds;

      // Update cache dengan tanda isFromServer: true dan timestamp terkini
      memoryCache.set(cacheKey, { data: items, timestamp: Date.now(), isFromServer: true });
      memoryCache.set('event_all', { data: items, timestamp: Date.now(), isFromServer: true });
      safeSet(`photobooth_cached_frames_${cacheKey}`, JSON.stringify(items));
      safeSet('photobooth_cached_frames_event_all', JSON.stringify(items));
      if (eventId && eventId !== 'all') {
        memoryCache.set(`event_${eventId}`, { data: items, timestamp: Date.now(), isFromServer: true });
        safeSet(`photobooth_cached_frames_event_${eventId}`, JSON.stringify(items));
      }

      // Preload image thumbnails
      preloadFrameImages(items);

      // Trigger event update hanya jika data berubah atau dipaksa refresh
      if ((hasChanged || forceRefresh) && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('photobooth_frames_refreshed', {
            detail: { eventId, frames: items },
          })
        );
      }

      return items;
    } catch (err) {
      console.warn('Gagal fetch active frames:', err);
      return syncData || [];
    }
  })();

  // Jika forceRefresh = true, TUNGGU queryPromise agar data yang diterima dijamin 100% fresh dari server
  if (forceRefresh) {
    return await queryPromise;
  }

  // Jika kita sudah punya sync data dan tidak forceRefresh, kembalikan syncData dan biarkan queryPromise revalidate di background
  if (syncData && syncData.length > 0) {
    queryPromise.catch(() => {});
    return syncData;
  }

  return await queryPromise;
}

/**
 * Prefetch frame data dan gambar PNG di background sejak aplikasi baru dibuka
 */
export function prefetchFrames(eventId?: string): void {
  // 1. Jika sudah ada data di memory/localStorage, langsung preload gambarnya seketika tanpa jeda
  const cached = getCachedFramesSync(eventId);
  if (cached && cached.length > 0) {
    preloadFrameImages(cached);
  }

  // 2. Fetch data frame terbaru dari D1/Supabase dan preload gambar-gambarnya
  setTimeout(() => {
    fetchActiveFrames(eventId, true)
      .then((items) => {
        if (items && items.length > 0) {
          preloadFrameImages(items);
        }
      })
      .catch(() => {});
  }, 20);
}

/**
 * Hapus cache frames saat admin menambah/mengubah frame
 */
export function invalidateFrameCache(): void {
  memoryCache.clear();
  clearClientQueryCache();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('photobooth_cached_frames_')) {
          localStorage.removeItem(key);
        }
      }
      localStorage.setItem('photobooth_frames_last_invalidated', String(Date.now()));
      window.dispatchEvent(new CustomEvent('photobooth_frames_invalidated'));
    }
  } catch (_) {}
}
