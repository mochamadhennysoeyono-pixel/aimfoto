/**
 * Helper terpusat untuk memvalidasi apakah baris event adalah event asli (konteks acara/event photobooth),
 * bukan baris konfigurasi internal sistem seperti __FRAME_CATEGORIES_CONFIG__, __EVENTS_META__, __STATIC_QRIS_CONFIG__, dll.
 */
export function isRealEvent(
  ev:
    | {
        name?: string | null;
        id?: string | null;
        qr_code?: string | null;
      }
    | null
    | undefined
): boolean {
  if (!ev || !ev.name) return false;
  const name = ev.name.trim();

  // Pola awalan dunder (__) misal: __FRAME_CATEGORIES_CONFIG__, __EVENTS_META__, dll.
  if (name.startsWith('__') || name.endsWith('__') || name.startsWith('_')) {
    return false;
  }

  const upper = name.toUpperCase();

  // Kata kunci konfigurasi dan metadata internal sistem
  if (
    upper.includes('CONFIG') ||
    upper.includes('META') ||
    upper.includes('SETTING') ||
    upper === 'ADMIN_CONFIG' ||
    upper === 'EVENTS_META' ||
    upper === 'FRAME_CATEGORIES' ||
    upper === 'FRAME_CATEGORIES_CONFIG' ||
    upper.startsWith('STATIC_QRIS')
  ) {
    return false;
  }

  // ID khusus placeholder sistem
  if (
    ev.id === '11111111-2222-3333-4444-555555555555' ||
    ev.id === '00000000-0000-0000-0000-000000000001'
  ) {
    return false;
  }

  // Baris yang menyimpan JSON config di kolom qr_code
  if (ev.qr_code && (ev.qr_code.startsWith('__') || ev.qr_code.startsWith('{'))) {
    if (upper.includes('CONFIG') || upper.includes('META')) {
      return false;
    }
  }

  return true;
}
