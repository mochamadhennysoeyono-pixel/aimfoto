import { FrameLayoutDefinition, FrameLayoutType, FrameConfig } from '../types';

/**
 * Standard Photobooth Multi-Photo Layouts
 * Supported types:
 * - strip-3: 3 vertical photos (Korean photostrip 1:3 ratio)
 * - strip-4: 4 vertical photos (Classic photostrip)
 * - strip-2: 2 vertical photos
 * - grid-4: 4 photos (2x2 grid)
 * - grid-6: 6 photos (2x3 grid)
 * - wide-3: 3 photos horizontal
 * - single: 1 photo portrait / polaroid
 */

export const FRAME_LAYOUTS: FrameLayoutDefinition[] = [
  {
    type: 'strip-3',
    name: 'Photo Strip 3',
    badge: '3 Foto',
    description: 'Format strip vertikal ala Korea dengan 3 foto dan area logo di bawah.',
    photoCount: 3,
    canvasWidth: 600,
    canvasHeight: 1800,
    aspectRatioClass: 'aspect-[1/3]',
    slots: [
      { index: 0, label: 'Foto 1', x: 44, y: 44, width: 512, height: 384, borderRadius: 8 },
      { index: 1, label: 'Foto 2', x: 44, y: 448, width: 512, height: 384, borderRadius: 8 },
      { index: 2, label: 'Foto 3', x: 44, y: 852, width: 512, height: 384, borderRadius: 8 },
    ],
  },
  {
    type: 'strip-4',
    name: 'Classic Strip 4',
    badge: '4 Foto',
    description: 'Format strip retro 4 foto klasik memanjang ke bawah.',
    photoCount: 4,
    canvasWidth: 600,
    canvasHeight: 2000,
    aspectRatioClass: 'aspect-[3/10]',
    slots: [
      { index: 0, label: 'Foto 1', x: 44, y: 40, width: 512, height: 370, borderRadius: 8 },
      { index: 1, label: 'Foto 2', x: 44, y: 430, width: 512, height: 370, borderRadius: 8 },
      { index: 2, label: 'Foto 3', x: 44, y: 820, width: 512, height: 370, borderRadius: 8 },
      { index: 3, label: 'Foto 4', x: 44, y: 1210, width: 512, height: 370, borderRadius: 8 },
    ],
  },
  {
    type: 'grid-4',
    name: 'Grid 2x2',
    badge: '4 Foto',
    description: 'Format kotak 4 foto (2 baris x 2 kolom) cocok untuk grup & pasangan.',
    photoCount: 4,
    canvasWidth: 1200,
    canvasHeight: 1550,
    aspectRatioClass: 'aspect-[3/4]',
    slots: [
      { index: 0, label: 'Foto 1', x: 48, y: 48, width: 536, height: 536, borderRadius: 12 },
      { index: 1, label: 'Foto 2', x: 616, y: 48, width: 536, height: 536, borderRadius: 12 },
      { index: 2, label: 'Foto 3', x: 48, y: 616, width: 536, height: 536, borderRadius: 12 },
      { index: 3, label: 'Foto 4', x: 616, y: 616, width: 536, height: 536, borderRadius: 12 },
    ],
  },
  {
    type: 'strip-2',
    name: 'Duo Strip 2',
    badge: '2 Foto',
    description: 'Format 2 foto ukuran besar bertingkat dengan aksen estetis.',
    photoCount: 2,
    canvasWidth: 600,
    canvasHeight: 1350,
    aspectRatioClass: 'aspect-[4/9]',
    slots: [
      { index: 0, label: 'Foto 1', x: 44, y: 44, width: 512, height: 440, borderRadius: 10 },
      { index: 1, label: 'Foto 2', x: 44, y: 508, width: 512, height: 440, borderRadius: 10 },
    ],
  },
  {
    type: 'grid-6',
    name: 'Grid 6 Mini',
    badge: '6 Foto',
    description: 'Format 6 foto (2 kolom x 3 baris) untuk abadikan banyak ekspresi seru.',
    photoCount: 6,
    canvasWidth: 1200,
    canvasHeight: 1650,
    aspectRatioClass: 'aspect-[3/4]',
    slots: [
      { index: 0, label: 'Foto 1', x: 48, y: 48, width: 536, height: 380, borderRadius: 8 },
      { index: 1, label: 'Foto 2', x: 616, y: 48, width: 536, height: 380, borderRadius: 8 },
      { index: 2, label: 'Foto 3', x: 48, y: 452, width: 536, height: 380, borderRadius: 8 },
      { index: 3, label: 'Foto 4', x: 616, y: 452, width: 536, height: 380, borderRadius: 8 },
      { index: 4, label: 'Foto 5', x: 48, y: 856, width: 536, height: 380, borderRadius: 8 },
      { index: 5, label: 'Foto 6', x: 616, y: 856, width: 536, height: 380, borderRadius: 8 },
    ],
  },
  {
    type: 'wide-3',
    name: 'Landscape Trio',
    badge: '3 Foto',
    description: 'Format horizontal 3 foto bersisian dengan banner teks artistik.',
    photoCount: 3,
    canvasWidth: 1500,
    canvasHeight: 800,
    aspectRatioClass: 'aspect-[15/8]',
    slots: [
      { index: 0, label: 'Foto 1', x: 40, y: 40, width: 330, height: 500, borderRadius: 8 },
      { index: 1, label: 'Foto 2', x: 390, y: 40, width: 330, height: 500, borderRadius: 8 },
      { index: 2, label: 'Foto 3', x: 740, y: 40, width: 330, height: 500, borderRadius: 8 },
    ],
  },
  {
    type: 'single',
    name: 'Single Portrait / Polaroid',
    badge: '1 Foto',
    description: 'Format foto tunggal resolusi penuh dengan frame artistik & tanggal.',
    photoCount: 1,
    canvasWidth: 1080,
    canvasHeight: 1350,
    aspectRatioClass: 'aspect-[4/5]',
    slots: [
      { index: 0, label: 'Foto Utama', x: 48, y: 48, width: 984, height: 1060, borderRadius: 12 },
    ],
  },
];

