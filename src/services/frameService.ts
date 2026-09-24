import { FrameLayoutItem, FrameTheme, PhotoboothLayout, LayoutSlot } from '../types';
import { supabase } from '../supabaseClient';
import { DEFAULT_LAYOUTS } from '../data/defaultLayouts';
import { getFrameCategoriesSync, fetchFrameCategoriesData } from './frameCategoryService';

// Memory Cache
const memoryCache = new Map<string, { data: FrameLayoutItem[]; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 detik sebelum background revalidation

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

/**
 * Preload frame PNGs into browser cache so they appear instantaneously without blank flickers
 */
export function preloadFrameImages(frames: FrameLayoutItem[]): void {
  if (typeof window === 'undefined') return;
  frames.forEach((f) => {
    const url = f.image_url || f.frame?.image_url;
    if (url && url.startsWith('http')) {
      const img = new Image();
      img.src = url;
    }
  });
}

/**
 * Mengambil frames secara instan (0ms) dari RAM atau LocalStorage jika ada
 */
export function getCachedFramesSync(eventId?: string): FrameLayoutItem[] | null {
  const cacheKey = eventId && eventId !== 'all' ? `event_${eventId}` : 'event_all';
  
  // 1. Cek memory cache
  const inMemory = memoryCache.get(cacheKey);
  if (inMemory && inMemory.data.length > 0) {
    return inMemory.data;
  }

  // 2. Cek localStorage
  const raw = safeGet(`photobooth_cached_frames_${cacheKey}`);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
        return parsed;
      }
    } catch (_) {}
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

  // Kembalikan langsung dari RAM jika masih fresh & tidak dipaksa refresh
  if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Cek cache sync untuk fast response
  const syncData = getCachedFramesSync(eventId);

  // Jalankan query paralel ke Supabase
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
          const finalImageUrl = imageUrlMap.get(f.id) || f.image_url || '';
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
        items = [
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

      // Update cache
      memoryCache.set(cacheKey, { data: items, timestamp: Date.now() });
      safeSet(`photobooth_cached_frames_${cacheKey}`, JSON.stringify(items));

      // Preload image thumbnails
      preloadFrameImages(items);

      // Trigger event update jika ada komponen yang sedang mendengarkan
      if (typeof window !== 'undefined') {
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

  // Jika kita sudah punya sync data, kita kembalikan syncData dan biarkan queryPromise berjalan di background
  if (syncData && syncData.length > 0 && !forceRefresh) {
    queryPromise.catch(() => {});
    return syncData;
  }

  return await queryPromise;
}

/**
 * Prefetch frame data dan gambar thumbnail di background sejak aplikasi baru dibuka
 */
export function prefetchFrames(eventId?: string): void {
  setTimeout(() => {
    fetchActiveFrames(eventId, false).catch(() => {});
  }, 100);
}

/**
 * Hapus cache frames saat admin menambah/mengubah frame
 */
export function invalidateFrameCache(): void {
  memoryCache.clear();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('photobooth_cached_frames_')) {
          localStorage.removeItem(key);
        }
      }
      window.dispatchEvent(new CustomEvent('photobooth_frames_invalidated'));
    }
  } catch (_) {}
}
