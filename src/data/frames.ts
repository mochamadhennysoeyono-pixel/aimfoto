import { FrameConfig } from '../types';
import { DEFAULT_LAYOUTS } from './defaultLayouts';
import {
  createAutumnThemeOverlay,
  createWeddingThemeOverlay,
  createMinimalistThemeOverlay,
} from './frameLayouts';

/**
 * Default Frame Configurations
 * 1 Frame = 1 Desain Dekoratif yang terhubung ke 1 Layout struktur.
 */
export const FRAMES_CONFIG: FrameConfig[] = [
  {
    id: 'frame-autumn-strip3',
    nama: 'Autumn Korean Foliage (Strip 3)',
    category: 'autumn',
    eventId: 'evt-autumn-default',
    urlGambar: createAutumnThemeOverlay('strip-3', 'HELLO AUTUMN', 'Season of Colors'),
    description: 'Tema dedaunan musim gugur bernuansa oranye hangat ala photobooth Korea.',
    accentColor: '#E28743',
    layout_id: DEFAULT_LAYOUTS[0].id,
    layout: DEFAULT_LAYOUTS[0], // Strip 3 Foto
    layoutType: 'strip-3',
    slotsCount: 3,
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'frame-wedding-strip3',
    nama: 'Royal Gold & Floral Wedding (Strip 3)',
    category: 'wedding',
    eventId: 'evt-wedding-default',
    urlGambar: createWeddingThemeOverlay('strip-3', 'Sarah & Dimas', '12 . 09 . 2026'),
    description: 'Aksen list emas mewah dengan ornamen sudut untuk pesta pernikahan & anniversary.',
    accentColor: '#F6D365',
    layout_id: DEFAULT_LAYOUTS[0].id,
    layout: DEFAULT_LAYOUTS[0], // Strip 3 Foto
    layoutType: 'strip-3',
    slotsCount: 3,
    sort_order: 2,
    is_active: true,
  },
  {
    id: 'frame-autumn-strip4',
    nama: 'Autumn Korean Foliage (Strip 4)',
    category: 'autumn',
    eventId: 'evt-autumn-default',
    urlGambar: createAutumnThemeOverlay('strip-4', 'HELLO AUTUMN', 'Season of Colors'),
    description: 'Strip 4 foto vertikal klasik bertema autumn foliage hangat.',
    accentColor: '#E28743',
    layout_id: DEFAULT_LAYOUTS[1].id,
    layout: DEFAULT_LAYOUTS[1], // Strip 4 Foto
    layoutType: 'strip-4',
    slotsCount: 4,
    sort_order: 3,
    is_active: true,
  },
  {
    id: 'frame-minimalist-grid4',
    nama: 'Minimalist Black & White (Grid 4)',
    category: 'minimalist',
    eventId: 'evt-global',
    urlGambar: createMinimalistThemeOverlay('grid-4'),
    description: 'Garis bingkai bersih minimalis gaya studio foto monokrom 4 foto grid.',
    accentColor: '#FFFFFF',
    layout_id: DEFAULT_LAYOUTS[2].id,
    layout: DEFAULT_LAYOUTS[2], // Grid 4 Foto
    layoutType: 'grid-4',
    slotsCount: 4,
    sort_order: 4,
    is_active: true,
  },
  {
    id: 'frame-minimalist-single',
    nama: 'Single Portrait Studio (1 Foto)',
    category: 'minimalist',
    eventId: 'evt-global',
    urlGambar: createMinimalistThemeOverlay('single'),
    description: 'Frame polaroid portrait bersih untuk 1 foto solo atau couple.',
    accentColor: '#FFFFFF',
    layout_id: DEFAULT_LAYOUTS[3].id,
    layout: DEFAULT_LAYOUTS[3], // Single Portrait
    layoutType: 'single',
    slotsCount: 1,
    sort_order: 5,
    is_active: true,
  },
];
