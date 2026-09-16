import React, { useState } from 'react';
import { Sparkles, Check, ArrowRight, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { FilterPreset } from '../types';
import { FILTER_PRESETS } from '../data/filters';

interface Step3FiltersProps {
  originalPhoto: string;
  photos?: string[];
  selectedFilterId: string;
  onSelectFilter: (filterId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step3Filters: React.FC<Step3FiltersProps> = ({
  originalPhoto,
  photos = [],
  selectedFilterId,
  onSelectFilter,
  onNext,
  onBack,
}) => {
  const allPhotos = photos.length > 0 ? photos : [originalPhoto];
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const currentPhoto = allPhotos[activePhotoIndex] || originalPhoto;
  const activePreset =
    FILTER_PRESETS.find((f) => f.id === selectedFilterId) || FILTER_PRESETS[0];

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full p-3 md:p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Pilih Filter Warna
          </h2>
          <p className="text-[11px] text-zinc-400 font-mono">
            Filter akan diterapkan ke seluruh {allPhotos.length} foto Anda
          </p>
        </div>

        <span className="text-[11px] font-semibold text-amber-400 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
          {activePreset.nama}
        </span>
      </div>

      {/* Main Preview with Live CSS / Canvas Filter */}
      <div className="relative w-full aspect-[4/5] max-h-[46vh] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center my-auto">
        <div className="relative w-full h-full">
          <img
            src={currentPhoto}
            alt="Preview Filter"
            className="w-full h-full object-cover transition-all duration-300"
            style={{ filter: activePreset.cssFilter }}
          />

          {/* Optional Tint Overlay */}
          {activePreset.tint && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-300"
              style={{
                backgroundColor: `rgba(${activePreset.tint.r}, ${activePreset.tint.g}, ${activePreset.tint.b}, ${activePreset.tint.alpha})`,
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

      {/* Multiple Photos Selector if more than 1 photo */}
      {allPhotos.length > 1 && (
        <div className="flex items-center gap-2 py-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-mono text-zinc-400 shrink-0">Pratinjau Foto:</span>
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
              <img src={p} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Filter Presets Carousel */}
      <div className="py-2">
        <p className="text-[11px] text-zinc-400 font-medium mb-1.5 px-1">
          Pilihan Preset ({FILTER_PRESETS.length}):
        </p>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-800">
          {FILTER_PRESETS.map((preset) => {
            const isSelected = preset.id === selectedFilterId;

            return (
              <button
                key={preset.id}
                id={`filter-${preset.id}`}
                onClick={() => onSelectFilter(preset.id)}
                className={`flex-shrink-0 flex flex-col items-center p-1.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-amber-400 bg-amber-400/10 shadow-md shadow-amber-500/10'
                    : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700'
                }`}
              >
                {/* Thumbnail with filter applied */}
                <div className="w-14 h-14 rounded-lg overflow-hidden relative mb-1 bg-zinc-950 border border-zinc-800">
                  <img
                    src={currentPhoto}
                    alt={preset.nama}
                    className="w-full h-full object-cover"
                    style={{ filter: preset.cssFilter }}
                  />
                  {preset.tint && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundColor: `rgba(${preset.tint.r}, ${preset.tint.g}, ${preset.tint.b}, ${preset.tint.alpha})`,
                      }}
                    />
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 bg-amber-400/20 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </div>
                  )}
                </div>

                <span
                  className={`text-[10px] font-medium leading-tight text-center truncate max-w-[65px] ${
                    isSelected ? 'text-amber-400 font-bold' : 'text-zinc-300'
                  }`}
                >
                  {preset.nama}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3 pt-1 pb-1">
        <button
          id="btn-filter-back"
          onClick={onBack}
          className="flex-1 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-zinc-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kamera</span>
        </button>

        <button
          id="btn-filter-next"
          onClick={onNext}
          className="flex-2 py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <span>Atur Tata Letak Foto</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
