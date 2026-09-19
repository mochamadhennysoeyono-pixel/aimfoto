import { supabase } from '../supabaseClient.js';

export interface EventMetadata {
  lokasi?: string;
  tanggal?: string;
  subtitle?: string;
  isFreeEvent?: boolean;
  hargaDigital?: number;
  hargaPrint?: number;
  promoBadge?: string;
  promoDescription?: string;
  paymentMethodsAllowed?: 'all' | 'cash' | 'digital';
  packagesAllowed?: 'both' | 'digital_only' | 'print_only';
  cashInstruction?: string;
}

const META_STORAGE_KEY = 'photobooth_events_meta';
export const META_ROW_ID = '00000000-0000-0000-0000-000000000003';
export const META_ROW_NAME = '__EVENTS_META__';

let cachedMetaMap: Record<string, EventMetadata> | null = null;

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (_) {}
  return null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch (_) {}
}

/**
 * Mengambil metadata seluruh event dari Supabase & cache localStorage.
 */
export async function fetchEventsMetadata(): Promise<Record<string, EventMetadata>> {
  // Cek cache memory dulu
  if (cachedMetaMap && Object.keys(cachedMetaMap).length > 0) {
    return cachedMetaMap;
  }

  // Cek localStorage
  const rawLocal = safeGetItem(META_STORAGE_KEY);
  if (rawLocal) {
    try {
      cachedMetaMap = JSON.parse(rawLocal);
    } catch (_) {}
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .select('qr_code')
      .eq('id', META_ROW_ID)
      .maybeSingle();

    if (!error && data && data.qr_code) {
      try {
        const parsed = JSON.parse(data.qr_code);
        if (parsed && typeof parsed === 'object') {
          cachedMetaMap = { ...(cachedMetaMap || {}), ...parsed };
          safeSetItem(META_STORAGE_KEY, JSON.stringify(cachedMetaMap));
        }
      } catch (_) {}
    }
  } catch (err) {
    console.warn('Gagal memuat metadata event dari Supabase:', err);
  }

  return cachedMetaMap || {};
}

/**
 * Mendapatkan metadata event tertentu secara sinkron dari cache.
 */
export function getCachedEventMetadata(eventId: string): EventMetadata | null {
  if (cachedMetaMap && cachedMetaMap[eventId]) {
    return cachedMetaMap[eventId];
  }
  const raw = safeGetItem(META_STORAGE_KEY);
  if (raw) {
    try {
      const map = JSON.parse(raw);
      return map[eventId] || null;
    } catch (_) {}
  }
  return null;
}

/**
 * Menyimpan metadata event (lokasi, tanggal, subtitle) ke Supabase dan localStorage.
 */
export async function saveEventMetadata(
  eventId: string,
  meta: EventMetadata
): Promise<void> {
  if (!eventId) return;

  // Baca metadata terkini
  const currentMap = await fetchEventsMetadata();
  const updatedEventMeta: EventMetadata = {
    ...(currentMap[eventId] || {}),
    ...meta,
  };

  const newMap: Record<string, EventMetadata> = {
    ...currentMap,
    [eventId]: updatedEventMeta,
  };

  cachedMetaMap = newMap;
  safeSetItem(META_STORAGE_KEY, JSON.stringify(newMap));

  // Simpan ke row khusus di Supabase (__EVENTS_META__)
  try {
    await supabase.from('events').upsert({
      id: META_ROW_ID,
      name: META_ROW_NAME,
      qr_code: JSON.stringify(newMap),
      default_price: 0,
      is_active: false,
    });
  } catch (err) {
    console.warn('Gagal menyimpan metadata event ke Supabase:', err);
  }

  // Notifikasi realtime ke seluruh halaman aplikasi
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('photobooth_event_updated', {
        detail: {
          id: eventId,
          ...updatedEventMeta,
        },
      })
    );
    window.dispatchEvent(
      new CustomEvent('photobooth-event-config-updated', {
        detail: {
          id: eventId,
          ...updatedEventMeta,
        },
      })
    );
  }
}
