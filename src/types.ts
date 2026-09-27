/**
 * Data models designed for seamless future Supabase / PostgreSQL persistence.
 */

export type SessionStatus = 'draft' | 'preview' | 'paid';

export type PaymentStatus = 'pending' | 'settlement' | 'success' | 'failed';

export type FrameLayoutType =
  | 'strip-3'       // 3 foto vertikal (Korean Photostrip)
  | 'strip-4'       // 4 foto vertikal (Classic Photostrip)
  | 'strip-2'       // 2 foto vertikal
  | 'grid-4'        // 4 foto (2x2 grid)
  | 'grid-6'        // 6 foto (2x3 grid)
  | 'wide-3'        // 3 foto horizontal / wide
  | 'single';       // 1 foto portrait / polaroid

export interface LayoutSlot {
  index: number;
  x: number;      // percentage (0 - 100)
  y: number;      // percentage (0 - 100)
  width: number;  // percentage (0 - 100)
  height: number; // percentage (0 - 100)
  label?: string;
  borderRadius?: number;
}

export interface PhotoboothLayout {
  id: string;
  name: string;
  ratio: string;         // e.g. '1:3', '3:10', '3:4', '4:5'
  canvas_width: number;  // pixel width e.g. 600, 1200, 1080
  canvas_height: number; // pixel height e.g. 1800, 2000, 1550, 1350
  photo_count: number;   // count of photo slots e.g. 3, 4, 1
  slots: LayoutSlot[];   // slot positions in percent (0 - 100)
}

