/**
 * Types and definitions for AR Live Face Filters
 */

export type ARFilterId =
  | 'none'
  | 'sunglasses'
  | 'heart-shades'
  | 'cat-ears'
  | 'party-hat'
  | 'angel-halo'
  | 'anime-blush'
  | 'mustache'
  | 'clown-nose'
  | 'bunny-ears';

export interface ARFilterDefinition {
  id: ARFilterId;
  name: string;
  emoji: string;
  category: 'glasses' | 'hats' | 'cute' | 'fun';
  description: string;
}

export interface DetectedFace {
  x: number; // Center X of face relative to canvas (0 to 1)
  y: number; // Center Y of face relative to canvas (0 to 1)
  width: number; // Face width relative to canvas (0 to 1)
  height: number; // Face height relative to canvas (0 to 1)
  rollAngle: number; // Tilt angle in radians (head roll)
  landmarks?: {
    leftEye?: { x: number; y: number };
    rightEye?: { x: number; y: number };
    noseTip?: { x: number; y: number };
    mouth?: { x: number; y: number };
  };
}

export const AR_FILTERS: ARFilterDefinition[] = [
  {
    id: 'none',
    name: 'Asli',
    emoji: '✨',
    category: 'cute',
    description: 'Tanpa filter live',
  },
  {
    id: 'sunglasses',
    name: 'Retro Shades',
    emoji: '🕶️',
    category: 'glasses',
    description: 'Kacamata hitam retro keren',
  },
  {
    id: 'heart-shades',
    name: 'Love Shades',
    emoji: '💖',
    category: 'glasses',
    description: 'Kacamata pink bentuk hati',
  },
  {
    id: 'cat-ears',
    name: 'Kucing Lucu',
    emoji: '🐱',
    category: 'cute',
    description: 'Bando telinga kucing + hidung pink',
  },
  {
    id: 'bunny-ears',
    name: 'Kelinci Imut',
    emoji: '🐰',
    category: 'cute',
    description: 'Telinga kelinci berbulu putih pink',
  },
  {
    id: 'anime-blush',
    name: 'Anime Blush',
    emoji: '🌸',
    category: 'cute',
    description: 'Pipi merona manga + bunga sakura',
  },
  {
    id: 'party-hat',
    name: 'Topi Pesta',
    emoji: '🥳',
    category: 'hats',
    description: 'Topi ulang tahun kerucut glitter',
  },
  {
    id: 'angel-halo',
    name: 'Malaikat Halo',
    emoji: '😇',
    category: 'hats',
    description: 'Cincin cahaya malaikat emas bercahaya',
  },
  {
    id: 'mustache',
    name: 'Kumis Retro',
    emoji: '🥸',
    category: 'fun',
    description: 'Kumis vintage bangsawan',
  },
  {
    id: 'clown-nose',
    name: 'Badut Ceria',
    emoji: '🤡',
    category: 'fun',
    description: 'Hidung merah badut & rambut pelangi',
  },
];
