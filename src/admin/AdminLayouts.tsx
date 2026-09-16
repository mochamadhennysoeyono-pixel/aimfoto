import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutGrid,
  RefreshCw,
  Info,
  Maximize2,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { PhotoboothLayout, LayoutSlot } from '../types';
import { DEFAULT_LAYOUTS, sortLayoutsList } from '../data/defaultLayouts';

export const AdminLayouts: React.FC = () => {
  const [layouts, setLayouts] = useState<PhotoboothLayout[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [linkedFramesCount, setLinkedFramesCount] = useState<{ [layoutId: string]: number }>({});

  const fetchLayouts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // 1. Fetch layouts from Supabase
      const { data, error } = await supabase
        .from('layouts')
        .select('*');

      if (error) {
        console.warn('Notice saat fetch layouts dari Supabase:', error.message);
        setLayouts(sortLayoutsList(DEFAULT_LAYOUTS));
      } else if (data && data.length > 0) {
        const parsedLayouts: PhotoboothLayout[] = data.map((item: any) => {
          let parsedSlots: LayoutSlot[] = [];
          if (Array.isArray(item.slots)) {
            parsedSlots = item.slots;
          } else if (typeof item.slots === 'string') {
            try {
              parsedSlots = JSON.parse(item.slots);
            } catch (e) {
              parsedSlots = [];
            }
          }

          return {
            id: item.id,
            name: item.name || 'Layout Tanpa Nama',
            ratio: item.ratio || '1:1',
            canvas_width: item.canvas_width || 1080,
            canvas_height: item.canvas_height || 1350,
            photo_count: item.photo_count || parsedSlots.length || 1,
            slots: parsedSlots,
          };
        });
        setLayouts(sortLayoutsList(parsedLayouts));
      } else {
        setLayouts(sortLayoutsList(DEFAULT_LAYOUTS));
      }

      // 2. Fetch linked frame counts
      try {
        const { data: framesData } = await supabase.from('frames').select('id, layout_id');
        if (framesData) {
          const counts: { [layoutId: string]: number } = {};
          framesData.forEach((f: any) => {
            if (f.layout_id) {
              counts[f.layout_id] = (counts[f.layout_id] || 0) + 1;
            }
          });
          setLinkedFramesCount(counts);
        }
      } catch (e) {
        // Non-critical
      }
    } catch (err: any) {
      console.warn('Fallback ke default layouts:', err);
      setLayouts(DEFAULT_LAYOUTS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLayouts();
  }, [fetchLayouts]);

  const activeSelectedLayout =
    layouts.find((l) => l.id === selectedLayoutId) || layouts[0] || null;

  // Pisahkan Layout 1 s/d 14 di atas, dan layout lainnya diletakkan di bawahnya
  const mainLayouts = layouts.filter((l) => {
    const m = (l.name || '').match(/layout\s*(\d+)/i);
    const num = m ? parseInt(m[1], 10) : null;
    return num !== null && num >= 1 && num <= 14;
  });

  const otherLayouts = layouts.filter((l) => {
    const m = (l.name || '').match(/layout\s*(\d+)/i);
    const num = m ? parseInt(m[1], 10) : null;
    return !(num !== null && num >= 1 && num <= 14);
  });

  const renderLayoutCard = (layout: PhotoboothLayout) => {
    const isSelected = activeSelectedLayout?.id === layout.id;
    const frameCount = linkedFramesCount[layout.id] || 0;

    return (
      <div
        key={layout.id}
        onClick={() => setSelectedLayoutId(layout.id)}
        className={`rounded-2xl border p-4 transition-all cursor-pointer flex flex-col justify-between ${
          isSelected
            ? 'bg-gradient-to-b from-amber-500/10 to-zinc-900 border-amber-500 ring-2 ring-amber-500/30 shadow-xl shadow-amber-500/10'
            : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
        }`}
      >
        <div>
          {/* Top Info */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold font-mono">
              {layout.photo_count} Foto
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              Rasio {layout.ratio}
            </span>
          </div>

          <h3 className="text-sm font-bold text-white mb-1 truncate" title={layout.name}>
            {layout.name}
          </h3>
          <p className="text-[11px] font-mono text-zinc-400 mb-3">
            {layout.canvas_width} × {layout.canvas_height} px
          </p>

          {/* Visual Preview Canvas */}
          <div className="relative w-full aspect-[3/4] bg-zinc-950 rounded-xl border border-zinc-800 p-2 flex items-center justify-center overflow-hidden">
            {/* Aspect Container */}
            <div
              className="relative h-full max-h-full rounded bg-zinc-900/90 border border-dashed border-zinc-800 shadow-inner"
              style={{
                aspectRatio: `${layout.canvas_width} / ${layout.canvas_height}`,
              }}
            >
              {/* Render White/Semi-transparent Slots based on Percentages */}
              {layout.slots &&
                layout.slots.map((slot) => (
                  <div
                    key={slot.index}
                    style={{
                      position: 'absolute',
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      width: `${slot.width}%`,
                      height: `${slot.height}%`,
                    }}
                    className="bg-zinc-100/90 hover:bg-white border border-zinc-300 rounded-[3px] shadow flex items-center justify-center transition-all group"
                  >
                    <span className="text-[9px] font-mono font-bold text-zinc-900">
                      #{slot.index + 1}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Bottom Meta */}
        <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-zinc-500" />
            {frameCount} Frame terhubung
          </span>
          <span className="text-amber-400 font-medium">
            {layout.slots.length} Slot Aktif
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <LayoutGrid className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Kelola Layout Photobooth
              </h1>
              <p className="text-xs text-zinc-400">
                Definisi struktur slot foto & koordinat kanvas (Tabel <code className="text-amber-300 font-mono">layouts</code>)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchLayouts}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Segarkan Data</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-3">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-white">
            Mode Struktur: Read-Only
          </p>
          <p className="text-zinc-400 leading-relaxed text-[11px]">
            Layout menentukan <strong>posisi dan ukuran slot foto</strong> dalam persentase (<code className="text-amber-300">0% – 100%</code>) terhadap kanvas. Setiap <strong>Frame</strong> dekoratif dihubungkan ke salah satu layout ini. Perubahan struktur layout dikelola terpusat melalui query SQL Supabase agar kompatibel dengan sistem cetak kiosk.
          </p>
        </div>
      </div>

      {/* Bagian 1: Layout 1 - 14 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"></span>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">
              Layout 1 – 14
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-medium">
              {mainLayouts.length} Layout
            </span>
          </div>
          <span className="text-[11px] text-zinc-400 font-mono">
            Urutan Numerik #1 s/d #14
          </span>
        </div>

        {mainLayouts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {mainLayouts.map(renderLayoutCard)}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center text-xs text-zinc-400">
            Tidak ada layout dengan format nama Layout 1 – 14.
          </div>
        )}
      </div>

      {/* Bagian 2: Layout Lainnya (Selain 1-14 di bawahnya) */}
      {otherLayouts.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-zinc-800/80">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-500"></span>
              <h2 className="text-sm font-bold text-zinc-300 tracking-wide uppercase">
                Layout Lainnya
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-mono font-medium">
                {otherLayouts.length} Layout
              </span>
            </div>
            <span className="text-[11px] text-zinc-500">
              Format non-standar / tambahan
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {otherLayouts.map(renderLayoutCard)}
          </div>
        </div>
      )}

      {/* Selected Layout Detailed Inspector */}
      {activeSelectedLayout && (
        <div className="rounded-2xl bg-zinc-900/80 border border-zinc-800 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-amber-400" />
                Detail Struktur Slot: {activeSelectedLayout.name}
              </h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                ID: {activeSelectedLayout.id}
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-zinc-400">
                Kanvas: <strong className="text-white">{activeSelectedLayout.canvas_width} × {activeSelectedLayout.canvas_height} px</strong>
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-400">
                Rasio: <strong className="text-white">{activeSelectedLayout.ratio}</strong>
              </span>
            </div>
          </div>

          {/* Slots Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-[11px] font-mono uppercase">
                  <th className="py-2 px-3">Slot #</th>
                  <th className="py-2 px-3">Posisi X (%)</th>
                  <th className="py-2 px-3">Posisi Y (%)</th>
                  <th className="py-2 px-3">Lebar (%)</th>
                  <th className="py-2 px-3">Tinggi (%)</th>
                  <th className="py-2 px-3">Ukuran Pixel Aktual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                {activeSelectedLayout.slots.map((slot) => {
                  const pixelX = Math.round((slot.x / 100) * activeSelectedLayout.canvas_width);
                  const pixelY = Math.round((slot.y / 100) * activeSelectedLayout.canvas_height);
                  const pixelW = Math.round((slot.width / 100) * activeSelectedLayout.canvas_width);
                  const pixelH = Math.round((slot.height / 100) * activeSelectedLayout.canvas_height);

                  return (
                    <tr key={slot.index} className="hover:bg-zinc-800/40 text-zinc-300">
                      <td className="py-2.5 px-3 font-bold text-amber-400">
                        Slot #{slot.index + 1}
                      </td>
                      <td className="py-2.5 px-3">{slot.x.toFixed(2)}%</td>
                      <td className="py-2.5 px-3">{slot.y.toFixed(2)}%</td>
                      <td className="py-2.5 px-3">{slot.width.toFixed(2)}%</td>
                      <td className="py-2.5 px-3">{slot.height.toFixed(2)}%</td>
                      <td className="py-2.5 px-3 text-zinc-400">
                        {pixelW} × {pixelH} px (offset: {pixelX}, {pixelY})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