export function getFrameLayout(type: FrameLayoutType = 'strip-3'): FrameLayoutDefinition {
  return FRAME_LAYOUTS.find((l) => l.type === type) || FRAME_LAYOUTS[0];
}

/**
 * Generates thematic SVG transparent frame overlays matching user layouts & Autumn theme
 */
export function createAutumnThemeOverlay(
  layoutType: FrameLayoutType,
  title = 'HELLO AUTUMN',
  subtitle = 'Season of Colors'
): string {
  const layout = getFrameLayout(layoutType);
  const w = layout.canvasWidth;
  const h = layout.canvasHeight;

  // Botton banner position
  const bannerY = h - 220;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs>
      <!-- Autumn foliage colors -->
      <linearGradient id="autumnLeaf" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#E28743"/>
        <stop offset="50%" stop-color="#C25927"/>
        <stop offset="100%" stop-color="#8E2800"/>
      </linearGradient>
      <linearGradient id="autumnGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F7C844"/>
        <stop offset="100%" stop-color="#D48821"/>
      </linearGradient>
    </defs>

    <!-- Outer frame border with rich autumn charcoal tones -->
    <rect x="12" y="12" width="${w - 24}" height="${h - 24}" rx="14" fill="none" stroke="#2D221C" stroke-width="6" opacity="0.9"/>
    <rect x="24" y="24" width="${w - 48}" height="${h - 48}" rx="10" fill="none" stroke="rgba(226, 135, 67, 0.4)" stroke-width="2" stroke-dasharray="6 4" />

    <!-- Slot borders to highlight photograph containers -->
    ${layout.slots
      .map(
        (s) => `
      <rect x="${s.x - 4}" y="${s.y - 4}" width="${s.width + 8}" height="${s.height + 8}" rx="${(s.borderRadius || 8) + 2}" fill="none" stroke="#3D2E26" stroke-width="3" opacity="0.8"/>
      <rect x="${s.x - 8}" y="${s.y - 8}" width="${s.width + 16}" height="${s.height + 16}" rx="${(s.borderRadius || 8) + 4}" fill="none" stroke="rgba(247, 200, 68, 0.3)" stroke-width="1"/>
    `
      )
      .join('')}

    <!-- Fall leaves decorations at corners and gaps -->
    <!-- Top Left Leaves -->
    <g transform="translate(24, 24)">
      <path d="M 10,10 C 25,-10 50,5 60,35 C 35,45 10,35 10,10 Z" fill="url(#autumnLeaf)" opacity="0.9"/>
      <path d="M 40,25 C 65,15 85,35 80,65 C 55,65 40,45 40,25 Z" fill="url(#autumnGold)" opacity="0.85"/>
      <circle cx="20" cy="50" r="4" fill="#E28743" />
      <circle cx="35" cy="65" r="3" fill="#F7C844" />
    </g>

    <!-- Top Right Leaves -->
    <g transform="translate(${w - 80}, 24)">
      <path d="M 50,10 C 35,-10 10,5 0,35 C 25,45 50,35 50,10 Z" fill="url(#autumnGold)" opacity="0.85"/>
      <path d="M 20,25 C -5,15 -25,35 -20,65 C 5,65 20,45 20,25 Z" fill="url(#autumnLeaf)" opacity="0.9"/>
      <circle cx="40" cy="50" r="4" fill="#C25927" />
    </g>

    <!-- Bottom Branding / Text Banner matching reference image -->
    <g transform="translate(${w / 2}, ${bannerY})">
      <!-- Dark matte plaque -->
      <rect x="-${Math.min(w / 2 - 30, 240)}" y="-10" width="${Math.min(w - 60, 480)}" height="130" rx="16" fill="rgba(24, 18, 14, 0.94)" stroke="url(#autumnGold)" stroke-width="2"/>
      
      <!-- Foliage spray on plaque -->
      <path d="M -180,60 C -160,30 -130,45 -125,75 C -150,85 -175,75 -180,60 Z" fill="url(#autumnLeaf)" opacity="0.9"/>
      <path d="M 180,60 C 160,30 130,45 125,75 C 150,85 175,75 180,60 Z" fill="url(#autumnGold)" opacity="0.9"/>

      <!-- Handwritten Title -->
      <text x="0" y="42" font-family="'Georgia', serif" font-size="${w > 800 ? '42' : '32'}" font-style="italic" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="3">${title}</text>
      
      <!-- Subtitle line -->
      <text x="0" y="78" font-family="'JetBrains Mono', monospace" font-size="${w > 800 ? '16' : '13'}" font-weight="600" fill="#F7C844" text-anchor="middle" letter-spacing="4">${subtitle.toUpperCase()}</text>
      <circle cx="-90" cy="74" r="2.5" fill="#E28743"/>
      <circle cx="90" cy="74" r="2.5" fill="#E28743"/>
    </g>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Generates wedding theme overlay for any layout
 */
export function createWeddingThemeOverlay(
  layoutType: FrameLayoutType,
  coupleName = 'Sarah & Dimas',
  date = '12 . 09 . 2026'
): string {
  const layout = getFrameLayout(layoutType);
  const w = layout.canvasWidth;
  const h = layout.canvasHeight;
  const bannerY = h - 180;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs>
      <linearGradient id="weddingGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F6D365"/>
        <stop offset="50%" stop-color="#FDA085"/>
        <stop offset="100%" stop-color="#E5B25D"/>
      </linearGradient>
    </defs>

    <!-- Outer delicate gold border -->
    <rect x="20" y="20" width="${w - 40}" height="${h - 40}" rx="12" fill="none" stroke="url(#weddingGold)" stroke-width="3" opacity="0.9"/>
    <rect x="30" y="30" width="${w - 60}" height="${h - 60}" rx="8" fill="none" stroke="#F6D365" stroke-width="1.5" stroke-dasharray="8 6" opacity="0.6"/>

    <!-- Slot borders -->
    ${layout.slots
      .map(
        (s) => `
      <rect x="${s.x - 3}" y="${s.y - 3}" width="${s.width + 6}" height="${s.height + 6}" rx="${(s.borderRadius || 8) + 1}" fill="none" stroke="#F6D365" stroke-width="2" opacity="0.8"/>
    `
      )
      .join('')}

    <!-- Corner flourishes -->
    <path d="M 20,60 L 60,20 M 30,30 L 70,30 M 30,30 L 30,70" stroke="url(#weddingGold)" stroke-width="2" fill="none"/>
    <path d="M ${w - 20},60 L ${w - 60},20 M ${w - 30},30 L ${w - 70},30 M ${w - 30},30 L ${w - 30},70" stroke="url(#weddingGold)" stroke-width="2" fill="none"/>

    <!-- Bottom Event Plaque -->
    <g transform="translate(${w / 2}, ${bannerY})">
      <rect x="-${Math.min(w / 2 - 30, 220)}" y="-10" width="${Math.min(w - 60, 440)}" height="110" rx="14" fill="rgba(12, 14, 20, 0.88)" stroke="url(#weddingGold)" stroke-width="1.5" />
      <text x="0" y="34" font-family="'Plus Jakarta Sans', serif" font-size="${w > 800 ? '28' : '22'}" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">${coupleName}</text>
      <text x="0" y="66" font-family="'JetBrains Mono', monospace" font-size="${w > 800 ? '13' : '11'}" font-weight="500" fill="#F6D365" text-anchor="middle" letter-spacing="4">${date}</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Generates modern minimalist white studio overlay
 */
export function createMinimalistThemeOverlay(layoutType: FrameLayoutType): string {
  const layout = getFrameLayout(layoutType);
  const w = layout.canvasWidth;
  const h = layout.canvasHeight;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <rect x="18" y="18" width="${w - 36}" height="${h - 36}" rx="14" fill="none" stroke="#FFFFFF" stroke-width="3" opacity="0.85"/>
    ${layout.slots
      .map(
        (s) => `
      <rect x="${s.x - 3}" y="${s.y - 3}" width="${s.width + 6}" height="${s.height + 6}" rx="${s.borderRadius || 8}" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.75"/>
    `
      )
      .join('')}
    <!-- Bottom Studio Label -->
    <g transform="translate(${w / 2}, ${h - 80})">
      <rect x="-140" y="-18" width="280" height="36" rx="18" fill="rgba(0,0,0,0.75)" stroke="#FFFFFF" stroke-width="1.5" />
      <text x="0" y="5" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="5">SNAPMOMENT • STUDIO</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
