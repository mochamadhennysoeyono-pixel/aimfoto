import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Move,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Eye,
  Layers,
  Sparkles,
  Maximize2,
} from 'lucide-react';
import { FilterPreset, PhotoboothLayout, SlotAdjustment, SlotAdjustmentsMap } from '../types';

interface Step6SlottingProps {
  photos: string[];
  layout: PhotoboothLayout;
  filter: FilterPreset;
  frameUrl?: string;
  slotAssignments: { [slotIndex: number]: string };
  onUpdateSlotAssignments: (newAssignments: { [slotIndex: number]: string }) => void;
  slotAdjustments?: SlotAdjustmentsMap;
  onUpdateSlotAdjustments?: (newAdjustments: SlotAdjustmentsMap) => void;
  onNext: () => void;
  onBack: () => void;
}

type DragActionType =
  | 'move'
  | 'corner-tl'
  | 'corner-tr'
  | 'corner-bl'
  | 'corner-br'
  | 'edge-t'
  | 'edge-b'
  | 'edge-l'
  | 'edge-r';

export const Step6Slotting: React.FC<Step6SlottingProps> = ({
  photos,
  layout,
  filter,
  frameUrl,
  slotAssignments,
  onUpdateSlotAssignments,
  slotAdjustments = {},
  onUpdateSlotAdjustments,
  onNext,
  onBack,
}) => {
  // Index foto yang sedang aktif dipilih (0 = Foto 1, 1 = Foto 2, dst)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);

  // Set index foto yang sudah dikonfigurasi / dibuka agar tetap tampil di kanvas saat pindah ke foto berikutnya
  const [visitedSlots, setVisitedSlots] = useState<Set<number>>(() => new Set([0]));

  const handleSelectSlot = (idx: number) => {
    setSelectedSlotIndex(idx);
    setVisitedSlots((prev) => {
      const next = new Set(prev);
      for (let k = 0; k <= idx; k++) {
        next.add(k);
      }
      return next;
    });
  };

  // Mode tampilan: 'progressive' (foto saat ini + foto sebelumnya yang sudah di-set) atau 'all' (semua foto)
  const [viewMode, setViewMode] = useState<'progressive' | 'all'>('progressive');

  // Transparansi Frame Slider (0.1 sampai 1.0) untuk melihat lubang bingkai secara otomatis 50%
  const [frameOpacity, setFrameOpacity] = useState<number>(0.5);

  const slots = layout.slots || [];
  const canvasBoxRef = useRef<HTMLDivElement | null>(null);

  // Aspect ratio alami dari setiap foto (default 1.0 = 1:1)
  const [photoRatios, setPhotoRatios] = useState<{ [key: number]: number }>({});

  useEffect(() => {
    slots.forEach((_, i) => {
      const src = slotAssignments[i] || photos[i];
      if (src) {
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth && img.naturalHeight) {
            const r = img.naturalWidth / img.naturalHeight;
            setPhotoRatios((prev) => {
              if (prev[i] === r) return prev;
              return { ...prev, [i]: r };
            });
          }
        };
        img.src = src;
      }
    });
  }, [slots, photos, slotAssignments]);

  const canvasW = layout.canvas_width || 1200;
  const canvasH = layout.canvas_height || 1800;
  const canvasAspect = canvasW / canvasH;

  // Dapatkan rasio foto kamera
  const getPhotoRatio = (slotIdx: number): number => {
    return photoRatios[slotIdx] || 1.0;
  };

  // Hitung ukuran default kotak foto
  const getPhotoDefaultBox = (slotIdx: number) => {
    const ratio = getPhotoRatio(slotIdx);
    const slot = slots[slotIdx];

    const isLandscape = canvasW >= canvasH;
    let baseW = slot?.width;
    if (!baseW) {
      if (slots.length === 1) baseW = 84;
      else if (slots.length === 2) baseW = isLandscape ? 44 : 76;
      else if (slots.length <= 4) baseW = isLandscape ? 38 : 44;
      else baseW = isLandscape ? 28 : 40;
    }

    const baseH = Math.round(((baseW * canvasAspect) / ratio) * 10) / 10;
    return { baseW, baseH };
  };

  // Inisialisasi posisi awal foto
  useEffect(() => {
    let needsInit = false;
    const currentAssignments: { [slotIndex: number]: string } = { ...slotAssignments };
    const currentAdjustments: SlotAdjustmentsMap = { ...slotAdjustments };

    slots.forEach((s, i) => {
      if (!currentAssignments[i] && photos[i]) {
        currentAssignments[i] = photos[i];
        needsInit = true;
      }

      const { baseW, baseH } = getPhotoDefaultBox(i);
      const cur = currentAdjustments[i];

      if (!cur || !cur.ratioSynced) {
        const defaultY = s.y !== undefined ? s.y : Math.round(6 + i * (baseH + 2));
        const defaultX = s.x !== undefined ? s.x : 10;

        currentAdjustments[i] = {
          panX: 0,
          panY: 0,
          zoom: cur?.zoom || 1,
          x: cur?.x !== undefined ? cur.x : defaultX,
          y: cur?.y !== undefined ? cur.y : defaultY,
          width: cur?.width !== undefined ? cur.width : baseW,
          height: cur?.height !== undefined ? cur.height : baseH,
          ratioSynced: true,
        };
        needsInit = true;
      }
    });

    if (needsInit) {
      onUpdateSlotAssignments(currentAssignments);
      onUpdateSlotAdjustments?.(currentAdjustments);
    }
  }, [slots, photos, slotAssignments, slotAdjustments, photoRatios, onUpdateSlotAssignments, onUpdateSlotAdjustments]);

  // Helper update adjustment
  const handleUpdateAdjustment = (slotKey: number, updates: Partial<SlotAdjustment>) => {
    if (!onUpdateSlotAdjustments) return;
    const current = slotAdjustments[slotKey] || {
      panX: 0,
      panY: 0,
      zoom: 1,
      x: slots[slotKey]?.x ?? 10,
      y: slots[slotKey]?.y ?? 10,
      width: slots[slotKey]?.width ?? 40,
      height: slots[slotKey]?.height ?? 30,
    };

    const updated: SlotAdjustmentsMap = {
      ...slotAdjustments,
      [slotKey]: {
        ...current,
        ...updates,
        width: updates.width !== undefined ? updates.width : current.width,
        height: updates.height !== undefined ? updates.height : current.height,
        ratioSynced: true,
      },
    };
    onUpdateSlotAdjustments(updated);
  };

  // Reset foto terpilih ke rasio dan posisi default
  const handleResetSlotAdjustment = (slotKey: number) => {
    if (!onUpdateSlotAdjustments) return;
    const defaultSlot = slots[slotKey];
    const { baseW, baseH } = getPhotoDefaultBox(slotKey);

    const updated: SlotAdjustmentsMap = {
      ...slotAdjustments,
      [slotKey]: {
        panX: 0,
        panY: 0,
        zoom: 1,
        x: defaultSlot?.x ?? 10,
        y: defaultSlot?.y ?? 10,
        width: baseW,
        height: baseH,
        ratioSynced: true,
      },
    };
    onUpdateSlotAdjustments(updated);
  };

  // Set preset rasio cepat
  const handleApplyRatioPreset = (preset: '1:1' | '3:4' | '4:3' | 'natural') => {
    const cur = slotAdjustments[selectedSlotIndex];
    const curW = cur?.width || 40;
    let targetRatio = 1.0;
    if (preset === '1:1') targetRatio = 1.0;
    else if (preset === '3:4') targetRatio = 3 / 4;
    else if (preset === '4:3') targetRatio = 4 / 3;
    else targetRatio = getPhotoRatio(selectedSlotIndex);

    const newH = Math.round(((curW * canvasAspect) / targetRatio) * 10) / 10;
    handleUpdateAdjustment(selectedSlotIndex, { height: newH });
  };

  // Dragging state ref
  const dragRef = useRef<{
    isDragging: boolean;
    action: DragActionType;
    slotKey: number;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    startW: number;
    startH: number;
    canvasW: number;
    canvasH: number;
  }>({
    isDragging: false,
    action: 'move',
    slotKey: 0,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
    startW: 40,
    startH: 30,
    canvasW: 1,
    canvasH: 1,
  });

  // Handler interaksi mouse/touch untuk MOVE dan RESIZE tepi/pojok
  const handleStartDrag = (action: DragActionType, slotKey: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    handleSelectSlot(slotKey);

    const targetEl = e.currentTarget as HTMLElement;
    if (targetEl) {
      try {
        targetEl.setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    const canvasEl = canvasBoxRef.current;
    const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : { width: 400, height: 600 };

    const currentAdj = slotAdjustments[slotKey] || {
      panX: 0,
      panY: 0,
      zoom: 1,
      x: slots[slotKey]?.x ?? 10,
      y: slots[slotKey]?.y ?? 10,
      width: slots[slotKey]?.width ?? 40,
      height: slots[slotKey]?.height ?? 30,
    };

    const startPosX = currentAdj.x ?? (slots[slotKey]?.x || 10);
    const startPosY = currentAdj.y ?? (slots[slotKey]?.y || 10);
    const startW = currentAdj.width ?? (slots[slotKey]?.width || 40);
    const startH = currentAdj.height ?? (slots[slotKey]?.height || 30);

    dragRef.current = {
      isDragging: true,
      action,
      slotKey,
      startX: e.clientX,
      startY: e.clientY,
      startPosX,
      startPosY,
      startW,
      startH,
      canvasW: Math.max(canvasRect.width, 100),
      canvasH: Math.max(canvasRect.height, 100),
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    const { action, slotKey, startX, startY, startPosX, startPosY, startW, startH, canvasW, canvasH } =
      dragRef.current;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    const deltaPctX = (deltaX / canvasW) * 100;
    const deltaPctY = (deltaY / canvasH) * 100;

    switch (action) {
      case 'move': {
        const newX = Math.round((startPosX + deltaPctX) * 10) / 10;
        const newY = Math.round((startPosY + deltaPctY) * 10) / 10;
        handleUpdateAdjustment(slotKey, { x: newX, y: newY });
        break;
      }
      // Tepi Kanan: Mengembangkan/menyempitkan lebar foto ke kanan
      case 'edge-r': {
        const newW = Math.max(10, Math.min(100, Math.round((startW + deltaPctX) * 10) / 10));
        handleUpdateAdjustment(slotKey, { width: newW });
        break;
      }
      // Tepi Kiri: Mengembangkan/menyempitkan lebar foto ke kiri
      case 'edge-l': {
        const clampedDelta = Math.min(startW - 10, deltaPctX);
        const newX = Math.round((startPosX + clampedDelta) * 10) / 10;
        const newW = Math.max(10, Math.min(100, Math.round((startW - clampedDelta) * 10) / 10));
        handleUpdateAdjustment(slotKey, { x: newX, width: newW });
        break;
      }
      // Tepi Bawah: Mengembangkan/menyempitkan tinggi foto ke bawah
      case 'edge-b': {
        const newH = Math.max(8, Math.min(100, Math.round((startH + deltaPctY) * 10) / 10));
        handleUpdateAdjustment(slotKey, { height: newH });
        break;
      }
      // Tepi Atas: Mengembangkan/menyempitkan tinggi foto ke atas
      case 'edge-t': {
        const clampedDelta = Math.min(startH - 8, deltaPctY);
        const newY = Math.round((startPosY + clampedDelta) * 10) / 10;
        const newH = Math.max(8, Math.min(100, Math.round((startH - clampedDelta) * 10) / 10));
        handleUpdateAdjustment(slotKey, { y: newY, height: newH });
        break;
      }
      // Pojok Kanan-Bawah: Memperbesar/memperkecil proporsional
      case 'corner-br': {
        const scaleFactor = 1 + (deltaPctX / startW + deltaPctY / startH) / 2;
        const newW = Math.max(10, Math.min(100, Math.round(startW * scaleFactor * 10) / 10));
        const newH = Math.max(8, Math.min(100, Math.round(startH * scaleFactor * 10) / 10));
        handleUpdateAdjustment(slotKey, { width: newW, height: newH });
        break;
      }
      // Pojok Kiri-Atas: Memperbesar/memperkecil proporsional ke kiri-atas
      case 'corner-tl': {
        const scaleFactor = 1 - (deltaPctX / startW + deltaPctY / startH) / 2;
        const newW = Math.max(10, Math.min(100, Math.round(startW * scaleFactor * 10) / 10));
        const newH = Math.max(8, Math.min(100, Math.round(startH * scaleFactor * 10) / 10));
        const dW = newW - startW;
        const dH = newH - startH;
        const newX = Math.round((startPosX - dW) * 10) / 10;
        const newY = Math.round((startPosY - dH) * 10) / 10;
        handleUpdateAdjustment(slotKey, { x: newX, y: newY, width: newW, height: newH });
        break;
      }
      // Pojok Kanan-Atas: Memperbesar/memperkecil proporsional ke kanan-atas
      case 'corner-tr': {
        const scaleFactor = 1 + (deltaPctX / startW - deltaPctY / startH) / 2;
        const newW = Math.max(10, Math.min(100, Math.round(startW * scaleFactor * 10) / 10));
        const newH = Math.max(8, Math.min(100, Math.round(startH * scaleFactor * 10) / 10));
        const dH = newH - startH;
        const newY = Math.round((startPosY - dH) * 10) / 10;
        handleUpdateAdjustment(slotKey, { y: newY, width: newW, height: newH });
        break;
      }
      // Pojok Kiri-Bawah: Memperbesar/memperkecil proporsional ke kiri-bawah
      case 'corner-bl': {
        const scaleFactor = 1 + (-deltaPctX / startW + deltaPctY / startH) / 2;
        const newW = Math.max(10, Math.min(100, Math.round(startW * scaleFactor * 10) / 10));
        const newH = Math.max(8, Math.min(100, Math.round(startH * scaleFactor * 10) / 10));
        const dW = newW - startW;
        const newX = Math.round((startPosX - dW) * 10) / 10;
        handleUpdateAdjustment(slotKey, { x: newX, width: newW, height: newH });
        break;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.isDragging) {
      const targetEl = e.currentTarget as HTMLElement;
      if (targetEl) {
        try {
          targetEl.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
      dragRef.current.isDragging = false;
    }
  };

  // Nudge pan position via D-Pad (+/- 1.5% kanvas)
  const handleNudge = (dx: number, dy: number) => {
    const currentAdj = slotAdjustments[selectedSlotIndex] || {
      panX: 0,
      panY: 0,
      zoom: 1,
      x: slots[selectedSlotIndex]?.x ?? 10,
      y: slots[selectedSlotIndex]?.y ?? 10,
    };
    const curX = currentAdj.x ?? (slots[selectedSlotIndex]?.x || 10);
    const curY = currentAdj.y ?? (slots[selectedSlotIndex]?.y || 10);

    handleUpdateAdjustment(selectedSlotIndex, {
      x: Math.round((curX + dx) * 10) / 10,
      y: Math.round((curY + dy) * 10) / 10,
    });
  };

  // Zoom / Scale foto proporsional
  const handleZoomChange = (delta: number) => {
    const currentAdj = slotAdjustments[selectedSlotIndex] || {
      panX: 0,
      panY: 0,
      zoom: 1,
      width: 40,
      height: 30,
    };
    const curW = currentAdj.width || 40;
    const curH = currentAdj.height || 30;
    const factor = 1 + delta;
    const newW = Math.max(10, Math.min(100, Math.round(curW * factor * 10) / 10));
    const newH = Math.max(8, Math.min(100, Math.round(curH * factor * 10) / 10));
    handleUpdateAdjustment(selectedSlotIndex, { width: newW, height: newH });
  };

  const activeAdj = slotAdjustments[selectedSlotIndex] || {
    panX: 0,
    panY: 0,
    zoom: 1,
    x: slots[selectedSlotIndex]?.x ?? 10,
    y: slots[selectedSlotIndex]?.y ?? 10,
    width: slots[selectedSlotIndex]?.width ?? 42,
    height: slots[selectedSlotIndex]?.height ?? 28,
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full max-w-lg mx-auto w-full relative overflow-hidden">
      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-4 space-y-3">
        {/* Header Bar */}
      <div className="shrink-0">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Filter</span>
          </button>

          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            Langkah 5: Paskan Foto ke Bingkai
          </span>
        </div>

        {/* Title & Mode Switcher */}
        <div className="flex items-center justify-between pt-2 pb-1 gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              <Move className="w-4 h-4 text-amber-400" />
              <span>Posisikan & Atur Ukuran Foto</span>
            </h2>
            <p className="text-[10.5px] text-zinc-400">
              Tarik tengah untuk geser, tarik pojok untuk skala, tarik tepi untuk ubah rasio.
            </p>
          </div>

          {/* Toggle View Mode: Foto Tersimpan & Aktif vs Tampilkan Semua */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-full p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('progressive')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                viewMode === 'progressive'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Tampilkan foto yang sedang diedit dan semua foto sebelumnya yang sudah di-set"
            >
              Foto Aktif & Sebelumnya
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                viewMode === 'all'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Lihat semua foto terpasang di kanvas"
            >
              Semua Foto
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        className="relative w-full flex-1 flex items-center justify-center my-1 p-2 min-h-[300px] max-h-[46vh] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          ref={canvasBoxRef}
          className="relative max-h-full max-w-full rounded-xl overflow-hidden bg-[#0c0e15] border border-zinc-800/80 shadow-inner select-none"
          style={{
            aspectRatio: `${layout.canvas_width || 1200} / ${layout.canvas_height || 1800}`,
            height: '100%',
          }}
        >
          {/* Layer 1: Slotted Photos */}
          {slots.map((slot, i) => {
            const slotKey = i;
            const photoSrc = slotAssignments[slotKey] || photos[i] || photos[0];
            const isSelected = selectedSlotIndex === slotKey;

            // Foto tetap tampil jika:
            // 1. Sedang aktif diedit (isSelected)
            // 2. Foto sebelumnya yang sudah pernah dibuka / di-set (slotKey <= selectedSlotIndex || visitedSlots.has(slotKey))
            // 3. Mode 'all' (Semua Foto)
            const isVisible = viewMode === 'all' || slotKey <= selectedSlotIndex || visitedSlots.has(slotKey);
            if (!isVisible) {
              return null;
            }

            const adj = slotAdjustments[slotKey] || {
              panX: 0,
              panY: 0,
              zoom: 1,
            };

            const posX = adj.x !== undefined ? adj.x : (slot.x ?? 10);
            const posY = adj.y !== undefined ? adj.y : (slot.y ?? 10);
            const posW = adj.width !== undefined ? adj.width : (slot.width ?? 40);
            const posH = adj.height !== undefined ? adj.height : (slot.height ?? 30);

            return (
              <div
                key={slotKey}
                onClick={() => handleSelectSlot(slotKey)}
                style={{
                  position: 'absolute',
                  left: `${posX}%`,
                  top: `${posY}%`,
                  width: `${posW}%`,
                  height: `${posH}%`,
                  borderRadius: 0,
                  touchAction: 'none',
                  zIndex: isSelected ? 15 : 10,
                }}
                className={`select-none rounded-none ${
                  isSelected
                    ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black/70 shadow-2xl shadow-amber-500/30'
                    : 'cursor-pointer hover:ring-1 hover:ring-amber-400/50'
                }`}
              >
                {/* Body Foto - Drag untuk memindahkan posisi foto secara bebas */}
                <div
                  onPointerDown={(e) => handleStartDrag('move', slotKey, e)}
                  className="w-full h-full relative overflow-hidden cursor-move rounded-none"
                >
                  {photoSrc ? (
                    <img
                      src={photoSrc}
                      alt={`Foto ${i + 1}`}
                      draggable={false}
                      className="w-full h-full object-cover pointer-events-none rounded-none"
                      style={{
                        filter: filter.cssFilter,
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 font-mono">
                      Foto {i + 1}
                    </div>
                  )}

                  {/* Optional Tint Filter */}
                  {filter.tint && (
                    <div
                      className="absolute inset-0 pointer-events-none z-[4]"
                      style={{
                        backgroundColor: `rgba(${filter.tint.r}, ${filter.tint.g}, ${filter.tint.b}, ${filter.tint.alpha})`,
                      }}
                    />
                  )}

                  {/* Indikator Label Foto: Foto Terpilih vs Foto yang Sudah Di-set */}
                  <div
                    className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] pointer-events-none shadow flex items-center gap-1 z-20 ${
                      isSelected
                        ? 'bg-amber-500 text-zinc-950 font-black'
                        : 'bg-black/75 text-zinc-300 font-semibold backdrop-blur-xs'
                    }`}
                  >
                    {isSelected && <Move className="w-2.5 h-2.5" />}
                    <span>Foto #{i + 1}</span>
                  </div>
                </div>

                {/* HANDLE KONTROL KHUSUS FOTO AKTIF: POJOK (SKALA) & TEPI (RASIO/LEBAR/TINGGI) */}
                {isSelected && (
                  <>
                    {/* 1. Pojok Kiri-Atas (Scale up/down) */}
                    <div
                      onPointerDown={(e) => handleStartDrag('corner-tl', slotKey, e)}
                      className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white shadow-lg cursor-nwse-resize z-30 transition-transform hover:scale-125 active:scale-125"
                      title="Tarik pojok untuk memperbesar / memperkecil foto"
                    />

                    {/* 2. Pojok Kanan-Atas (Scale up/down) */}
                    <div
                      onPointerDown={(e) => handleStartDrag('corner-tr', slotKey, e)}
                      className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white shadow-lg cursor-nesw-resize z-30 transition-transform hover:scale-125 active:scale-125"
                      title="Tarik pojok untuk memperbesar / memperkecil foto"
                    />

                    {/* 3. Pojok Kiri-Bawah (Scale up/down) */}
                    <div
                      onPointerDown={(e) => handleStartDrag('corner-bl', slotKey, e)}
                      className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white shadow-lg cursor-nesw-resize z-30 transition-transform hover:scale-125 active:scale-125"
                      title="Tarik pojok untuk memperbesar / memperkecil foto"
                    />

                    {/* 4. Pojok Kanan-Bawah (Scale up/down) */}
                    <div
                      onPointerDown={(e) => handleStartDrag('corner-br', slotKey, e)}
                      className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-white shadow-lg cursor-nwse-resize z-30 transition-transform hover:scale-125 active:scale-125"
                      title="Tarik pojok untuk memperbesar / memperkecil foto"
                    />

                    {/* 5. Tepi Atas: Atur tinggi / rasio ke atas */}
                    <div
                      onPointerDown={(e) => handleStartDrag('edge-t', slotKey, e)}
                      className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-2 rounded-full bg-amber-400 border border-white shadow cursor-ns-resize z-30 transition-transform hover:scale-110 active:scale-110 flex items-center justify-center"
                      title="Tarik tepi atas untuk mengatur tinggi & rasio foto"
                    />

                    {/* 6. Tepi Bawah: Atur tinggi / rasio ke bawah */}
                    <div
                      onPointerDown={(e) => handleStartDrag('edge-b', slotKey, e)}
                      className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-2 rounded-full bg-amber-400 border border-white shadow cursor-ns-resize z-30 transition-transform hover:scale-110 active:scale-110 flex items-center justify-center"
                      title="Tarik tepi bawah untuk mengatur tinggi & rasio foto"
                    />

                    {/* 7. Tepi Kiri: Menyempitkan / mengembangkan lebar ke kiri */}
                    <div
                      onPointerDown={(e) => handleStartDrag('edge-l', slotKey, e)}
                      className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2 h-8 rounded-full bg-amber-400 border border-white shadow cursor-ew-resize z-30 transition-transform hover:scale-110 active:scale-110 flex items-center justify-center"
                      title="Tarik tepi samping untuk menyempitkan atau melebarkan foto"
                    />

                    {/* 8. Tepi Kanan: Menyempitkan / mengembangkan lebar ke kanan */}
                    <div
                      onPointerDown={(e) => handleStartDrag('edge-r', slotKey, e)}
                      className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2 h-8 rounded-full bg-amber-400 border border-white shadow cursor-ew-resize z-30 transition-transform hover:scale-110 active:scale-110 flex items-center justify-center"
                      title="Tarik tepi samping untuk menyempitkan atau melebarkan foto"
                    />
                  </>
                )}
              </div>
            );
          })}

          {/* Layer 2: Transparent PNG Frame Overlay */}
          {frameUrl && (
            <img
              src={frameUrl}
              alt="Frame Photobooth"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none z-20 transition-opacity duration-150"
              style={{ opacity: frameOpacity }}
            />
          )}
        </div>
      </div>

      {/* TAB BAWAH BERJEJER: DAFTAR HASIL FOTO */}
      <div className="shrink-0 my-1 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2 shadow-lg">
        <div className="flex items-center justify-between px-1 pb-1.5 text-[11px] text-zinc-400 font-semibold">
          <span>Pilih Foto untuk Diedit:</span>
          <span className="text-amber-400 font-mono">
            Foto Aktif: #{selectedSlotIndex + 1} dari {slots.length}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 px-0.5 scrollbar-thin">
          {slots.map((s, idx) => {
            const isSelected = selectedSlotIndex === idx;
            const thumb = slotAssignments[idx] || photos[idx];
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSlot(idx)}
                className={`flex flex-col items-center gap-1 p-1 rounded-xl transition-all cursor-pointer shrink-0 border ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-400/50 scale-105 shadow-md shadow-amber-500/20'
                    : 'bg-zinc-950/80 border-zinc-800 hover:border-zinc-700 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 relative">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500">
                      {idx + 1}
                    </div>
                  )}

                  {/* Active Marker */}
                  {isSelected && (
                    <div className="absolute inset-0 border-2 border-amber-400 rounded-lg pointer-events-none" />
                  )}
                </div>

                <span
                  className={`text-[10px] font-bold ${
                    isSelected ? 'text-amber-400' : 'text-zinc-400'
                  }`}
                >
                  Foto {idx + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control Panel: Transparansi Bingkai & Fine-tuning */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-2 space-y-2 my-0.5 shrink-0">
        {/* Slider Transparansi Bingkai */}
        <div className="flex items-center justify-between gap-3 bg-zinc-950/60 px-2.5 py-1.5 rounded-xl border border-zinc-800/80">
          <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-semibold shrink-0">
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>Transparansi Bingkai:</span>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={frameOpacity}
              onChange={(e) => setFrameOpacity(parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              title="Geser ke kiri untuk melihat lubang foto lebih jelas"
            />
            <span className="text-[11px] font-mono text-amber-400 font-bold shrink-0 w-8 text-right">
              {Math.round(frameOpacity * 100)}%
            </span>
          </div>
        </div>

        {/* Quick Ratio Presets & Nudge Tools */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Preset Rasio Cepat */}
          <div className="flex items-center gap-1 bg-zinc-950/50 p-1 rounded-xl border border-zinc-800/70">
            <span className="text-[10px] text-zinc-400 font-semibold px-1">Rasio:</span>
            <button
              type="button"
              onClick={() => handleApplyRatioPreset('1:1')}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Set rasio 1:1 Persegi"
            >
              1:1
            </button>
            <button
              type="button"
              onClick={() => handleApplyRatioPreset('3:4')}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Set rasio 3:4 Vertikal"
            >
              3:4
            </button>
            <button
              type="button"
              onClick={() => handleApplyRatioPreset('4:3')}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Set rasio 4:3 Horizontal"
            >
              4:3
            </button>
            <button
              type="button"
              onClick={() => handleApplyRatioPreset('natural')}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 hover:bg-zinc-700 text-amber-400 transition-colors cursor-pointer"
              title="Kembalikan ke rasio kamera asli"
            >
              Asli
            </button>
          </div>

          {/* Scale & Nudge Reset */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleZoomChange(-0.08)}
              className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              title="Kecilkan ukuran"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleZoomChange(0.08)}
              className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              title="Besarkan ukuran"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleResetSlotAdjustment(selectedSlotIndex)}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset foto terpilih ke posisi awal"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>

            {/* Micro Nudge arrows */}
            <div className="flex items-center gap-0.5 bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-700/60">
              <button
                type="button"
                onClick={() => handleNudge(-1.5, 0)}
                className="p-0.5 rounded hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                title="Geser Kiri"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => handleNudge(0, -1.5)}
                  className="p-0.5 rounded hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                  title="Geser Atas"
                >
                  <ChevronUp className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleNudge(0, 1.5)}
                  className="p-0.5 rounded hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                  title="Geser Bawah"
                >
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleNudge(1.5, 0)}
                className="p-0.5 rounded hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                title="Geser Kanan"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Docked Bottom Actions: Lanjut Antar Foto & Selesai (Selalu di atas tombol navigasi HP) */}
      <div className="shrink-0 z-30 w-full p-3 sm:p-4 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))] bg-[#0b0d13]/95 backdrop-blur-md border-t border-zinc-800/80 shadow-[0_-8px_24px_rgba(0,0,0,0.7)] flex items-center gap-2">
        {selectedSlotIndex < slots.length - 1 ? (
          <button
            type="button"
            onClick={() => handleSelectSlot(selectedSlotIndex + 1)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-zinc-700 active:scale-[0.99]"
          >
            <span>Foto #{selectedSlotIndex + 1} Pas ➔ Lanjut Foto #{selectedSlotIndex + 2}</span>
          </button>
        ) : (
          <div className="flex-1 text-[11px] text-emerald-400 flex items-center justify-center gap-1 font-semibold py-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Semua Foto Sudah Pas</span>
          </div>
        )}

        <button
          id="btn-confirm-slotting"
          onClick={onNext}
          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-[0.99]"
        >
          <span>Selesai: Pasang Bingkai</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
