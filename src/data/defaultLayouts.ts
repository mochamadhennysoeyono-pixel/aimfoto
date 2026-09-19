import { PhotoboothLayout } from '../types';

/**
 * Default Photobooth Layouts
 * Struktur layout dengan koordinat slots dalam PERSEN (0-100) terhadap kanvas.
 * Sesuai dengan tabel `layouts` di Supabase.
 */
export const DEFAULT_LAYOUTS: PhotoboothLayout[] = [
  {
    id: 'b1000000-0000-0000-0000-000000000001',
    name: 'Strip 3 Foto',
    ratio: '1:3',
    canvas_width: 600,
    canvas_height: 1800,
    photo_count: 3,
    slots: [
      { index: 0, x: 7.33, y: 2.44, width: 85.33, height: 21.33 },
      { index: 1, x: 7.33, y: 24.89, width: 85.33, height: 21.33 },
      { index: 2, x: 7.33, y: 47.33, width: 85.33, height: 21.33 },
    ],
  },
  {
    id: 'b1000000-0000-0000-0000-000000000002',
    name: 'Strip 4 Foto',
    ratio: '3:10',
    canvas_width: 600,
    canvas_height: 2000,
    photo_count: 4,
    slots: [
      { index: 0, x: 7.33, y: 2.0, width: 85.33, height: 18.5 },
      { index: 1, x: 7.33, y: 21.5, width: 85.33, height: 18.5 },
      { index: 2, x: 7.33, y: 41.0, width: 85.33, height: 18.5 },
      { index: 3, x: 7.33, y: 60.5, width: 85.33, height: 18.5 },
    ],
  },
  {
    id: 'b1000000-0000-0000-0000-000000000003',
    name: 'Grid 4 Foto',
    ratio: '3:4',
    canvas_width: 1200,
    canvas_height: 1550,
    photo_count: 4,
    slots: [
      { index: 0, x: 4.0, y: 3.1, width: 44.67, height: 34.58 },
      { index: 1, x: 51.33, y: 3.1, width: 44.67, height: 34.58 },
      { index: 2, x: 4.0, y: 39.74, width: 44.67, height: 34.58 },
      { index: 3, x: 51.33, y: 39.74, width: 44.67, height: 34.58 },
    ],
  },
  {
    id: 'b1000000-0000-0000-0000-000000000004',
    name: 'Single Portrait',
    ratio: '4:5',
    canvas_width: 1080,
    canvas_height: 1350,
    photo_count: 1,
    slots: [
      { index: 0, x: 4.44, y: 3.56, width: 91.11, height: 78.52 },
    ],
  },
];

export function findLayoutById(layouts: PhotoboothLayout[], idOrName?: string): PhotoboothLayout {
  if (!idOrName) return layouts[0] || DEFAULT_LAYOUTS[0];
  const found = layouts.find(
    (l) => l.id === idOrName || l.name?.toLowerCase() === idOrName.toLowerCase()
  );
  return found || layouts[0] || DEFAULT_LAYOUTS[0];
}

/**
 * Pembanding urutan layout:
 * 1. "Layout 1" sampai "Layout 14" diurutkan berurutan secara numerik (1, 2, ..., 14)
 * 2. Layout selain 1-14 diletakkan di bawahnya
 */
export function compareLayoutNames(nameA?: string, nameB?: string): number {
  const cleanA = (nameA || '').trim();
  const cleanB = (nameB || '').trim();

  const matchA = cleanA.match(/layout\s*(\d+)/i);
  const matchB = cleanB.match(/layout\s*(\d+)/i);

  const numA = matchA ? parseInt(matchA[1], 10) : null;
  const numB = matchB ? parseInt(matchB[1], 10) : null;

  const is1to14A = numA !== null && numA >= 1 && numA <= 14;
  const is1to14B = numB !== null && numB >= 1 && numB <= 14;

  // Jika keduanya Layout 1..14, urutkan berdasarkan angka
  if (is1to14A && is1to14B) {
    return (numA as number) - (numB as number);
  }
  // Jika A adalah Layout 1..14 dan B bukan, A selalu lebih dahulu
  if (is1to14A && !is1to14B) {
    return -1;
  }
  // Jika B adalah Layout 1..14 dan A bukan, B selalu lebih dahulu
  if (!is1to14A && is1to14B) {
    return 1;
  }

  // Jika keduanya selain 1..14:
  // Jika masih memiliki penomoran layout (misal Layout 15), urutkan numerik
  if (numA !== null && numB !== null) {
    return numA - numB;
  }
  if (numA !== null) return -1;
  if (numB !== null) return 1;

  // Layout format lainnya diurutkan menurut nama
  return cleanA.localeCompare(cleanB);
}

/**
 * Mengurutkan array PhotoboothLayout sehingga Layout 1 – 14 muncul di atas,
 * dan layout lainnya berada di bawahnya.
 */
export function sortLayoutsList<T extends { name?: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => compareLayoutNames(a.name, b.name));
}

/**
 * Normalizes any photobooth layout so its slots are cleanly ordered
 * and indexed 0, 1, 2, ... N-1 without jumps, offsets, or holes.
 */
export function normalizeLayout(layout: PhotoboothLayout): PhotoboothLayout {
  if (!layout) return layout;
  let rawSlots: any[] = [];
  if (Array.isArray(layout.slots)) {
    rawSlots = layout.slots;
  } else if (typeof layout.slots === 'string') {
    try {
      rawSlots = JSON.parse(layout.slots);
    } catch {
      rawSlots = [];
    }
  }

  const normalizedSlots = rawSlots.map((slot, idx) => ({
    ...slot,
    index: idx,
  }));

  return {
    ...layout,
    photo_count: normalizedSlots.length || layout.photo_count || 1,
    slots: normalizedSlots,
  };
}
