import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Shuffle,
  Check,
  LayoutGrid,
  Info,
  AlertCircle,
  Wand2,
} from 'lucide-react';
import { FilterPreset, FrameConfig, PhotoboothLayout } from '../types';
import { DEFAULT_LAYOUTS } from '../data/defaultLayouts';

interface Step4SlottingProps {
  photos: string[];
  filter: FilterPreset;
  frame: FrameConfig;
  layout?: PhotoboothLayout;
  slotAssignments: { [slotIndex: number]: string };
  onUpdateSlotAssignments: (newAssignments: { [slotIndex: number]: string }) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step4Slotting: React.FC<Step4SlottingProps> = ({
  photos,
  filter,
  frame,
  layout: propLayout,
  slotAssignments,
  onUpdateSlotAssignments,
  onNext,
  onBack,
}) => {
  const activeLayout: PhotoboothLayout =
    frame.layout ||
    propLayout ||
    DEFAULT_LAYOUTS.find((l) => l.id === frame.layout_id) ||
    DEFAULT_LAYOUTS[0];

  const slots = activeLayout.slots || [];
  const photoCount = activeLayout.photo_count || slots.length || 1;

  // Selected slot for manual placement
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);

  // Helper to count how many slots are filled
  const filledCount = slots.filter((slot) => Boolean(slotAssignments[slot.index])).length;
  const isAllSlotsFilled = filledCount >= photoCount;

  // Helper to get assigned photo for a slot
  const getSlotPhoto = (slotIndex: number): string | null => {
    return slotAssignments[slotIndex] || null;
  };

  // Assign photo to active slot
  const handleAssignPhotoToSlot = (photoUrl: string) => {
    const updated = {
      ...slotAssignments,
      [activeSlotIndex]: photoUrl,
    };
    onUpdateSlotAssignments(updated);

    // Auto-advance to the next unfilled slot if one exists
    const nextUnfilledSlot = slots.find(
      (s) => s.index !== activeSlotIndex && !updated[s.index]
    );

    if (nextUnfilledSlot) {
      setActiveSlotIndex(nextUnfilledSlot.index);
    } else {
      // Cycle to next slot
      setActiveSlotIndex((activeSlotIndex + 1) % slots.length);
    }
  };

  // Auto-fill all slots sequentially using captured photos
  const handleAutoFill = () => {
    if (photos.length === 0) return;
    const newAssignments: { [slotIndex: number]: string } = {};

    slots.forEach((slot, i) => {
      newAssignments[slot.index] = photos[i % photos.length];
    });

    onUpdateSlotAssignments(newAssignments);
  };

  // Randomize photo assignment into slots
  const handleShuffle = () => {
    if (photos.length === 0) return;
    const shuffled = [...photos].sort(() => Math.random() - 0.5);
    const newAssignments: { [slotIndex: number]: string } = {};

    slots.forEach((slot, i) => {
      newAssignments[slot.index] = shuffled[i % shuffled.length];
    });

    onUpdateSlotAssignments(newAssignments);
  };

