import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutGrid,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  RotateCcw,
  Sparkles,
  Check,
  Shuffle,
  Info,
  Move,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Sliders,
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
  // Mode: 'adjust' (Geser & Zoom) atau 'swap' (Tukar Urutan Slot)
  const [activeMode, setActiveMode] = useState<'adjust' | 'swap'>('adjust');

  // Currently selected slot for adjust or swap
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [selectedSlotForSwap, setSelectedSlotForSwap] = useState<number | null>(null);

  // Toggle frame overlay visibility for alignment reference
  const [showFrameGuide, setShowFrameGuide] = useState<boolean>(true);
  const [frameOpacity, setFrameOpacity] = useState<number>(0.9);

  const slots = layout.slots || [];
  const slotRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Pointer drag state for smooth pan
  const dragRef = useRef<{
    isDragging: boolean;
    slotKey: number | null;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    zoom: number;
  }>({
    isDragging: false,
    slotKey: null,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    zoom: 1,
  });

  // Initialize 1:1 assignments if empty or incomplete
  useEffect(() => {
    let needsInit = false;
    const current: { [slotIndex: number]: string } = { ...slotAssignments };

    slots.forEach((_, i) => {
      if (!current[i] && photos[i]) {
        current[i] = photos[i];
        needsInit = true;
      }
    });

    if (needsInit) {
      onUpdateSlotAssignments(current);
    }
  }, [slots, photos, slotAssignments, onUpdateSlotAssignments]);

  // Helper to update adjustment for a specific slot
  const handleUpdateAdjustment = (slotKey: number, updates: Partial<SlotAdjustment>) => {
    if (!onUpdateSlotAdjustments) return;
    const current = slotAdjustments[slotKey] || { panX: 0, panY: 0, zoom: 1 };
    const updated: SlotAdjustmentsMap = {
      ...slotAdjustments,
      [slotKey]: {
        ...current,
        ...updates,
      },
    };
    onUpdateSlotAdjustments(updated);
  };

  // Reset current slot adjustment
  const handleResetSlotAdjustment = (slotKey: number) => {
    if (!onUpdateSlotAdjustments) return;
    const updated: SlotAdjustmentsMap = {
      ...slotAdjustments,
      [slotKey]: { panX: 0, panY: 0, zoom: 1 },
    };
    onUpdateSlotAdjustments(updated);
  };

  // Reset all adjustments
  const handleResetAllAdjustments = () => {
    if (!onUpdateSlotAdjustments) return;
    const updated: SlotAdjustmentsMap = {};
    slots.forEach((_, i) => {
      updated[i] = { panX: 0, panY: 0, zoom: 1 };
    });
    onUpdateSlotAdjustments(updated);
  };

  // Handle clicking a slot in swap mode
  const handleSlotClick = (slotIndex: number) => {
    if (activeMode === 'adjust') {
      setSelectedSlotIndex(slotIndex);
      return;
    }

    if (selectedSlotForSwap === null) {
      setSelectedSlotForSwap(slotIndex);
    } else if (selectedSlotForSwap === slotIndex) {
      setSelectedSlotForSwap(null);
    } else {
      // Swap photo between selectedSlotForSwap and slotIndex
      const updated = { ...slotAssignments };
      const photoA = updated[selectedSlotForSwap];
      const photoB = updated[slotIndex];

      updated[selectedSlotForSwap] = photoB;
      updated[slotIndex] = photoA;

      onUpdateSlotAssignments(updated);
      setSelectedSlotForSwap(null);
    }
  };

  // Reset to original shot order
  const handleResetOrder = () => {
    const fresh: { [slotIndex: number]: string } = {};
    slots.forEach((_, i) => {
      if (photos[i]) fresh[i] = photos[i];
    });
    onUpdateSlotAssignments(fresh);
    setSelectedSlotForSwap(null);
  };

  // Reverse / Shuffle slot order
  const handleReverseOrder = () => {
    const keys = slots.map((_, i) => i);
    const existingPhotos = keys.map((k) => slotAssignments[k] || photos[k] || photos[0]);
    existingPhotos.reverse();

    const updated: { [slotIndex: number]: string } = {};
    keys.forEach((k, i) => {
      updated[k] = existingPhotos[i];
    });
    onUpdateSlotAssignments(updated);
    setSelectedSlotForSwap(null);
  };

  // Pointer down: initiate dragging photo inside slot
  const handlePointerDown = (slotKey: number, e: React.PointerEvent) => {
    if (activeMode !== 'adjust') return;
    setSelectedSlotIndex(slotKey);

    const slotEl = slotRefs.current[slotKey];
    if (slotEl) {
      try {
        slotEl.setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    const currentAdj = slotAdjustments[slotKey] || { panX: 0, panY: 0, zoom: 1 };
    dragRef.current = {
      isDragging: true,
      slotKey,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: currentAdj.panX || 0,
      startPanY: currentAdj.panY || 0,
      zoom: currentAdj.zoom || 1,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging || dragRef.current.slotKey === null) return;
    const { slotKey, startX, startY, startPanX, startPanY, zoom } = dragRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    const slotEl = slotRefs.current[slotKey];
    const rect = slotEl ? slotEl.getBoundingClientRect() : { width: 200, height: 200 };
    const slotW = Math.max(rect.width, 50);
    const slotH = Math.max(rect.height, 50);

    const deltaPercentX = (deltaX / slotW) * 100;
    const deltaPercentY = (deltaY / slotH) * 100;

    const newPanX = Math.max(-80, Math.min(80, Math.round((startPanX + deltaPercentX) * 10) / 10));
    const newPanY = Math.max(-80, Math.min(80, Math.round((startPanY + deltaPercentY) * 10) / 10));

    handleUpdateAdjustment(slotKey, { panX: newPanX, panY: newPanY, zoom });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current.isDragging && dragRef.current.slotKey !== null) {
      const slotEl = slotRefs.current[dragRef.current.slotKey];
      if (slotEl) {
        try {
          slotEl.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
      dragRef.current.isDragging = false;
    }
  };

  // Nudge pan position via D-Pad (+/- 3%)
  const handleNudge = (dx: number, dy: number) => {
    const currentAdj = slotAdjustments[selectedSlotIndex] || { panX: 0, panY: 0, zoom: 1 };
    const newPanX = Math.max(-80, Math.min(80, Math.round((currentAdj.panX + dx) * 10) / 10));
    const newPanY = Math.max(-80, Math.min(80, Math.round((currentAdj.panY + dy) * 10) / 10));
    handleUpdateAdjustment(selectedSlotIndex, { panX: newPanX, panY: newPanY });
  };

  // Adjust zoom for selected slot
  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(0.8, Math.min(2.8, Math.round(newZoom * 100) / 100));
    handleUpdateAdjustment(selectedSlotIndex, { zoom: clamped });
  };

  const activeAdj = slotAdjustments[selectedSlotIndex] || { panX: 0, panY: 0, zoom: 1 };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-lg mx-auto w-full p-3 sm:p-4 min-h-0 overflow-y-auto">
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
            Langkah 6 dari 10
          </span>
        </div>

        {/* Title & Mode Switcher */}
        <div className="text-center pt-2.5 pb-2">
          <p className="text-[11px] font-mono tracking-widest text-amber-400 uppercase mb-0.5">
            Step 6: Penataan & Penyesuaian Foto
          </p>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
            <Move className="w-4 h-4 text-amber-400" />
            Sesuaikan Posisi Foto ke Bingkai
          </h2>

          {/* Mode Switch Tabs */}
          <div className="inline-flex items-center p-1 bg-zinc-900/90 rounded-xl border border-zinc-800 mt-2">
            <button
              onClick={() => {
                setActiveMode('adjust');
                setSelectedSlotForSwap(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeMode === 'adjust'
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              <span>Geser & Zoom Foto</span>
            </button>

            <button
              onClick={() => {
                setActiveMode('swap');
                setSelectedSlotForSwap(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeMode === 'swap'
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Tukar Urutan Slot</span>
            </button>
          </div>

          <p className="text-xs text-zinc-400 mt-1.5">
            {activeMode === 'adjust' ? (
              <span className="text-zinc-300">
                Pilih slot lalu <strong className="text-amber-300">geser foto</strong> langsung dengan mouse/jari agar pas di lubang bingkai
              </span>
            ) : selectedSlotForSwap !== null ? (
              <span className="text-amber-300 font-semibold animate-pulse">
                Klik slot lain untuk menukar posisi foto
              </span>
            ) : (
              'Klik slot foto untuk menukar urutan'
            )}
          </p>
        </div>
      </div>

      {/* Frame Guide Toggle for Easy Alignment */}
      {frameUrl && activeMode === 'adjust' && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 rounded-xl border border-zinc-800/80 mb-1 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFrameGuide(!showFrameGuide)}
              className="flex items-center gap-1.5 text-zinc-300 hover:text-white font-medium cursor-pointer"
            >
              {showFrameGuide ? (
                <Eye className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-zinc-500" />
              )}
              <span>{showFrameGuide ? 'Bingkai Terpasang' : 'Sembunyikan Bingkai'}</span>
            </button>
          </div>

          {showFrameGuide && (
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span>Transparansi:</span>
              <button
                onClick={() => setFrameOpacity(frameOpacity === 1 ? 0.75 : frameOpacity === 0.75 ? 0.5 : 1)}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-[10px] cursor-pointer"
              >
                {Math.round(frameOpacity * 100)}%
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Canvas Slotting & Drag Area */}
      <div className="relative w-full flex-1 flex items-center justify-center my-1 p-2 min-h-[280px] max-h-[46vh] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
        <div
          className="relative max-h-full max-w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-inner select-none"
          style={{
            aspectRatio: `${layout.canvas_width || 1200} / ${layout.canvas_height || 1800}`,
            height: '100%',
          }}
        >
          {/* Base Layer */}
          <div className="absolute inset-0 bg-[#0c0e15] pointer-events-none" />

          {/* Render each slot in exact percentage coordinates */}
          {slots.map((slot, i) => {
            const slotKey = i;
            const photoSrc = slotAssignments[slotKey] || photos[i] || photos[0];
            const isSelected = activeMode === 'adjust' && selectedSlotIndex === slotKey;
            const isSelectedForSwap = activeMode === 'swap' && selectedSlotForSwap === slotKey;
            const adj = slotAdjustments[slotKey] || { panX: 0, panY: 0, zoom: 1 };

            return (
              <div
                key={slotKey}
                ref={(el) => {
                  slotRefs.current[slotKey] = el;
                }}
                onClick={() => handleSlotClick(slotKey)}
                onPointerDown={(e) => handlePointerDown(slotKey, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  position: 'absolute',
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: `${slot.width}%`,
                  height: `${slot.height}%`,
                  borderRadius: `${slot.borderRadius || 6}px`,
                  touchAction: 'none',
                }}
                className={`overflow-hidden border-2 transition-all select-none ${
                  activeMode === 'adjust'
                    ? isSelected
                      ? 'border-amber-400 ring-4 ring-amber-400/40 z-20 cursor-grab active:cursor-grabbing shadow-lg'
                      : 'border-zinc-700 hover:border-amber-400/70 z-10 cursor-pointer'
                    : isSelectedForSwap
                    ? 'border-amber-400 ring-4 ring-amber-400/40 z-20 scale-[1.02] cursor-pointer'
                    : 'border-zinc-700/80 hover:border-amber-400/60 z-10 cursor-pointer'
                }`}
              >
                {photoSrc ? (
                  <img
                    src={photoSrc}
                    alt={`Slot ${i + 1}`}
                    draggable={false}
                    className="w-full h-full object-cover transition-transform duration-75 pointer-events-none"
                    style={{
                      filter: filter.cssFilter,
                      transform: `translate(${adj.panX}%, ${adj.panY}%) scale(${adj.zoom})`,
                      transformOrigin: 'center center',
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 font-mono">
                    Kosong
                  </div>
                )}

                {/* Optional Tint */}
                {filter.tint && (
                  <div
                    className="absolute inset-0 pointer-events-none z-[4]"
                    style={{
                      backgroundColor: `rgba(${filter.tint.r}, ${filter.tint.g}, ${filter.tint.b}, ${filter.tint.alpha})`,
                    }}
                  />
                )}

                {/* Portrait Spotlight Vignette */}
                {filter.vignette && (
                  <div
                    className="absolute inset-0 pointer-events-none z-[5]"
                    style={{
                      background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${(filter.vignette.innerRadius ?? 0.28) * 100}%, rgba(0,0,0,${filter.vignette.intensity * 0.35}) 50%, rgba(0,0,0,${filter.vignette.intensity * 0.70}) 75%, rgba(0,0,0,${filter.vignette.intensity}) ${(filter.vignette.outerRadius ?? 0.95) * 100}%)`,
                    }}
                  />
                )}

                {/* Slot Badge */}
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-[9px] font-mono text-white flex items-center gap-1 border border-white/10 pointer-events-none z-10">
                  <span>Slot #{i + 1}</span>
                  {isSelected && <span className="text-amber-400 font-bold">• Aktif</span>}
                  {isSelectedForSwap && <span className="text-amber-400 font-bold">• Tukar</span>}
                  {adj.zoom > 1.05 && (
                    <span className="text-emerald-400 text-[8px] font-semibold">
                      {Math.round(adj.zoom * 10) / 10}x
                    </span>
                  )}
                </div>

                {/* Drag Hint overlay on hovered inactive slot in adjust mode */}
                {activeMode === 'adjust' && isSelected && (
                  <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-amber-500/90 text-zinc-950 text-[9px] font-bold flex items-center gap-1 pointer-events-none z-10 shadow">
                    <Move className="w-2.5 h-2.5" />
                    <span>Geser</span>
                  </div>
                )}

                {/* Swap hint overlay */}
                {activeMode === 'swap' && (
                  <div className="absolute inset-0 bg-amber-500/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                    <span className="px-2 py-1 rounded-md bg-black/80 text-amber-300 text-[10px] font-mono flex items-center gap-1">
                      <ArrowLeftRight className="w-3 h-3" />
                      Tukar Posisi
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Decorative Frame Overlay Layer (for alignment visual guide) */}
          {frameUrl && showFrameGuide && activeMode === 'adjust' && (
            <img
              src={frameUrl}
              alt="Frame Guide Overlay"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none z-25 transition-opacity duration-150"
              style={{ opacity: frameOpacity }}
            />
          )}
        </div>
      </div>

      {/* Adjust Mode Controls Bar */}
      {activeMode === 'adjust' ? (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 space-y-2.5 my-1.5 shrink-0 shadow-lg">
          {/* Active slot selection row */}
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Slot #{selectedSlotIndex + 1}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                (Pan X: {Math.round(activeAdj.panX)}%, Y: {Math.round(activeAdj.panY)}%)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Quick switch active slot pills */}
              <div className="flex items-center gap-1">
                {slots.map((s, idx) => {
                  const key = s.index ?? idx;
                  const isActive = selectedSlotIndex === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedSlotIndex(key)}
                      className={`w-6 h-6 rounded-lg text-[11px] font-bold font-mono transition-all cursor-pointer ${
                        isActive
                          ? 'bg-amber-500 text-zinc-950 shadow'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                      title={`Pilih Slot #${key + 1}`}
                    >
                      {key + 1}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handleResetSlotAdjustment(selectedSlotIndex)}
                className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ml-1"
                title="Kembalikan foto slot ini ke tengah"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Zoom and D-Pad Controls Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            {/* Zoom Slider */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleZoomChange(activeAdj.zoom - 0.1)}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer disabled:opacity-40"
                disabled={activeAdj.zoom <= 0.8}
                title="Perkecil foto"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                  <span>Zoom</span>
                  <span className="text-amber-400 font-bold">{Math.round(activeAdj.zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="2.5"
                  step="0.05"
                  value={activeAdj.zoom}
                  onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>

              <button
                onClick={() => handleZoomChange(activeAdj.zoom + 0.1)}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer disabled:opacity-40"
                disabled={activeAdj.zoom >= 2.5}
                title="Perbesar foto"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* D-Pad Micro Nudge */}
            <div className="flex items-center justify-between sm:justify-end gap-2 text-xs">
              <span className="text-[11px] text-zinc-400">Geser Presisi:</span>
              <div className="flex items-center gap-1 bg-zinc-800/80 p-1 rounded-xl border border-zinc-700/60">
                <button
                  onClick={() => handleNudge(-3, 0)}
                  className="p-1 rounded hover:bg-zinc-700 text-zinc-300 cursor-pointer active:scale-95"
                  title="Geser Kiri"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => handleNudge(0, -3)}
                    className="p-0.5 rounded hover:bg-zinc-700 text-zinc-300 cursor-pointer active:scale-95"
                    title="Geser Atas"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleNudge(0, 3)}
                    className="p-0.5 rounded hover:bg-zinc-700 text-zinc-300 cursor-pointer active:scale-95"
                    title="Geser Bawah"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => handleNudge(3, 0)}
                  className="p-1 rounded hover:bg-zinc-700 text-zinc-300 cursor-pointer active:scale-95"
                  title="Geser Kanan"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Swap Mode Controls Bar */
        <div className="flex items-center justify-center gap-2 py-2 shrink-0">
          <button
            onClick={handleReverseOrder}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Shuffle className="w-3 h-3 text-amber-400" />
            <span>Balik Urutan</span>
          </button>

          <button
            onClick={handleResetOrder}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Urutan Asli</span>
          </button>
        </div>
      )}

      {/* Bottom Action */}
      <div className="pt-2 pb-1 border-t border-zinc-800 flex items-center gap-3 shrink-0">
        <button
          id="btn-confirm-slotting"
          onClick={onNext}
          className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <span>Lanjut: Pasang Frame & Dekorasi</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