export interface PhotoSlotDefinition {
  index: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

export interface FrameLayoutDefinition {
  type: FrameLayoutType;
  name: string;
  badge: string;
  description: string;
  photoCount: number;
  canvasWidth: number;
  canvasHeight: number;
  aspectRatioClass: string;
  slots: PhotoSlotDefinition[];
}

export interface FrameTheme {
  id: string;
  name: string;
  event_id: string;
  sort_order?: number;
  is_active?: boolean;
  category?: string;
  description?: string;
  created_at?: string;
  image_url?: string;
  variants_count?: number;
  slots_count?: number;
  layout?: PhotoboothLayout;
}

export interface FrameLayoutItem {
  id: string;
  frame_id: string;
  layout_id: string;
  image_url: string;
  category?: string;
  created_at?: string;
  layout?: PhotoboothLayout;
  frame?: FrameTheme;
}

export interface CustomDecorationItem {
  id: string;
  type: 'text' | 'emoji';
  content: string; // Teks tulisan atau karakter emoji
  x: number; // Persentase posisi horizontal (0 - 100%)
  y: number; // Persentase posisi vertikal (0 - 100%)
  fontSize: number; // Skala ukuran font dasar (misal 20 - 72)
  fontStylePreset: '3d' | 'cartoon' | 'cursive' | 'serif' | 'modern' | 'retro';
  color: string; // Hex warna teks
  outlineColor: string; // Hex outline atau 3D shadow color
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  align?: 'left' | 'center' | 'right';
  rotation?: number; // Derajat rotasi (-180 sampai 180)
}

export interface SlotAdjustment {
  panX: number; // offset X in percentage (-80% to +80%, 0 is centered)
  panY: number; // offset Y in percentage (-80% to +80%, 0 is centered)
  zoom: number; // zoom scale factor (0.8 to 3.0, default 1.0)
  rotation?: number; // optional rotation in degrees
  x?: number; // Free-space center X position in % (0 - 100)
  y?: number; // Free-space center Y position in % (0 - 100)
  width?: number; // Free-space width in % of canvas (default e.g. 50-80%)
  height?: number; // Free-space height in % of canvas (default e.g. 25-40%)
  ratioSynced?: boolean; // Flag if width & height were computed from photo capture view ratio
}

export type SlotAdjustmentsMap = { [slotIndex: number]: SlotAdjustment };

export type CameraOrientation = 'portrait' | 'landscape' | 'wide';

export interface PhotoboothSession {
  id: string;
  timestamp: string; // ISO string
  cameraOrientation?: CameraOrientation; // Orientasi rasio view kamera (portrait 3:4, landscape 4:3, wide 16:9)
  fotoOriginal: string; // Fallback / primary photo
  capturedPhotos: string[]; // Captured photos (exact photo_count)
  slotAssignments: { [slotIndex: number]: string }; // Map slotIndex -> photo data URL
  slotAdjustments?: SlotAdjustmentsMap; // Pergeseran (pan X/Y) & Zoom per slot foto
  filterDipilih: string; // e.g. 'vintage', 'noir', 'normal'
  frameDipilih?: string; // Frame theme ID
  frame_layout_id?: string; // Specific combination row in frame_layouts table
  selectedTheme?: FrameTheme;
  selectedFrameLayout?: FrameLayoutItem;
  layoutType?: FrameLayoutType; // Layout type fallback
  layout?: PhotoboothLayout; // The active layout structure
  status: SessionStatus;
  eventId: string;
  watermarkedPhoto?: string;
  finalPhoto?: string;
  decorations?: CustomDecorationItem[]; // Custom teks dan emoji stiker yang ditambahkan pengguna
  selectedPackage?: 'digital' | 'print'; // Paket yang dipilih pengguna
  boomerangEnabled?: boolean; // Apakah sesi ini merekam klip boomerang
  slotBoomerangConfig?: { [slotIndex: number]: boolean }; // Status aktif/nonaktif Boomerang per slot foto
  boomerangClips?: string[]; // Video URL / Data URL Boomerang per-slot
  slotBoomerangs?: { [slotIndex: number]: string }; // Map slotIndex -> video URL boomerang
  boomerangVideoUrl?: string; // Video Boomerang utama / gabungan untuk softfile
  animatedFrameVideoUrl?: string; // Video komposit seluruh frame dengan slot bergerak
}

export interface FrameLayoutVariant {
  layoutType: FrameLayoutType;
  imageUrl: string;
  slotsCount: number;
}

export interface FrameConfig {
  id: string;
  nama: string;
  urlGambar: string; // Transparent PNG dekoratif
  eventId: string; // Untuk support multi-event di database Supabase
  category?: string;
  description?: string;
  accentColor?: string;
  layout_id?: string; // Foreign key ke tabel layouts di Supabase
  layout?: PhotoboothLayout; // Objek layout yang terhubung
  layoutType?: FrameLayoutType;
  slotsCount?: number;
  sort_order?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface PhotoboothOrder {
  id: string;
  sessionId: string;
  harga: number; // e.g. 20000 (IDR)
  statusPembayaran: PaymentStatus;
  waktuCheckout: string; // ISO string
  paymentMethod?: string; // e.g. 'Tunai (Kasir)', 'QRIS', 'Gratis Event'
  transactionId?: string; // Reference id from Midtrans / Xendit / Cash
  selectedPackage?: 'digital' | 'print';
}

export interface FilterPreset {
  id: string;
  nama: string;
  tagline: string;
  cssFilter: string;
  // Canvas pixel manipulation settings
  brightness: number; // 1 = 100%
  contrast: number; // 1 = 100%
  saturation: number; // 1 = 100%
  sepia: number; // 0 to 1
  grayscale: number; // 0 to 1
  hueRotate: number; // degrees
  tint?: { r: number; g: number; b: number; alpha: number };
  vignette?: {
    intensity: number;    // Darkness factor at outer edges (0.0 to 1.0)
    innerRadius?: number; // Fraction where center light is 100% clear (e.g. 0.25 to 0.35)
    outerRadius?: number; // Fraction where darkness peaks (e.g. 0.85 to 0.98)
  };
}

export interface EventConfig {
  id: string;
  nama: string;
  subtitle: string;
  tanggal: string;
  lokasi: string;
  hargaPerFoto: number; // default / fallback (misal Rp 20.000)
  hargaDigital?: number; // Harga paket softfile digital (misal Rp 10.000 atau Rp 0)
  hargaPrint?: number; // Harga paket cetak fisik + digital (misal Rp 25.000 atau Rp 0)
  isFreeEvent?: boolean; // Jika true / harga 0, lewati pembayaran (Gratis)
  promoBadge?: string; // Teks badge promo, misal: "Promo Opening Studio"
  promoDescription?: string; // Keterangan promo
  paymentMethodsAllowed?: 'all' | 'cash' | 'digital'; // 'all' (Tunai & Digital), 'cash' (Tunai Saja), 'digital' (QRIS Saja)
  packagesAllowed?: 'both' | 'digital_only' | 'print_only'; // 'both' (Tampilkan Keduanya), 'digital_only' (Hanya Paket Digital), 'print_only' (Hanya Paket Cetak Fisik)
  cashInstruction?: string; // Petunjuk bayar tunai
  tipeEvent: 'Wedding' | 'Birthday' | 'Corporate' | 'Party' | string;
  boomerangEnabled?: boolean; // Aktifkan sesi Boomerang di samping foto cetak
}

export type StepKey =
  | 'event-info'
  | 'theme-select'
  | 'layout-select'
  | 'camera'
  | 'filter'
  | 'slotting'
  | 'overlay'
  | 'preview-locked'
  | 'checkout'
  | 'final'
  | 'step-1-event'
  | 'step-2-theme'
  | 'step-3-layout'
  | 'step-4-camera'
  | 'step-5-filter'
  | 'step-6-slotting'
  | 'step-7-overlay'
  | 'step-8-preview-locked'
  | 'step-9-checkout'
  | 'step-10-final'
  | 'landing';