  // Clear a specific slot
  const handleClearSlot = (slotIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...slotAssignments };
    delete updated[slotIndex];
    onUpdateSlotAssignments(updated);
    setActiveSlotIndex(slotIndex);
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-xl mx-auto w-full p-3 md:p-4 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4 text-amber-400" />
            Penataan Foto ke Slot Layout
          </h2>
          <p className="text-[11px] text-zinc-400">
            {frame.nama} • {activeLayout.name} ({photoCount} Foto)
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleAutoFill}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Isi semua slot otomatis"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Isi Cepat</span>
          </button>

          <button
            onClick={handleShuffle}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-medium text-amber-300 hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Acak posisi foto"
          >
            <Shuffle className="w-3.5 h-3.5 text-amber-400" />
            <span>Acak</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Layout Canvas */}
      <div className="flex flex-col items-center my-auto py-2">
        <div className="relative max-h-[46vh] w-auto max-w-full aspect-[3/4] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center p-2">
          {/* Canvas Sized Container by Layout Aspect Ratio */}
          <div
            className="relative h-full max-h-[44vh] rounded-xl overflow-hidden bg-zinc-900 shadow-inner"
            style={{
              aspectRatio: `${activeLayout.canvas_width} / ${activeLayout.canvas_height}`,
            }}
          >
            {/* 1. Render Interactive Slot Dropzones calculated from Percent Coordinates */}
            {slots.map((slot) => {
              const photo = getSlotPhoto(slot.index);
              const isSelected = activeSlotIndex === slot.index;

              return (
                <div
                  key={slot.index}
                  id={`slot-target-${slot.index}`}
                  onClick={() => setActiveSlotIndex(slot.index)}
                  style={{
                    position: 'absolute',
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    width: `${slot.width}%`,
                    height: `${slot.height}%`,
                  }}
                  className={`rounded-md overflow-hidden cursor-pointer transition-all z-10 ${
                    isSelected
                      ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-zinc-950 shadow-lg shadow-amber-400/40 scale-[1.01]'
                      : 'hover:opacity-95'
                  }`}
                >
                  {photo ? (
                    <div className="relative w-full h-full bg-zinc-900 group">
                      {/* Photo fitted into slot */}
                      <img
                        src={photo}
                        alt={`Slot ${slot.index + 1}`}
                        className="w-full h-full object-cover"
                        style={{ filter: filter.cssFilter }}
                      />

                      {filter.tint && (
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            backgroundColor: `rgba(${filter.tint.r}, ${filter.tint.g}, ${filter.tint.b}, ${filter.tint.alpha})`,
                          }}
                        />
                      )}

                      {/* Remove photo button on hover */}
                      <button
                        onClick={(e) => handleClearSlot(slot.index, e)}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 hover:bg-rose-600 text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Hapus foto dari slot ini"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-zinc-800/90 border border-dashed border-zinc-600 flex flex-col items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">
                      <span className="text-[10px] font-mono font-semibold">
                        + Isi Slot
                      </span>
                    </div>
                  )}

                  {/* Slot Number Badge */}
                  <div
                    className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono transition-colors shadow ${
                      isSelected
                        ? 'bg-amber-400 text-zinc-950 font-extrabold'
                        : photo
                        ? 'bg-black/70 text-white'
                        : 'bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    #{slot.index + 1}
                  </div>
                </div>
              );
            })}

            {/* 2. Top Decorative PNG Frame Overlay */}
            <img
              src={frame.urlGambar}
              alt={frame.nama}
              className="absolute inset-0 w-full h-full object-fill pointer-events-none z-20"
            />
          </div>
        </div>

        {/* Slotting Instructions & Status */}
        <div className="mt-2 text-center">
          <p className="text-[11px] text-zinc-300 flex items-center justify-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Target aktif: <strong className="text-amber-300">Slot #{activeSlotIndex + 1}</strong> • Klik foto jepretan di bawah untuk menempatkan.
            </span>
          </p>

          <div className="mt-1 flex items-center justify-center gap-2">
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                isAllSlotsFilled
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {isAllSlotsFilled
                ? '✓ Semua slot terisi lengkap!'
                : `Terisi ${filledCount} dari ${photoCount} slot foto`}
            </span>
          </div>
        </div>
      </div>

      {/* Captured Photos Tray (Multi-Shot Photos) */}
      <div className="py-2 border-t border-zinc-800/80">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5 px-1">
          <span className="font-semibold text-zinc-300">
            Pilihan Foto Jepretan ({photos.length} foto):
          </span>
          <span className="text-[10px] text-amber-400">
            Klik foto untuk dimasukkan ke Slot #{activeSlotIndex + 1}
          </span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {photos.map((photo, idx) => {
            const isAssigned = Object.values(slotAssignments).includes(photo);

            return (
              <button
                key={idx}
                id={`tray-photo-${idx}`}
                onClick={() => handleAssignPhotoToSlot(photo)}
                className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 transition-all hover:scale-105 active:scale-95 cursor-pointer hover:border-amber-400 group"
              >
                <img
                  src={photo}
                  alt={`Hasil Jepretan ${idx + 1}`}
                  className="w-full h-full object-cover"
                  style={{ filter: filter.cssFilter }}
                />

                <span className="absolute bottom-1 left-1 bg-black/70 text-[9px] font-mono px-1 rounded text-white">
                  #{idx + 1}
                </span>

                {isAssigned && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center gap-3 pt-2 pb-1 border-t border-zinc-800/80">
        <button
          id="btn-slotting-back"
          onClick={onBack}
          className="flex-1 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-zinc-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>

        <button
          id="btn-slotting-next"
          onClick={onNext}
          disabled={!isAllSlotsFilled}
          className={`flex-2 py-3 px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all ${
            isAllSlotsFilled
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 shadow-amber-500/20 active:scale-95 cursor-pointer'
              : 'bg-zinc-800/80 text-zinc-500 border border-zinc-700/50 cursor-not-allowed opacity-75'
          }`}
        >
          {isAllSlotsFilled ? (
            <>
              <span>Lanjut ke Pratinjau & Cetak</span>
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Isi Semua {photoCount} Slot Foto ({filledCount}/{photoCount})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
