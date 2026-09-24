import React, { useState } from 'react';
import { Sparkles, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { FilterPreset } from '../types';
import { FILTER_PRESETS } from '../data/filters';

interface Step5FiltersProps {
  photos: string[];
  selectedFilterId: string;
  onSelectFilter: (filterId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step5Filters: React.FC<Step5FiltersProps> = ({
  photos = [],
  selectedFilterId,
  onSelectFilter,
  onNext,
  onBack,
}) => {
  const allPhotos = photos.length > 0 ? photos : [''];
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const currentPhoto = allPhotos[activePhotoIndex] || allPhotos[0];
  const activePreset =
    FILTER_PRESETS.find((f) => f.id === selectedFilterId) || FILTER_PRESETS[0];

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full max-w-lg mx-auto w-full relative overflow-hidden">
      {/* Scrollable Filters Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">
        {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ulangi Sesi Foto</span>
          </button>

          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            Langkah 5 dari 10
          </span>
        </div>

        <div className="text-center pt-2.5 pb-1.5">
          <p className="text-[11px] font-mono tracking-widest text-amber-400 uppercase mb-0.5">
            Step 5: Filter Warna
          </p>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Pilih Sentuhan Warna
          </h2>
          <p className="text-xs text-zinc-400">
            Preset filter akan diterapkan ke seluruh {allPhotos.length} foto Anda
          </p>
        </div>
      </div>

      {/* Main Preview with Live CSS / Canvas Filter: Kotak 1:1 aspect-square */}
      <div className="relative w-full aspect-square bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center my-2 shrink-0">
        <div className="relative w-full h-full">
          {currentPhoto ? (
            <img
              src={currentPhoto}
              alt="Preview Filter"
              className="w-full h-full object-cover transition-all duration-300"
              style={{ filter: activePreset.cssFilter }}
            />
          ) : (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-600 text-xs">
              Tidak ada foto
            </div>
          )}

          {/* Optional Tint Overlay */}
          {activePreset.tint && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300"
              style={{
                backgroundColor: `rgba(${activePreset.tint.r}, ${activePreset.tint.g}, ${activePreset.tint.b}, ${activePreset.tint.alpha})`,
              }}
            />
          )}

          {/* Portrait Spotlight Vignette (Fokus Lighting di Tengah, Tepi Menghitam) */}
          {activePreset.vignette && (
            <div
              className="absolute inset-0 pointer-events-none transition-all duration-300"
              style={{
                background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${(activePreset.vignette.innerRadius ?? 0.28) * 100}%, rgba(0,0,0,${activePreset.vignette.intensity * 0.35}) 50%, rgba(0,0,0,${activePreset.vignette.intensity * 0.70}) 75%, rgba(0,0,0,${activePreset.vignette.intensity}) ${(activePreset.vignette.outerRadius ?? 0.95) * 100}%)`,
              }}
            />
          )}

          {/* Filter Name Watermark Pill */}
          <div className="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-xs text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="font-semibold">{activePreset.nama}</span>
            <span className="text-zinc-400 text-[10px] hidden sm:inline">
              — {activePreset.tagline}
            </span>
          </div>
        </div>
      </div>

      {/* Multiple Photos Selector */}
      {allPhotos.length > 1 && (
        <div className="flex items-center gap-2 py-1.5 overflow-x-auto scrollbar-none shrink-0">
          <span className="text-[10px] font-mono text-zinc-400 shrink-0">Pilih Foto:</span>
          {allPhotos.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setActivePhotoIndex(idx)}
              className={`w-9 h-9 rounded-lg overflow-hidden border shrink-0 transition-all cursor-pointer ${
                activePhotoIndex === idx
                  ? 'border-amber-400 ring-2 ring-amber-400/40 scale-105'
                  : 'border-zinc-800 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={p} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Filter Presets Carousel */}
      <div className="py-2 shrink-0">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {FILTER_PRESETS.map((preset) => {
            const isSelected = activePreset.id === preset.id;
            const isPortrait = preset.id.startsWith('portrait');

            return (
              <button
                key={preset.id}
                id={`btn-filter-${preset.id}`}
                onClick={() => onSelectFilter(preset.id)}
                className={`relative flex flex-col items-center p-1.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/30'
                    : isPortrait
                    ? 'border-cyan-500/40 bg-zinc-900/80 hover:border-cyan-500/70'
                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                }`}
              >
                {isPortrait && (
                  <span className="absolute -top-1.5 right-1 px-1.5 py-0.2 rounded-full text-[8px] font-bold bg-cyan-500 text-zinc-950 shadow z-10 uppercase tracking-tighter">
                    Potret
                  </span>
                )}
                <div className="w-full aspect-square rounded-lg overflow-hidden relative bg-zinc-950 mb-1">
                  {currentPhoto ? (
                    <img
                      src={currentPhoto}
                      alt={preset.nama}
                      className="w-full h-full object-cover"
                      style={{ filter: preset.cssFilter }}
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-800" />
                  )}

                  {/* Thumbnail Vignette Spotlight */}
                  {preset.vignette && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${(preset.vignette.innerRadius ?? 0.28) * 100}%, rgba(0,0,0,${preset.vignette.intensity * 0.45}) 55%, rgba(0,0,0,${preset.vignette.intensity}) 100%)`,
                      }}
                    />
                  )}

                  {isSelected && (
                    <div className="absolute inset-0 bg-amber-500/30 flex items-center justify-center z-10">
                      <div className="w-4 h-4 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    </div>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium truncate w-full text-center ${
                    isSelected
                      ? 'text-amber-300 font-bold'
                      : isPortrait
                      ? 'text-cyan-300 font-semibold'
                      : 'text-zinc-400'
                  }`}
                >
                  {preset.nama}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      </div>

      {/* Docked Bottom Actions (Selalu di atas tombol navigasi HP) */}
      <div className="shrink-0 z-30 w-full p-3 sm:p-4 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))] bg-[#0b0d13]/95 backdrop-blur-md border-t border-zinc-800/80 shadow-[0_-8px_24px_rgba(0,0,0,0.7)] flex items-center gap-3">
        <button
          id="btn-confirm-filter"
          onClick={onNext}
          className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.99]"
        >
          <span>Lanjut: Penataan ke Slot</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
