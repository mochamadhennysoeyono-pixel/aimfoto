import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Layers,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Eye,
  EyeOff,
  Type,
  Smile,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Trash2,
  Plus,
  RotateCw,
  Maximize2,
  Minimize2,
  Edit3,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Move,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import { FilterPreset, PhotoboothLayout, CustomDecorationItem, SlotAdjustment, SlotAdjustmentsMap } from '../types';
import { generateUuid } from '../utils/uuid';

interface Step7OverlayProps {
  photos: string[];
  slotAssignments: { [slotIndex: number]: string };
  layout: PhotoboothLayout;
  frameUrl?: string;
  themeName?: string;
  filter: FilterPreset;
  decorations?: CustomDecorationItem[];
  onUpdateDecorations: (decorations: CustomDecorationItem[]) => void;
  slotAdjustments?: SlotAdjustmentsMap;
  onUpdateSlotAdjustments?: (adjustments: SlotAdjustmentsMap) => void;
  onNext: () => void;
  onBack: () => void;
}

// Preset Gaya Font
const FONT_PRESETS = [
  { id: 'cartoon', name: 'Kartun Pop', family: "'Fredoka', cursive", desc: 'Komik outline tebal' },
  { id: '3d', name: '3D Block', family: "'Bungee', sans-serif", desc: 'Bayangan 3D timbul' },
  { id: 'cursive', name: 'Cursive', family: "'Pacifico', cursive", desc: 'Tulisan sambung manis' },
  { id: 'serif', name: 'Classy Serif', family: "'Playfair Display', serif", desc: 'Mewah & berkelas' },
  { id: 'modern', name: 'Modern Sans', family: "'Plus Jakarta Sans', sans-serif", desc: 'Clean & minimalis' },
  { id: 'retro', name: 'Retro Street', family: "'Righteous', cursive", desc: 'Vibe poster retro' },
] as const;

// Kategori & Pilihan Emoji
const EMOJI_CATEGORIES = [
  {
    name: '🎨 Doodle & Komik Pop',
    emojis: ['💭', '🗯️', '💬', '💥', '💫', '⚡', '🖍️', '✏️', '👓', '👀', '🎀', '🐾', '⭐', '✨', '🔥', '💯'],
  },
  {
    name: '🎉 Pesta & Selebrasi',
    emojis: ['🎉', '🥳', '🍾', '🥂', '✨', '🎈', '🎂', '👑', '🎊', '🪩'],
  },
  {
    name: '❤️ Cinta & Romantis',
    emojis: ['❤️', '💕', '💖', '💍', '💐', '🕊️', '💌', '💋', '🌹', '🫶'],
  },
  {
    name: '😎 Keren & Photobooth',
    emojis: ['😎', '🕶️', '✌️', '🤘', '🤙', '🤪', '🤩', '🔥', '📸', '🎩'],
  },
  {
    name: '🌸 Kartun & Lucu',
    emojis: ['🥺', '😻', '🐱', '🐰', '🌸', '🎀', '🧸', '🌈', '⭐', '🐶'],
  },
  {
    name: '⭐ Stiker & Simbol',
    emojis: ['💯', '🆒', '🪅', '🌟', '💫', '💥', '⚡', '🎯', '🎨', '🎵'],
  },
];

// Pilihan warna teks
const TEXT_COLORS = [
  { name: 'Kuning Emas', hex: '#FDE047' },
  { name: 'Putih Bersih', hex: '#FFFFFF' },
  { name: 'Kuning Lemon', hex: '#FEF08A' },
  { name: 'Soft Pink', hex: '#F472B6' },
  { name: 'Merah Muda Terang', hex: '#FB7185' },
  { name: 'Cyan Neon', hex: '#38BDF8' },
  { name: 'Lavender', hex: '#C084FC' },
  { name: 'Mint Hijau', hex: '#4ADE80' },
  { name: 'Hitam Pekat', hex: '#18181B' },
];

// Pilihan warna outline & shadow
const OUTLINE_COLORS = [
  { name: 'Hitam', hex: '#000000' },
  { name: 'Putih', hex: '#FFFFFF' },
  { name: 'Dark Amber', hex: '#78350F' },
  { name: 'Navy', hex: '#0F172A' },
  { name: 'Tanpa Outline', hex: 'transparent' },
];

