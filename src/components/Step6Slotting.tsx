import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { FilterPreset, PhotoboothLayout } from '../types';

interface Step6SlottingProps {
  photos: string[];
  layout: PhotoboothLayout;
  filter: FilterPreset;
  slotAssignments: { [slotIndex: number]: string };
  onUpdateSlotAssignments: (newAssignments: { [slotIndex: number]: string }) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step6Slotting: React.FC<Step6SlottingProps> = ({
  photos,
  layout,
  filter,
  slotAssignments,
  onUpdateSlotAssignments,
  onNext,
  onBack,
}) => {
  // Currently selected slot index for swapping
  const [selectedSlotForSwap, setSelectedSlotForSwap] = useState<number | null>(null);

  const slots = layout.slots || [];

  // Initialize 1:1 assignments if empty or incomplete
  useEffect(() => {
    let needsInit = false;
    const current: { [slotIndex: number]: string } = { ...slotAssignments };

    slots.forEach((slot, i) => {
      const key = slot.index ?? i;
      if (!current[key] && photos[i]) {
        current[key] = photos[i];
        needsInit = true;
      }
    });

    if (needsInit) {
      onUpdateSlotAssignments(current);
    }
  }, [slots, photos, slotAssignments, onUpdateSlotAssignments]);

  // Handle clicking a slot to swap
  const handleSlotClick = (slotIndex: number) => {
    if (selectedSlotForSwap === null) {
      // Pick first slot
      setSelectedSlotForSwap(slotIndex);
    } else if (selectedSlotForSwap === slotIndex) {
      // Deselect if clicking the same slot
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
    slots.forEach((slot, i) => {
      const key = slot.index ?? i;
      if (photos[i]) fresh[key] = photos[i];
    });
    onUpdateSlotAssignments(fresh);
    setSelectedSlotForSwap(null);
  };

  // Reverse / Shuffle slot order
  const handleReverseOrder = () => {
    const keys = slots.map((s, i) => s.index ?? i);
    const existingPhotos = keys.map((k) => slotAssignments[k] || photos[0]);
    existingPhotos.reverse();

    const updated: { [slotIndex: number]: string } = {};
    keys.forEach((k, i) => {
      updated[k] = existingPhotos[i];
    });
    onUpdateSlotAssignments(updated);
    setSelectedSlotForSwap(null);
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full p-4 overflow-y-auto">
      {/* Header Bar */}
      <div>
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

        <div className="text-center pt-3 pb-2">
          <p className="text-[11px] font-mono tracking-widest text-amber-400 uppercase mb-0.5">
            Step 6: Penataan ke Slot
          </p>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
            <LayoutGrid className="w-4 h-4 text-amber-400" />
            Tata Posisi Foto di Grid
          </h2>
          <p className="text-xs text-zinc-400">
            {selectedSlotForSwap !== null ? (
              <span className="text-amber-300 font-semibold animate-pulse">
                Klik slot lain untuk menukar posisi foto
              </span>
            ) : (
              'Klik pada slot foto jika ingin menukar urutan posisi'
            )}
          </p>
        </div>
      </div>

      {/* Main Canvas Slotting Area */}
      <div className="relative w-full max-h-[50vh] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center my-auto p-3">
        <div
          className="relative max-h-full max-w-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-inner"
          style={{
            aspectRatio: `${layout.canvas_width || 1200} / ${layout.canvas_height || 1800}`,
            height: '46vh',
          }}
        >
          {/* Render each slot in exact percentage coordinates */}
          {slots.map((slot, i) => {
            const slotKey = slot.index ?? i;
            const photoSrc = slotAssignments[slotKey] || photos[i] || photos[0];
            const isSelectedForSwap = selectedSlotForSwap === slotKey;

            return (
              <div
                key={slotKey}
                onClick={() => handleSlotClick(slotKey)}
                style={{
                  position: 'absolute',
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: `${slot.width}%`,
                  height: `${slot.height}%`,
                  borderRadius: `${slot.borderRadius || 6}px`,
                }}
                className={`overflow-hidden border-2 cursor-pointer transition-all group ${
                  isSelectedForSwap
                    ? 'border-amber-400 ring-4 ring-amber-400/40 z-20 scale-[1.02]'
                    : 'border-zinc-700/80 hover:border-amber-400/60 z-10'
                }`}
              >
                {photoSrc ? (
                  <img
                    src={photoSrc}
                    alt={`Slot ${slotKey}`}
                    className="w-full h-full object-cover transition-all"
                    style={{ filter: filter.cssFilter }}
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 font-mono">
                    Kosong
                  </div>
                )}

                {/* Slot Badge */}
                <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[9px] font-mono text-white flex items-center gap-1 border border-white/10">
                  <span>Slot #{slotKey + 1}</span>
                  {isSelectedForSwap && <span className="text-amber-400 font-bold">• Terpilih</span>}
                </div>

                {/* Hover swap hint */}
                <div className="absolute inset-0 bg-amber-500/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="px-2 py-1 rounded-md bg-black/80 text-amber-300 text-[10px] font-mono flex items-center gap-1">
                    <ArrowLeftRight className="w-3 h-3" />
                    Tukar Posisi
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Layout Adjustment Controls */}
      <div className="flex items-center justify-center gap-2 py-2">
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
          <span>Reset Asli</span>
        </button>
      </div>

      {/* Bottom Actions */}
      <div className="pt-2 border-t border-zinc-800 flex items-center gap-3">
        <button
          id="btn-confirm-slotting"
          onClick={onNext}
          className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <span>Lanjut: Pasang Frame Dekoratif</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
