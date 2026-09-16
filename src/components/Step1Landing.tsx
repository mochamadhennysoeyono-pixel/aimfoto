import React, { useState } from 'react';
import {
  Camera,
  Sparkles,
  Check,
  ChevronRight,
  ShieldCheck,
  LayoutGrid,
  Info,
} from 'lucide-react';
import { EventConfig, FrameConfig } from '../types';
import { DEFAULT_LAYOUTS } from '../data/defaultLayouts';

interface Step1LandingProps {
  eventConfig: EventConfig;
  frames: FrameConfig[];
  selectedFrameId: string;
  onSelectFrame: (frameId: string, frameObj?: FrameConfig) => void;
  onStart: () => void;
  onOpenAdmin?: () => void;
}

export const Step1Landing: React.FC<Step1LandingProps> = ({
  eventConfig,
  frames,
  selectedFrameId,
  onSelectFrame,
  onStart,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const selectedFrame =
    frames.find((f) => f.id === selectedFrameId) || frames[0] || null;

  const activeLayout =
    selectedFrame?.layout ||
    DEFAULT_LAYOUTS.find((l) => l.id === selectedFrame?.layout_id) ||
    DEFAULT_LAYOUTS[0];

  const categories = [
    { id: 'all', label: 'Semua Frame' },
    { id: 'autumn', label: '🍁 Autumn Series' },
    { id: 'wedding', label: '✨ Wedding' },
    { id: 'minimalist', label: '🤍 Minimalist' },
    { id: 'supabase', label: '☁️ Kustom' },
  ];

  const filteredFrames = frames.filter((frame) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'autumn') return frame.category === 'autumn';
    if (activeCategory === 'wedding') return frame.category === 'wedding';
    if (activeCategory === 'minimalist') return frame.category === 'minimalist';
    if (activeCategory === 'supabase') return frame.category === 'supabase';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col justify-between max-w-xl mx-auto w-full p-4 md:p-6 overflow-y-auto">
      {/* Top Bar: Event Badge & Status */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-medium text-zinc-300">
              Kiosk Siap Operasi
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-400">
            <Sparkles className="w-3 h-3" />
            Maks. 7x Jepret
          </div>
        </div>

        {/* Event Header */}
        <div className="text-center pt-4 pb-4">
          <p className="text-[11px] font-mono tracking-widest text-amber-400 uppercase mb-1">
            Step 1: Pilih Desain Frame
          </p>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight leading-snug">
            {eventConfig.nama ? (
              eventConfig.nama
            ) : (
              <span className="inline-block w-48 h-6 bg-zinc-800/80 rounded animate-pulse" />
            )}
          </h1>
          {eventConfig.subtitle && (
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              {eventConfig.subtitle}
            </p>
          )}
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Frame Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-3">
          {filteredFrames.map((frame) => {
            const isSelected = selectedFrame?.id === frame.id;
            const layout =
              frame.layout ||
              DEFAULT_LAYOUTS.find((l) => l.id === frame.layout_id) ||
              DEFAULT_LAYOUTS[0];

            return (
              <div
                key={frame.id}
                id={`frame-select-${frame.id}`}
                onClick={() => onSelectFrame(frame.id, frame)}
                className={`relative group rounded-2xl p-2.5 transition-all cursor-pointer border flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-b from-amber-500/10 to-zinc-900 border-amber-500 ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/10 scale-[1.02]'
                    : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900'
                }`}
              >
                {/* Badge layout & photo count */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-800 text-amber-300 border border-zinc-700 font-mono flex items-center gap-1">
                    <LayoutGrid className="w-2.5 h-2.5" />
                    {layout.photo_count} Foto
                  </span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                {/* Frame Preview Visual */}
                <div className="relative w-full aspect-[3/4] bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800/80 flex items-center justify-center p-1.5">
                  {/* Visual Layout Slots Guide */}
                  <div
                    className="relative w-full h-full rounded overflow-hidden"
                    style={{
                      aspectRatio: `${layout.canvas_width} / ${layout.canvas_height}`,
                    }}
                  >
                    {layout.slots?.map((slot) => (
                      <div
                        key={slot.index}
                        style={{
                          position: 'absolute',
                          left: `${slot.x}%`,
                          top: `${slot.y}%`,
                          width: `${slot.width}%`,
                          height: `${slot.height}%`,
                        }}
                        className="bg-zinc-800/90 border border-zinc-700/60 rounded-[2px] flex items-center justify-center text-[8px] font-mono text-zinc-500"
                      >
                        #{slot.index + 1}
                      </div>
                    ))}

                    {/* Frame Decorative Overlay */}
                    <img
                      src={frame.urlGambar}
                      alt={frame.nama}
                      className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                    />
                  </div>
                </div>

                {/* Frame Title & Layout Info */}
                <div className="mt-2 text-left">
                  <h3 className="text-xs font-bold text-white truncate">
                    {frame.nama}
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate">
                    {layout.name} • {layout.ratio}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Frame Overview Banner */}
        {selectedFrame && (
          <div className="rounded-2xl bg-zinc-900/90 border border-amber-500/30 p-3.5 mt-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-14 rounded-lg bg-zinc-950 border border-zinc-800 p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={selectedFrame.urlGambar}
                  alt={selectedFrame.nama}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">
                    {selectedFrame.nama}
                  </span>
                  <span className="text-[10px] font-mono bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded">
                    Terpilih
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Struktur: <strong className="text-zinc-200">{activeLayout.name}</strong> ({activeLayout.photo_count} slot foto • rasio {activeLayout.ratio})
                </p>
              </div>
            </div>

            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20 shrink-0">
              {activeLayout.photo_count} Foto
            </span>
          </div>
        )}
      </div>

      {/* Start Button */}
      <div className="pt-4 border-t border-zinc-800/80 mt-2">
        <button
          id="btn-start-photobooth"
          onClick={onStart}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-extrabold text-sm md:text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 active:scale-[0.98] transition-all cursor-pointer tracking-wide"
        >
          <Camera className="w-5 h-5 stroke-[2.5]" />
          <span>Mulai Ambil Foto ({activeLayout.photo_count} Foto Dibutuhkan)</span>
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
