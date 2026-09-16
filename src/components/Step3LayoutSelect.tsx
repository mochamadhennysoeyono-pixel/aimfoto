import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  LayoutGrid,
  RefreshCw,
  Layers,
  Image as ImageIcon,
  PlusCircle,
} from 'lucide-react';
import { FrameTheme, FrameLayoutItem, PhotoboothLayout, LayoutSlot } from '../types';
import { supabase } from '../supabaseClient';
import { DEFAULT_LAYOUTS, compareLayoutNames } from '../data/defaultLayouts';

interface Step3LayoutSelectProps {
  selectedTheme: FrameTheme;
  selectedFrameLayoutId?: string;
  onSelectLayoutVariant: (combination: FrameLayoutItem) => void;
  onBack: () => void;
  onOpenAdmin?: () => void;
}

export const Step3LayoutSelect: React.FC<Step3LayoutSelectProps> = ({
  selectedTheme,
  selectedFrameLayoutId,
  onSelectLayoutVariant,
  onBack,
  onOpenAdmin,
}) => {
  const [combinations, setCombinations] = useState<FrameLayoutItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCombination, setActiveCombination] = useState<FrameLayoutItem | null>(null);

  const fetchLayoutCombinations = async () => {
    setIsLoading(true);
    try {
      // Query frame_layouts with explicit JOIN to layouts table
      const { data, error } = await supabase
        .from('frame_layouts')
        .select('*, layout:layouts(*)')
        .eq('frame_id', selectedTheme.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Error fetching frame_layouts join:', error.message);
        setCombinations([]);
        setActiveCombination(null);
      } else if (data && data.length > 0) {
        const mapped: FrameLayoutItem[] = data.map((item: any) => {
          let layoutObj: PhotoboothLayout;
          if (item.layout) {
            let parsedSlots: LayoutSlot[] = [];
            if (Array.isArray(item.layout.slots)) {
              parsedSlots = item.layout.slots;
            } else if (typeof item.layout.slots === 'string') {
              try {
                parsedSlots = JSON.parse(item.layout.slots);
              } catch (e) {
                parsedSlots = [];
              }
            }

            layoutObj = {
              id: item.layout.id,
              name: item.layout.name || 'Layout Photobooth',
              ratio: item.layout.ratio || '2:3',
              canvas_width: item.layout.canvas_width || 1200,
              canvas_height: item.layout.canvas_height || 1800,
              photo_count: item.layout.photo_count || parsedSlots.length || 1,
              slots: parsedSlots,
            };
          } else {
            layoutObj = DEFAULT_LAYOUTS[0];
          }

          return {
            id: item.id,
            frame_id: item.frame_id,
            layout_id: item.layout_id,
            image_url: item.image_url,
            created_at: item.created_at,
            layout: layoutObj,
            frame: selectedTheme,
          };
        });

        const sortedMapped = [...mapped].sort((a, b) =>
          compareLayoutNames(a.layout?.name, b.layout?.name)
        );

        setCombinations(sortedMapped);
        const found = sortedMapped.find((c) => c.id === selectedFrameLayoutId) || sortedMapped[0] || null;
        setActiveCombination(found);
      } else {
        // Belum ada frame_layouts yang diupload untuk tema frame ini
        setCombinations([]);
        setActiveCombination(null);
      }
    } catch (err) {
      console.warn('Gagal memuat kombinasi layout frame:', err);
      setCombinations([]);
      setActiveCombination(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLayoutCombinations();
  }, [selectedTheme, selectedFrameLayoutId]);

  const handleProceed = () => {
    if (activeCombination) {
      onSelectLayoutVariant(activeCombination);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-xl mx-auto w-full p-4 md:p-6 overflow-y-auto">
      {/* Header Bar */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ganti Tema ({selectedTheme.name})</span>
          </button>

          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            Langkah 3 dari 10
          </span>
        </div>

        {/* Title Header */}
        <div className="text-center pt-4 pb-4">
          <p className="text-[11px] font-mono tracking-widest text-amber-400 uppercase mb-1">
            Step 3: Pilih Varian Layout
          </p>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Pilih Layout Foto
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            Tema: <strong className="text-amber-300 font-semibold">{selectedTheme.name}</strong>. Pilih jumlah foto dan susunan grid yang Anda inginkan.
          </p>
        </div>

        {/* Layout Variants Grid */}
        {isLoading ? (
          <div className="p-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span>Memuat varian layout dari tema ini...</span>
          </div>
        ) : combinations.length === 0 ? (
          <div className="my-6 p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-1">
              <LayoutGrid className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-white">
              Belum Ada Varian Layout Frame
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
              Tema <strong className="text-amber-300 font-semibold">&quot;{selectedTheme.name}&quot;</strong> sedang menyiapkan varian layout frame. Silakan coba pilih tema lain.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
              <button
                onClick={onBack}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Pilih Tema Frame Lain</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-3">
            {combinations.map((combo) => {
              const layout = combo.layout || DEFAULT_LAYOUTS[0];
              const isSelected = activeCombination?.id === combo.id;

              return (
                <div
                  key={combo.id}
                  id={`layout-variant-${combo.id}`}
                  onClick={() => setActiveCombination(combo)}
                  className={`rounded-2xl p-3 transition-all cursor-pointer border flex flex-col justify-between relative group ${
                    isSelected
                      ? 'bg-gradient-to-b from-amber-500/15 to-zinc-950 border-amber-500 ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/10 scale-[1.02]'
                      : 'bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  {/* Top Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-800 text-amber-300 border border-zinc-700 flex items-center gap-1">
                      <LayoutGrid className="w-2.5 h-2.5" />
                      {layout.photo_count} Foto
                    </span>

                    {isSelected ? (
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full border border-zinc-700" />
                    )}
                  </div>

                  {/* Visual Canvas & PNG Frame Preview */}
                  <div className="relative w-full aspect-[3/4] bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800/80 flex items-center justify-center p-1.5 mb-2">
                    {/* Visual Layout Slots Guide */}
                    <div
                      className="relative w-full h-full rounded overflow-hidden"
                      style={{
                        aspectRatio: `${layout.canvas_width} / ${layout.canvas_height}`,
                      }}
                    >
                      {layout.slots.map((slot, i) => (
                        <div
                          key={slot.index ?? i}
                          style={{
                            position: 'absolute',
                            left: `${slot.x}%`,
                            top: `${slot.y}%`,
                            width: `${slot.width}%`,
                            height: `${slot.height}%`,
                            borderRadius: '4px',
                          }}
                          className="bg-zinc-800/90 border border-zinc-700/60 flex items-center justify-center text-[7px] font-mono text-zinc-500 font-bold"
                        >
                          #{slot.index ?? i + 1}
                        </div>
                      ))}

                      {/* PNG Frame Overlay if present */}
                      {combo.image_url ? (
                        <img
                          src={combo.image_url}
                          alt={layout.name}
                          className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                        />
                      ) : (
                        <div className="absolute inset-0 border border-amber-500/20 pointer-events-none rounded" />
                      )}
                    </div>
                  </div>

                  {/* Layout Title & Specs */}
                  <div>
                    <h3 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                      {layout.name}
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                      Rasio {layout.ratio} • {layout.canvas_width}×{layout.canvas_height}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="pt-4 border-t border-zinc-800 space-y-3">
        <button
          id="btn-confirm-layout"
          disabled={!activeCombination}
          onClick={handleProceed}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>
            {activeCombination
              ? `Mulai Kamera (${activeCombination.layout?.photo_count ?? 4}x Foto)`
              : 'Pilih Varian Layout Terlebih Dahulu'}
          </span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