export const Step7Overlay: React.FC<Step7OverlayProps> = ({
  photos,
  slotAssignments,
  layout,
  frameUrl,
  themeName,
  filter,
  decorations = [],
  onUpdateDecorations,
  slotAdjustments = {},
  onUpdateSlotAdjustments,
  onNext,
  onBack,
}) => {
  const [showOverlay, setShowOverlay] = useState(true);
  const [activeTab, setActiveTab] = useState<'text' | 'emoji' | 'adjust-photo' | 'layers'>('text');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedSlotToAdjust, setSelectedSlotToAdjust] = useState<number>(0);

  // Mode Rentangkan Canvas Full Layar
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  // Form states untuk input teks
  const [inputText, setInputText] = useState('');
  const [fontPreset, setFontPreset] = useState<'3d' | 'cartoon' | 'cursive' | 'serif' | 'modern' | 'retro'>('cartoon');
  const [textColor, setTextColor] = useState('#FDE047');
  const [outlineColor, setOutlineColor] = useState('#000000');
  const [fontSize, setFontSize] = useState(54);
  const [isBold, setIsBold] = useState(true);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [align, setAlign] = useState<'left' | 'center' | 'right'>('center');

  // Drag & Touch references
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const hasMovedRef = useRef(false);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);

  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    itemId: string | null;
    startX: number;
    startY: number;
    itemStartX: number;
    itemStartY: number;
  }>({
    isDragging: false,
    itemId: null,
    startX: 0,
    startY: 0,
    itemStartX: 0,
    itemStartY: 0,
  });

  const slots = layout.slots || [];
  const activeItem = decorations.find((d) => d.id === selectedItemId);

  // Sinkronkan form state saat elemen aktif berubah
  useEffect(() => {
    if (activeItem && activeItem.type === 'text') {
      setInputText(activeItem.content);
      setFontPreset(activeItem.fontStylePreset);
      setTextColor(activeItem.color);
      setOutlineColor(activeItem.outlineColor);
      setFontSize(activeItem.fontSize);
      setIsBold(!!activeItem.isBold);
      setIsItalic(!!activeItem.isItalic);
      setIsUnderline(!!activeItem.isUnderline);
      setAlign(activeItem.align || 'center');
    }
  }, [activeItem]);

  // Update item aktif secara langsung
  const handleUpdateActiveItem = useCallback(
    (updates: Partial<CustomDecorationItem>) => {
      if (!selectedItemId) return;
      const updated = decorations.map((item) => {
        if (item.id === selectedItemId) {
          return { ...item, ...updates };
        }
        return item;
      });
      onUpdateDecorations(updated);
    },
    [decorations, onUpdateDecorations, selectedItemId]
  );

  // Tambah Teks Baru
  const handleAddText = () => {
    const textToAdd = inputText.trim() || 'Teks Kustom';
    const newItem: CustomDecorationItem = {
      id: generateUuid(),
      type: 'text',
      content: textToAdd,
      x: 50,
      y: decorations.length === 0 ? 86 : 50,
      fontSize: fontSize || 54,
      fontStylePreset: fontPreset,
      color: textColor,
      outlineColor: outlineColor,
      isBold,
      isItalic,
      isUnderline,
      align,
      rotation: 0,
    };

    const updated = [...decorations, newItem];
    onUpdateDecorations(updated);
    setSelectedItemId(newItem.id);
    setActiveTab('text');
  };

  // Tambah atau Ganti Emoji
  const handleSelectEmoji = (emojiChar: string) => {
    if (activeItem && activeItem.type === 'emoji') {
      // Ganti emoji yang sedang dipilih
      handleUpdateActiveItem({ content: emojiChar });
    } else {
      // Tambah emoji baru
      const newItem: CustomDecorationItem = {
        id: generateUuid(),
        type: 'emoji',
        content: emojiChar,
        x: 50 + (Math.random() * 16 - 8),
        y: 50 + (Math.random() * 16 - 8),
        fontSize: 52,
        fontStylePreset: 'modern',
        color: '#FFFFFF',
        outlineColor: 'transparent',
        rotation: 0,
      };

      const updated = [...decorations, newItem];
      onUpdateDecorations(updated);
      setSelectedItemId(newItem.id);
      setActiveTab('emoji');
    }
  };

  // Ubah ukuran font/emoji (+/-)
  const handleAdjustSize = (delta: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeItem) return;
    const newSize = Math.max(18, Math.min(100, activeItem.fontSize + delta));
    handleUpdateActiveItem({ fontSize: newSize });
    setFontSize(newSize);
  };

  // Putar item (rotasi +15 derajat)
  const handleRotate = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeItem) return;
    const currentRot = activeItem.rotation || 0;
    const nextRot = (currentRot + 15) % 360;
    handleUpdateActiveItem({ rotation: nextRot });
  };

  // Duplikat Elemen
  const handleDuplicate = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const source = decorations.find((d) => d.id === id);
    if (!source) return;

    const cloned: CustomDecorationItem = {
      ...source,
      id: generateUuid(),
      x: Math.min(92, source.x + 4),
      y: Math.min(92, source.y + 4),
    };

    const updated = [...decorations, cloned];
    onUpdateDecorations(updated);
    setSelectedItemId(cloned.id);
    if (cloned.type === 'text') setActiveTab('text');
    if (cloned.type === 'emoji') setActiveTab('emoji');
  };

  // Hapus Elemen
  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = decorations.filter((d) => d.id !== id);
    onUpdateDecorations(updated);
    if (selectedItemId === id) {
      setSelectedItemId(null);
    }
  };

  // Seleksi & Mulai Geser Elemen (TIDAK AKAN LEPAS)
  const handleItemPointerDown = (item: CustomDecorationItem, e: React.PointerEvent) => {
    e.stopPropagation();
    hasMovedRef.current = false;
    setSelectedItemId(item.id);

    if (item.type === 'text') {
      setActiveTab('text');
    } else if (item.type === 'emoji') {
      setActiveTab('emoji');
    }

    setDragState({
      isDragging: true,
      itemId: item.id,
      startX: e.clientX,
      startY: e.clientY,
      itemStartX: item.x,
      itemStartY: item.y,
    });
  };

  // Gerakan saat menggeser elemen
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.isDragging || !dragState.itemId || !canvasContainerRef.current) return;

    const dxPixels = e.clientX - dragState.startX;
    const dyPixels = e.clientY - dragState.startY;

    if (Math.hypot(dxPixels, dyPixels) > 4) {
      hasMovedRef.current = true;
    }

    const rect = canvasContainerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    // Hitung pergerakan relatif dalam persen
    const deltaXPercent = (dxPixels / rect.width) * 100;
    const deltaYPercent = (dyPixels / rect.height) * 100;

    const newX = Math.max(5, Math.min(95, dragState.itemStartX + deltaXPercent));
    const newY = Math.max(5, Math.min(95, dragState.itemStartY + deltaYPercent));

    onUpdateDecorations(
      decorations.map((item) => {
        if (item.id === dragState.itemId) {
          return { ...item, x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 };
        }
        return item;
      })
    );
  };

  // Lepaskan pointer (seleksi tetap terjaga!)
  const handlePointerUp = () => {
    if (dragState.isDragging) {
      setDragState((prev) => ({ ...prev, isDragging: false, itemId: null }));
    }
  };

  // Pinch-to-zoom multi-touch di layar HP saat direntangkan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      pinchStartDistanceRef.current = dist;
      pinchStartScaleRef.current = zoomScale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistanceRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = currentDist / pinchStartDistanceRef.current;
      const nextScale = Math.min(3.5, Math.max(0.7, pinchStartScaleRef.current * ratio));
      setZoomScale(Math.round(nextScale * 100) / 100);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      pinchStartDistanceRef.current = null;
    }
  };

  // Klik di latar belakang kosong canvas (hanya deselect jika sengaja mengetuk area kosong)
  const handleCanvasBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !hasMovedRef.current) {
      setSelectedItemId(null);
    }
  };

  // Kontrol zoom manual
  const handleZoom = (delta: number) => {
    setZoomScale((prev) => {
      const next = Math.min(3.5, Math.max(0.7, prev + delta));
      return Math.round(next * 10) / 10;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1);
  };

  // RENDER CANVAS PHOTOBOTH
  const renderCanvasElement = () => (
    <div
      ref={canvasContainerRef}
      onClick={handleCanvasBackgroundClick}
      className="relative max-h-full max-w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl select-none touch-none transition-transform duration-75 [container-type:inline-size]"
      style={{
        aspectRatio: `${layout.canvas_width || 1200} / ${layout.canvas_height || 1800}`,
        height: '100%',
        transform: isCanvasExpanded ? `scale(${zoomScale})` : 'none',
        transformOrigin: 'center center',
      }}
    >
      {/* Layer 1: Base Background */}
      <div className="absolute inset-0 bg-[#0c0e15] pointer-events-none" />

      {/* Layer 2: Slotted Photos (Sesuai rasio view pengambilan, anti-crop) */}
      {slots.map((slot, i) => {
        const slotKey = i;
        const photoSrc = slotAssignments[slotKey] || photos[i] || photos[0];
        const adj = slotAdjustments[slotKey] || { panX: 0, panY: 0, zoom: 1 };
        const posX = adj?.x !== undefined ? adj.x : slot.x;
        const posY = adj?.y !== undefined ? adj.y : slot.y;

        const canvasAspect = (layout.canvas_width || 1200) / (layout.canvas_height || 1800);
        const isLandscape = (layout.canvas_width || 1200) >= (layout.canvas_height || 1800);
        let baseW = adj?.width !== undefined ? adj.width : slot.width;
        if (!baseW) {
          if (slots.length === 1) baseW = 84;
          else if (slots.length === 2) baseW = isLandscape ? 44 : 76;
          else if (slots.length <= 4) baseW = isLandscape ? 38 : 44;
          else baseW = isLandscape ? 28 : 40;
        }
        const zoom = Math.max(0.5, Math.min(2.5, adj?.zoom ?? 1));
        const baseH = adj?.height !== undefined ? adj.height : (baseW * canvasAspect) / 1.0;
        const posW = baseW * zoom;
        const posH = baseH * zoom;

        return (
          <div
            key={slotKey}
            style={{
              position: 'absolute',
              left: `${posX}%`,
              top: `${posY}%`,
              width: `${posW}%`,
              height: `${posH}%`,
              borderRadius: 0,
            }}
            className="overflow-hidden pointer-events-none rounded-none"
          >
            {photoSrc ? (
              <img
                src={photoSrc}
                alt={`Slot ${i + 1}`}
                className="w-full h-full object-contain pointer-events-none"
                style={{
                  filter: filter ? filter.cssFilter : 'none',
                }}
              />
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600 font-mono text-[10px]">
                Foto {i + 1}
              </div>
            )}

            {/* Optional Tint */}
            {filter?.tint && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundColor: `rgba(${filter.tint.r}, ${filter.tint.g}, ${filter.tint.b}, ${filter.tint.alpha})`,
                }}
              />
            )}

            {/* Portrait Spotlight Vignette */}
            {filter?.vignette && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${(filter.vignette.innerRadius ?? 0.28) * 100}%, rgba(0,0,0,${filter.vignette.intensity * 0.35}) 50%, rgba(0,0,0,${filter.vignette.intensity * 0.70}) 75%, rgba(0,0,0,${filter.vignette.intensity}) ${(filter.vignette.outerRadius ?? 0.95) * 100}%)`,
                }}
              />
            )}
          </div>
        );
      })}

      {/* Layer 3: PNG Frame Overlay */}
      {showOverlay && frameUrl && (
        <img
          src={frameUrl}
          alt="Frame Overlay"
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-20"
        />
      )}

      {/* Layer 4: Custom Text & Emoji Decorations */}
      {decorations.map((item) => {
        const isSelected = item.id === selectedItemId;

        // Tentukan styling teks
        let fontFamilyCss = "'Plus Jakarta Sans', sans-serif";
        let textShadowCss = 'none';

        if (item.type === 'text') {
          if (item.fontStylePreset === 'cartoon') {
            fontFamilyCss = "'Fredoka', cursive";
            textShadowCss = `
              -0.06em -0.06em 0 ${item.outlineColor || '#000'},
               0.06em -0.06em 0 ${item.outlineColor || '#000'},
              -0.06em  0.06em 0 ${item.outlineColor || '#000'},
               0.06em  0.06em 0 ${item.outlineColor || '#000'},
               0px     0.09em 0 ${item.outlineColor || '#000'}
            `;
          } else if (item.fontStylePreset === '3d') {
            fontFamilyCss = "'Bungee', sans-serif";
            textShadowCss = `
              0.025em 0.025em 0 ${item.outlineColor || '#000'},
              0.05em  0.05em  0 ${item.outlineColor || '#000'},
              0.075em 0.075em 0 ${item.outlineColor || '#000'},
              0.1em   0.1em   0 ${item.outlineColor || '#000'},
              0.13em  0.13em  0.04em rgba(0,0,0,0.5)
            `;
          } else if (item.fontStylePreset === 'cursive') {
            fontFamilyCss = "'Pacifico', cursive";
          } else if (item.fontStylePreset === 'serif') {
            fontFamilyCss = "'Playfair Display', serif";
          } else if (item.fontStylePreset === 'retro') {
            fontFamilyCss = "'Righteous', cursive";
            textShadowCss = '0.05em 0.05em 0 #000';
          }

          if (
            item.outlineColor &&
            item.outlineColor !== 'transparent' &&
            item.fontStylePreset !== 'cartoon' &&
            item.fontStylePreset !== '3d'
          ) {
            textShadowCss = `
              -0.035em -0.035em 0 ${item.outlineColor},
               0.035em -0.035em 0 ${item.outlineColor},
              -0.035em  0.035em 0 ${item.outlineColor},
               0.035em  0.035em 0 ${item.outlineColor}
            `;
          }
        }

        return (
          <div
            key={item.id}
            onPointerDown={(e) => handleItemPointerDown(item, e)}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedItemId(item.id);
            }}
            style={{
              position: 'absolute',
              left: `${item.x}%`,
              top: `${item.y}%`,
              transform: `translate(-50%, -50%) rotate(${item.rotation || 0}deg)`,
              zIndex: isSelected ? 45 : 35,
              cursor: 'move',
            }}
            className={`group select-none transition-shadow ${
              isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black rounded-lg shadow-xl' : ''
            }`}
          >
            {/* Floating Quick Action Toolbar saat elemen sedang aktif */}
            {isSelected && (
              <div
                className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-950/95 border border-amber-400/90 px-2 py-1 rounded-full shadow-2xl z-50 pointer-events-auto whitespace-nowrap"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[10px] text-amber-300 font-mono font-bold px-1 flex items-center gap-0.5">
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>Edit</span>
                </span>

                {/* Tombol perkecil ukuran */}
                <button
                  onClick={(e) => handleAdjustSize(-3, e)}
                  className="w-5 h-5 flex items-center justify-center text-zinc-300 hover:text-amber-400 bg-zinc-900 rounded-full text-xs font-bold transition-colors cursor-pointer border border-zinc-700"
                  title="Perkecil Ukuran"
                >
                  -
                </button>

                {/* Tombol perbesar ukuran */}
                <button
                  onClick={(e) => handleAdjustSize(3, e)}
                  className="w-5 h-5 flex items-center justify-center text-zinc-300 hover:text-amber-400 bg-zinc-900 rounded-full text-xs font-bold transition-colors cursor-pointer border border-zinc-700"
                  title="Perbesar Ukuran"
                >
                  +
                </button>

                {/* Tombol putar */}
                <button
                  onClick={handleRotate}
                  className="p-1 text-zinc-300 hover:text-amber-400 rounded-full transition-colors cursor-pointer"
                  title="Putar Sudut"
                >
                  <RotateCw className="w-3 h-3" />
                </button>

                {/* Tombol duplikat */}
                <button
                  onClick={(e) => handleDuplicate(item.id, e)}
                  className="p-1 text-zinc-300 hover:text-amber-400 rounded-full transition-colors cursor-pointer"
                  title="Duplikat Elemen"
                >
                  <Copy className="w-3 h-3" />
                </button>

                {/* Tombol hapus */}
                <button
                  onClick={(e) => handleDelete(item.id, e)}
                  className="p-1 text-zinc-300 hover:text-rose-400 rounded-full transition-colors cursor-pointer"
                  title="Hapus Elemen"
                >
                  <Trash2 className="w-3 h-3" />
                </button>

                {/* Tombol Selesai Seleksi */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedItemId(null);
                  }}
                  className="p-1 text-emerald-400 hover:text-emerald-300 rounded-full transition-colors cursor-pointer"
                  title="Selesai Edit"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Konten Teks atau Emoji */}
            {item.type === 'emoji' ? (
              <span
                style={{
                  fontSize: `calc(${item.fontSize} * 100cqw / 1080)`,
                  lineHeight: 1,
                }}
                className="inline-block p-1 filter drop-shadow-md cursor-grab active:cursor-grabbing hover:scale-105 transition-transform"
              >
                {item.content}
              </span>
            ) : (
              <div
                style={{
                  fontFamily: fontFamilyCss,
                  color: item.color,
                  textShadow: textShadowCss,
                  fontSize: `calc(${item.fontSize} * 100cqw / 1080)`,
                  fontWeight: item.isBold ? 700 : 400,
                  fontStyle: item.isItalic ? 'italic' : 'normal',
                  textDecoration: item.isUnderline ? 'underline' : 'none',
                  textAlign: item.align || 'center',
                  lineHeight: 1.2,
                }}
                className="px-2 py-0.5 whitespace-pre font-normal tracking-wide cursor-grab active:cursor-grabbing hover:opacity-95"
              >
                {item.content || 'Teks Kosong'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // RENDER PANEL KONTROL / TOOLBAR DI BAWAH
  const renderControlPanel = () => (
    <div
      onClick={(e) => e.stopPropagation()}
      className="w-full bg-zinc-900/95 border border-zinc-800 rounded-2xl p-3 sm:p-4 space-y-3 shadow-2xl backdrop-blur-md"
    >
      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveTab('text')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'text'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span>Gaya Tulisan</span>
          </button>

          <button
            onClick={() => setActiveTab('emoji')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'emoji'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Emoji & Stiker</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('adjust-photo');
              setSelectedItemId(null);
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'adjust-photo'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
            <span>Pas-kan Foto</span>
          </button>

          <button
            onClick={() => setActiveTab('layers')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              activeTab === 'layers'
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Layer ({decorations.length})</span>
          </button>
        </div>

        {/* Status Elemen yang Dipilih */}
        {activeItem && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1">
              <Edit3 className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">Mengedit:</span>
              <span className="font-bold truncate max-w-[100px]">{activeItem.content}</span>
            </span>
            <button
              onClick={() => setSelectedItemId(null)}
              className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold cursor-pointer"
              title="Selesai menyesuaikan elemen ini"
            >
              Selesai
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: KUSTOMISASI TEKS */}
      {activeTab === 'text' && (
        <div className="space-y-3">
          {/* Input Teks */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                {activeItem && activeItem.type === 'text' ? 'Ubah Tulisan Terpilih:' : 'Ketik Tulisan Baru:'}
              </label>
              {activeItem && activeItem.type === 'text' && (
                <button
                  onClick={() => setSelectedItemId(null)}
                  className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                >
                  + Buat Tulisan Baru
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={activeItem && activeItem.type === 'text' ? activeItem.content : inputText}
                onChange={(e) => {
                  const val = e.target.value;
                  if (activeItem && activeItem.type === 'text') {
                    handleUpdateActiveItem({ content: val });
                  } else {
                    setInputText(val);
                  }
                }}
                placeholder="Contoh: Happy Birthday, Sweet 17..."
                className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />

              {(!activeItem || activeItem.type !== 'text') && (
                <button
                  onClick={handleAddText}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1 shadow-md shadow-amber-500/20 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Tambah</span>
                </button>
              )}
            </div>
          </div>

          {/* Pilihan Gaya Font */}
          <div>
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
              Pilih Gaya Font (3D, Kartun, Cursive, dll):
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {FONT_PRESETS.map((f) => {
                const isCurrent =
                  activeItem && activeItem.type === 'text'
                    ? activeItem.fontStylePreset === f.id
                    : fontPreset === f.id;

                return (
                  <button
                    key={f.id}
                    onClick={() => {
                      setFontPreset(f.id);
                      if (activeItem && activeItem.type === 'text') {
                        handleUpdateActiveItem({ fontStylePreset: f.id });
                      }
                    }}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      isCurrent
                        ? 'border-amber-400 bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <span style={{ fontFamily: f.family }} className="text-xs font-bold block truncate">
                      {f.name}
                    </span>
                    <span className="text-[9px] text-zinc-500 block truncate">{f.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format & Penataan Teks */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-800/80">
            {/* Bold, Italic, Underline */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => {
                  const nextVal = activeItem && activeItem.type === 'text' ? !activeItem.isBold : !isBold;
                  setIsBold(nextVal);
                  if (activeItem && activeItem.type === 'text') {
                    handleUpdateActiveItem({ isBold: nextVal });
                  }
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  (activeItem && activeItem.type === 'text' ? activeItem.isBold : isBold)
                    ? 'bg-amber-500/20 text-amber-400 font-bold'
                    : 'text-zinc-500 hover:text-white'
                }`}
                title="Tebal (Bold)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  const nextVal = activeItem && activeItem.type === 'text' ? !activeItem.isItalic : !isItalic;
                  setIsItalic(nextVal);
                  if (activeItem && activeItem.type === 'text') {
                    handleUpdateActiveItem({ isItalic: nextVal });
                  }
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  (activeItem && activeItem.type === 'text' ? activeItem.isItalic : isItalic)
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-zinc-500 hover:text-white'
                }`}
                title="Miring (Italic)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => {
                  const nextVal = activeItem && activeItem.type === 'text' ? !activeItem.isUnderline : !isUnderline;
                  setIsUnderline(nextVal);
                  if (activeItem && activeItem.type === 'text') {
                    handleUpdateActiveItem({ isUnderline: nextVal });
                  }
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  (activeItem && activeItem.type === 'text' ? activeItem.isUnderline : isUnderline)
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-zinc-500 hover:text-white'
                }`}
                title="Garis Bawah (Underline)"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Text Alignment */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => {
                  setAlign('left');
                  if (activeItem && activeItem.type === 'text') {
                    handleUpdateActiveItem({ align: 'left' });
                  }
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  (activeItem && activeItem.type === 'text' ? activeItem.align : align) === 'left'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-zinc-500 hover:text-white'
                }`}
                title="Rata Kiri"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setAlign('center');
                  if (activeItem && activeItem.type === 'text') {
                    handleUpdateActiveItem({ align: 'center' });
                  }
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  (activeItem && activeItem.type === 'text' ? activeItem.align : align) === 'center'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-zinc-500 hover:text-white'
                }`}
                title="Rata Tengah"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setAlign('right');
                  if (activeItem && activeItem.type === 'text') {
                    handleUpdateActiveItem({ align: 'right' });
                  }
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  (activeItem && activeItem.type === 'text' ? activeItem.align : align) === 'right'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-zinc-500 hover:text-white'
                }`}
                title="Rata Kanan"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Slider Ukuran */}
            <div className="flex items-center gap-2 bg-zinc-950 px-2.5 py-1 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 font-mono">
              <span>Ukuran</span>
              <input
                type="range"
                min="20"
                max="72"
                value={activeItem && activeItem.type === 'text' ? activeItem.fontSize : fontSize}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value, 10);
                  setFontSize(newSize);
                  if (activeItem && activeItem.type === 'text') {
                    handleUpdateActiveItem({ fontSize: newSize });
                  }
                }}
                className="w-20 accent-amber-500 cursor-pointer"
              />
              <span className="text-amber-400 font-bold w-5">
                {activeItem && activeItem.type === 'text' ? activeItem.fontSize : fontSize}
              </span>
            </div>
          </div>

          {/* Pilihan Warna Teks & Outline */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {/* Warna Teks */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Warna Teks:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {TEXT_COLORS.map((c) => {
                  const isCurrent =
                    activeItem && activeItem.type === 'text' ? activeItem.color === c.hex : textColor === c.hex;

                  return (
                    <button
                      key={c.name}
                      onClick={() => {
                        setTextColor(c.hex);
                        if (activeItem && activeItem.type === 'text') {
                          handleUpdateActiveItem({ color: c.hex });
                        }
                      }}
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 rounded-lg border border-zinc-700 transition-all shrink-0 cursor-pointer ${
                        isCurrent ? 'scale-110 ring-2 ring-amber-400 shadow-md' : 'opacity-85 hover:opacity-100'
                      }`}
                      title={c.name}
                    />
                  );
                })}
              </div>
            </div>

            {/* Warna Outline */}
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-zinc-400 uppercase">Outline/3D:</span>
              <div className="flex items-center gap-1.5">
                {OUTLINE_COLORS.map((oc) => {
                  const isCurrent =
                    activeItem && activeItem.type === 'text'
                      ? activeItem.outlineColor === oc.hex
                      : outlineColor === oc.hex;

                  return (
                    <button
                      key={oc.name}
                      onClick={() => {
                        setOutlineColor(oc.hex);
                        if (activeItem && activeItem.type === 'text') {
                          handleUpdateActiveItem({ outlineColor: oc.hex });
                        }
                      }}
                      style={{ backgroundColor: oc.hex === 'transparent' ? '#27272a' : oc.hex }}
                      className={`w-6 h-6 rounded-lg border border-zinc-600 transition-all shrink-0 cursor-pointer ${
                        isCurrent ? 'scale-110 ring-2 ring-amber-400 shadow-md' : 'opacity-85 hover:opacity-100'
                      }`}
                      title={oc.name}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STIKER EMOJI */}
      {activeTab === 'emoji' && (
        <div className="space-y-3">
          {activeItem && activeItem.type === 'emoji' && (
            <div className="p-2.5 bg-zinc-950 rounded-xl border border-amber-500/30 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{activeItem.content}</span>
                <span className="text-xs text-zinc-300">Emoji Terpilih</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={(e) => handleAdjustSize(-4, e)}
                  className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 font-bold text-zinc-300 hover:text-white"
                >
                  A-
                </button>
                <button
                  onClick={(e) => handleAdjustSize(4, e)}
                  className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 font-bold text-zinc-300 hover:text-white"
                >
                  A+
                </button>
                <button
                  onClick={handleRotate}
                  className="p-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-amber-400"
                  title="Putar Sudut"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setSelectedItemId(null)}
                  className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 hover:text-white"
                >
                  + Tambah Baru
                </button>
              </div>
            </div>
          )}

          <div className="text-[11px] text-zinc-400">
            {activeItem && activeItem.type === 'emoji'
              ? 'Ketuk emoji di bawah untuk MENGGANTI emoji terpilih:'
              : 'Ketuk emoji di bawah untuk MENAMBAH ke fotomu:'}
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.name} className="bg-zinc-950/70 p-2 rounded-xl border border-zinc-800/80">
                <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider block mb-1">
                  {cat.name}
                </span>
                <div className="flex flex-wrap gap-2">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleSelectEmoji(emoji)}
                      className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-lg flex items-center justify-center hover:scale-125 active:scale-95 transition-all cursor-pointer border border-zinc-800/60"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DAFTAR LAYER ELEMEN */}
      {activeTab === 'layers' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>Daftar teks & emoji terpasang:</span>
            {decorations.length > 0 && (
              <button
                onClick={() => {
                  onUpdateDecorations([]);
                  setSelectedItemId(null);
                }}
                className="text-rose-400 hover:text-rose-300 text-[10px] font-mono cursor-pointer"
              >
                Hapus Semua
              </button>
            )}
          </div>

          {decorations.length === 0 ? (
            <div className="py-6 text-center text-zinc-500 text-xs">
              Belum ada tulisan atau stiker. Buka tab <span className="text-amber-400 font-bold">Gaya Tulisan</span> atau{' '}
              <span className="text-amber-400 font-bold">Emoji</span> untuk menambahkan!
            </div>
          ) : (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {decorations.map((item, idx) => {
                const isSelected = item.id === selectedItemId;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedItemId(item.id);
                      if (item.type === 'text') setActiveTab('text');
                      if (item.type === 'emoji') setActiveTab('emoji');
                    }}
                    className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-amber-400/80 bg-amber-500/15 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] font-mono text-zinc-500">#{idx + 1}</span>
                      {item.type === 'emoji' ? (
                        <span className="text-base">{item.content}</span>
                      ) : (
                        <span className="font-semibold truncate max-w-[140px]">{item.content}</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
                        {item.type === 'text' ? item.fontStylePreset : 'emoji'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleDuplicate(item.id, e)}
                        className="p-1 text-zinc-400 hover:text-amber-400 rounded transition-colors"
                        title="Duplikat"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="p-1 text-zinc-400 hover:text-rose-400 rounded transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PENYESUAIAN POSISI FOTO DI BINGKAI */}
      {activeTab === 'adjust-photo' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-300 font-semibold flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Pilih Slot Foto:
              </span>
              <div className="flex items-center gap-1">
                {slots.map((_, idx) => {
                  const isSelected = selectedSlotToAdjust === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedSlotToAdjust(idx)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-zinc-950 shadow-md scale-105'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-400">
                Pan X: {Math.round(slotAdjustments[selectedSlotToAdjust]?.panX || 0)}% | Y: {Math.round(slotAdjustments[selectedSlotToAdjust]?.panY || 0)}%
              </span>
              <button
                onClick={() => {
                  if (onUpdateSlotAdjustments) {
                    onUpdateSlotAdjustments({
                      ...slotAdjustments,
                      [selectedSlotToAdjust]: { panX: 0, panY: 0, zoom: 1 },
                    });
                  }
                }}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                title="Kembalikan foto slot ini ke tengah"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800">
            {/* Zoom Slider */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (onUpdateSlotAdjustments) {
                    const cur = slotAdjustments[selectedSlotToAdjust] || { panX: 0, panY: 0, zoom: 1 };
                    const nextZoom = Math.max(0.8, Math.min(2.8, Math.round((cur.zoom - 0.1) * 100) / 100));
                    onUpdateSlotAdjustments({
                      ...slotAdjustments,
                      [selectedSlotToAdjust]: { ...cur, zoom: nextZoom },
                    });
                  }
                }}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                title="Perkecil"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                  <span>Zoom Foto Slot #{selectedSlotToAdjust + 1}</span>
                  <span className="text-amber-400 font-bold">
                    {Math.round((slotAdjustments[selectedSlotToAdjust]?.zoom || 1) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="2.5"
                  step="0.05"
                  value={slotAdjustments[selectedSlotToAdjust]?.zoom || 1}
                  onChange={(e) => {
                    if (onUpdateSlotAdjustments) {
                      const cur = slotAdjustments[selectedSlotToAdjust] || { panX: 0, panY: 0, zoom: 1 };
                      onUpdateSlotAdjustments({
                        ...slotAdjustments,
                        [selectedSlotToAdjust]: { ...cur, zoom: parseFloat(e.target.value) },
                      });
                    }
                  }}
                  className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>

              <button
                onClick={() => {
                  if (onUpdateSlotAdjustments) {
                    const cur = slotAdjustments[selectedSlotToAdjust] || { panX: 0, panY: 0, zoom: 1 };
                    const nextZoom = Math.max(0.8, Math.min(2.8, Math.round((cur.zoom + 0.1) * 100) / 100));
                    onUpdateSlotAdjustments({
                      ...slotAdjustments,
                      [selectedSlotToAdjust]: { ...cur, zoom: nextZoom },
                    });
                  }
                }}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 cursor-pointer"
                title="Perbesar"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* D-Pad Micro Nudge */}
            <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
              <span className="text-[11px] text-zinc-400">Geser Presisi (D-Pad):</span>
              <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                <button
                  onClick={() => {
                    if (onUpdateSlotAdjustments) {
                      const cur = slotAdjustments[selectedSlotToAdjust] || { panX: 0, panY: 0, zoom: 1 };
                      const newPanX = Math.max(-80, Math.min(80, Math.round((cur.panX - 3) * 10) / 10));
                      onUpdateSlotAdjustments({
                        ...slotAdjustments,
                        [selectedSlotToAdjust]: { ...cur, panX: newPanX },
                      });
                    }
                  }}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-300 cursor-pointer active:scale-95"
                  title="Geser Kiri"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => {
                      if (onUpdateSlotAdjustments) {
                        const cur = slotAdjustments[selectedSlotToAdjust] || { panX: 0, panY: 0, zoom: 1 };
                        const newPanY = Math.max(-80, Math.min(80, Math.round((cur.panY - 3) * 10) / 10));
                        onUpdateSlotAdjustments({
                          ...slotAdjustments,
                          [selectedSlotToAdjust]: { ...cur, panY: newPanY },
                        });
                      }
                    }}
                    className="p-0.5 rounded hover:bg-zinc-800 text-zinc-300 cursor-pointer active:scale-95"
                    title="Geser Atas"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (onUpdateSlotAdjustments) {
                        const cur = slotAdjustments[selectedSlotToAdjust] || { panX: 0, panY: 0, zoom: 1 };
                        const newPanY = Math.max(-80, Math.min(80, Math.round((cur.panY + 3) * 10) / 10));
                        onUpdateSlotAdjustments({
                          ...slotAdjustments,
                          [selectedSlotToAdjust]: { ...cur, panY: newPanY },
                        });
                      }
                    }}
                    className="p-0.5 rounded hover:bg-zinc-800 text-zinc-300 cursor-pointer active:scale-95"
                    title="Geser Bawah"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    if (onUpdateSlotAdjustments) {
                      const cur = slotAdjustments[selectedSlotToAdjust] || { panX: 0, panY: 0, zoom: 1 };
                      const newPanX = Math.max(-80, Math.min(80, Math.round((cur.panX + 3) * 10) / 10));
                      onUpdateSlotAdjustments({
                        ...slotAdjustments,
                        [selectedSlotToAdjust]: { ...cur, panX: newPanX },
                      });
                    }
                  }}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-300 cursor-pointer active:scale-95"
                  title="Geser Kanan"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TAMPILAN NORMAL (Toolbar tetap di BAWAH, Canvas proporsional di ATAS) */}
      {/* ========================================================================= */}
      <div
        className={`flex-1 flex flex-col max-w-3xl mx-auto w-full relative ${
          isCanvasExpanded ? 'hidden' : 'flex'
        }`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Scrollable Canvas & Controls Area dengan padding bawah */}
        <div className="p-2 sm:p-4 pb-28 sm:pb-32 space-y-3">
          {/* Header Bar */}
        <div className="mb-2">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Tata Ulang Slot</span>
            </button>

            <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
              Langkah 7 dari 10
            </span>
          </div>

          <div className="text-center pt-2 pb-1">
            <p className="text-[11px] font-mono tracking-widest text-amber-400 uppercase mb-0.5">
              Step 7: Frame & Kustomisasi
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Kustom Tulisan & Stiker Emoji
            </h2>
            <p className="text-xs text-zinc-400">
              {themeName ? `${themeName} • ` : ''}Klik tulisan atau stiker untuk mengedit teks, gaya font, ukuran, warna, atau geser posisinya!
            </p>
          </div>
        </div>

        {/* Canvas Section di Atas */}
        <div className="w-full flex flex-col items-center mb-3">
          {/* Bar Kontrol Atas Canvas */}
          <div className="w-full max-w-md flex items-center justify-between px-2 py-1 text-xs text-zinc-400 mb-1">
            <span className="font-mono text-[11px] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Canvas Interaktif</span>
            </span>

            <div className="flex items-center gap-2">
              {/* Toggle Frame */}
              <button
                onClick={() => setShowOverlay(!showOverlay)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title={showOverlay ? 'Sembunyikan bingkai frame' : 'Tampilkan bingkai frame'}
              >
                {showOverlay ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span>Frame ON</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Frame OFF</span>
                  </>
                )}
              </button>

              {/* Tombol Rentangkan Layar Penuh (Fullscreen) */}
              <button
                onClick={() => {
                  setIsCanvasExpanded(true);
                  setZoomScale(1);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-[11px] transition-all cursor-pointer shadow-md shadow-amber-500/20"
                title="Rentangkan tampilan canvas jadi Full Layar"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Rentangkan Penuh</span>
              </button>
            </div>
          </div>

          {/* Wadah Canvas Normal di Tengah */}
          <div className="relative w-full max-w-md bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center p-2 h-[38vh] sm:h-[44vh] md:h-[48vh]">
            {renderCanvasElement()}
          </div>
        </div>

        {/* Toolbar / Panel Kustomisasi TETAP DI BAWAH Canvas */}
        <div className="w-full max-w-md mx-auto mb-3">{renderControlPanel()}</div>
        </div>

        {/* Bottom Action Bar (Fixed di Bawah Layar Seperti Bottom Nav Menu Admin) */}
        <div
          className="fixed bottom-0 left-0 right-0 z-40 max-w-lg mx-auto bg-[#0a0c13]/95 backdrop-blur-xl border-t border-zinc-800/90 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] px-4 py-3 flex items-center justify-between gap-3"
          style={{ paddingBottom: 'max(0.85rem, env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={onBack}
            className="flex-1 py-3 px-4 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>

          <button
            onClick={onNext}
            className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <span>Lanjut Pratinjau Terkunci</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MODE RENTANGKAN FULL LAYAR (Scrollable Fullscreen + Toolbar Selalu Terlihat) */}
      {/* ========================================================================= */}
      {isCanvasExpanded && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950 flex flex-col select-none overflow-y-auto"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top Sticky Control Bar */}
          <div className="sticky top-0 w-full p-2 sm:p-3 flex items-center justify-between bg-zinc-950/95 border-b border-zinc-800 backdrop-blur-md z-40">
            <button
              onClick={() => {
                setIsCanvasExpanded(false);
                setZoomScale(1);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors cursor-pointer border border-zinc-700"
            >
              <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Tutup Layar Penuh</span>
            </button>

            {/* Zoom Controls & Pinch Hint */}
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="hidden md:inline text-[11px] text-zinc-400 font-mono">
                💡 Cubit 2 jari di HP untuk zoom
              </span>

              <button
                onClick={() => handleZoom(-0.2)}
                className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center border border-zinc-800 cursor-pointer"
                title="Perkecil Zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleResetZoom}
                className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-amber-300 font-bold cursor-pointer"
                title="Reset ke 100%"
              >
                {Math.round(zoomScale * 100)}%
              </button>

              <button
                onClick={() => handleZoom(0.2)}
                className="w-7 h-7 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 flex items-center justify-center border border-zinc-800 cursor-pointer"
                title="Perbesar Zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              {/* Toggle Frame */}
              <button
                onClick={() => setShowOverlay(!showOverlay)}
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 cursor-pointer ml-1"
                title={showOverlay ? 'Sembunyikan Frame' : 'Tampilkan Frame'}
              >
                {showOverlay ? <Eye className="w-4 h-4 text-amber-400" /> : <EyeOff className="w-4 h-4 text-zinc-400" />}
              </button>
            </div>
          </div>

          {/* Area Canvas Fullscreen di Atas */}
          <div
            onClick={handleCanvasBackgroundClick}
            className="w-full flex items-center justify-center p-3 sm:p-4 my-2 overflow-hidden relative min-h-[52vh] sm:min-h-[62vh] max-h-[72vh]"
          >
            {renderCanvasElement()}
          </div>

          {/* Toolbar Kustomisasi Langsung Terbuka di Bawah (Geser ke bawah) */}
          <div className="w-full max-w-2xl mx-auto p-3 sm:p-4 pb-8 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400 border-b border-zinc-800/80 pb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-zinc-200 font-bold uppercase tracking-wider">Toolbar Kustomisasi</span>
              </div>
              <span className="text-zinc-500 text-[11px]">Geser ke bawah untuk atur teks & stiker</span>
            </div>

            {/* Panel Toolbar Lengkap (Selalu Kelihatan) */}
            {renderControlPanel()}

            {/* Tombol Lanjut di Mode Fullscreen (Docked di Bawah) */}
            <div className="sticky bottom-0 z-30 -mx-3 -mb-8 sm:-mx-4 p-3 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+1rem))] bg-[#0b0d13]/95 backdrop-blur-md border-t border-zinc-800/80 shadow-[0_-8px_24px_rgba(0,0,0,0.7)] flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setIsCanvasExpanded(false);
                  setZoomScale(1);
                }}
                className="py-3 px-5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 active:scale-[0.99]"
              >
                <Minimize2 className="w-4 h-4 text-amber-400" />
                <span>Kembali ke Layar Normal</span>
              </button>

              <button
                onClick={onNext}
                className="py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <span>Lanjut Pratinjau Terkunci</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
