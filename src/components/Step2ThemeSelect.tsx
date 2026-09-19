import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Layers,
  LayoutGrid,
  RefreshCw,
  Image as ImageIcon,
  PlusCircle,
  Settings,
} from 'lucide-react';
import { FrameTheme } from '../types';
import { supabase } from '../supabaseClient';

interface Step2ThemeSelectProps {
  eventId: string;
  selectedThemeId?: string;
  onSelectTheme: (theme: FrameTheme) => void;
  onBack: () => void;
  onOpenAdmin?: () => void;
}

export const Step2ThemeSelect: React.FC<Step2ThemeSelectProps> = ({
  eventId,
  selectedThemeId,
  onSelectTheme,
  onBack,
  onOpenAdmin,
}) => {
  const [themes, setThemes] = useState<FrameTheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTheme, setActiveTheme] = useState<FrameTheme | null>(null);
  const [failedThumbnails, setFailedThumbnails] = useState<Record<string, boolean>>({});

  const loadThemes = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('frames')
        .select('*')
        .eq('is_active', true);

      if (eventId && eventId !== 'all') {
        query = query.eq('event_id', eventId);
      }

      const { data: dbFrames, error } = await query.order('sort_order', { ascending: true });

      if (error || !dbFrames || dbFrames.length === 0) {
        // Jika tidak ada tema khusus event, periksa apakah ada tema global
        const { data: globalFrames } = await supabase
          .from('frames')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (globalFrames && globalFrames.length > 0) {
          await attachVariantsCount(globalFrames);
        } else {
          // Benar-benar belum ada frame yang diupload di database
          setThemes([]);
          setActiveTheme(null);
        }
      } else {
        await attachVariantsCount(dbFrames);
      }
    } catch (err) {
      console.warn('Gagal memuat tema frame:', err);
      setThemes([]);
      setActiveTheme(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadThemes();
  }, [eventId, selectedThemeId]);

  async function attachVariantsCount(frameRows: any[]) {
    try {
      const { data: allVariants } = await supabase
        .from('frame_layouts')
        .select('id, frame_id, image_url');

      const countsMap = new Map<string, number>();
      const previewMap = new Map<string, string>();
      if (allVariants) {
        allVariants.forEach((v: any) => {
          countsMap.set(v.frame_id, (countsMap.get(v.frame_id) || 0) + 1);
          if (v.image_url && !previewMap.has(v.frame_id)) {
            previewMap.set(v.frame_id, v.image_url);
          }
        });
      }

      const mapped: FrameTheme[] = frameRows.map((f: any) => ({
        id: f.id,
        name: f.name || 'Tema Frame',
        event_id: f.event_id,
        sort_order: f.sort_order ?? 1,
        is_active: f.is_active ?? true,
        description: f.description,
        created_at: f.created_at,
        image_url: previewMap.get(f.id) || f.image_url,
        variants_count: countsMap.get(f.id) || 0,
      }));

      setThemes(mapped);
      const current = mapped.find((t) => t.id === selectedThemeId) || mapped[0] || null;
      setActiveTheme(current);
    } catch (e) {
      setThemes(frameRows);
      setActiveTheme(frameRows[0] || null);
    }
  }

  const handleSelect = (theme: FrameTheme) => {
    setActiveTheme(theme);
  };

  const handleProceed = () => {
    if (activeTheme) {
      onSelectTheme(activeTheme);
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
            <span>Kembali ke Info Event</span>
          </button>

          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            Langkah 2 dari 10
          </span>
        </div>

        {/* Title Header */}
        <div className="text-center pt-4 pb-4">
          <p className="text-[11px] font-mono tracking-widest text-amber-400 uppercase mb-1">
            Step 2: Pilih Tema Frame
          </p>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Pilih Tema Visual Photobooth
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            Setiap tema memiliki beragam varian layout foto yang siap Anda pilih pada langkah berikutnya
          </p>
        </div>

        {/* Themes Grid */}
        {isLoading ? (
          <div className="p-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span>Memuat daftar tema frame dari database...</span>
          </div>
        ) : themes.length === 0 ? (
          <div className="my-6 p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-1">
              <ImageIcon className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-white">
              Belum Ada Tema Frame
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
              Tema frame sedang disiapkan. Silakan muat ulang atau tunggu beberapa saat.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
              <button
                onClick={loadThemes}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang Tema</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-3">
            {themes.map((theme) => {
              const isSelected = activeTheme?.id === theme.id;

              return (
                <div
                  key={theme.id}
                  id={`theme-card-${theme.id}`}
                  onClick={() => handleSelect(theme)}
                  className={`rounded-2xl p-4 transition-all cursor-pointer border flex flex-col justify-between relative overflow-hidden group ${
                    isSelected
                      ? 'bg-gradient-to-b from-amber-500/15 via-zinc-900 to-zinc-950 border-amber-500 ring-2 ring-amber-500/30 shadow-xl shadow-amber-500/10 scale-[1.02]'
                      : 'bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  {/* Selected Indicator */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-zinc-800/90 text-amber-300 border border-zinc-700/60 font-semibold">
                      <LayoutGrid className="w-3 h-3 text-amber-400" />
                      {theme.variants_count ?? 1} Varian Layout
                    </span>

                    {isSelected ? (
                      <span className="w-6 h-6 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="w-6 h-6 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-600 group-hover:border-zinc-500" />
                    )}
                  </div>

                  {/* Theme Preview Visual */}
                  <div className="relative w-full aspect-[16/9] rounded-xl bg-zinc-950/90 border border-zinc-800/90 overflow-hidden flex items-center justify-center mb-3">
                    {theme.image_url && !failedThumbnails[theme.id] ? (
                      <img
                        src={theme.image_url}
                        alt={theme.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        onError={() => setFailedThumbnails((prev) => ({ ...prev, [theme.id]: true }))}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-zinc-500 gap-1.5 p-3 text-center">
                        <Layers className="w-8 h-8 text-amber-400/60 stroke-[1.5]" />
                        <span className="text-[11px] font-bold text-zinc-300">
                          {theme.name}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {theme.variants_count ?? 18} Varian Layout
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Theme Info */}
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                      {theme.name}
                    </h3>
                    {theme.description && (
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                        {theme.description}
                      </p>
                    )}
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
          id="btn-confirm-theme"
          disabled={!activeTheme}
          onClick={handleProceed}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>
            {activeTheme
              ? `Lanjut: Pilih Varian Layout (${activeTheme.name})`
              : 'Pilih Tema Frame Terlebih Dahulu'}
          </span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
