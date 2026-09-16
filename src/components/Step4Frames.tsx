import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Image as ImageIcon,
  Check,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  ImageOff,
  Loader2,
  Cloud,
} from 'lucide-react';
import { FrameConfig } from '../types';
import { FILTER_PRESETS } from '../data/filters';
import { supabase } from '../supabaseClient';

interface Step4FramesProps {
  eventId?: string;
  eventName?: string;
  originalPhoto: string;
  selectedFilterId: string;
  selectedFrameId: string;
  onSelectFrame: (frameId: string, frameObj?: FrameConfig | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step4Frames: React.FC<Step4FramesProps> = ({
  eventId,
  eventName,
  originalPhoto,
  selectedFilterId,
  selectedFrameId,
  onSelectFrame,
  onNext,
  onBack,
}) => {
  // Hanya menyimpan data yang didapat dari query Supabase table 'frames' untuk event ini
  const [frames, setFrames] = useState<FrameConfig[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Gunakan ref agar callback fetch tidak berubah setiap kali props berubah (mencegah flickering / infinite loop)
  const onSelectFrameRef = useRef(onSelectFrame);
  onSelectFrameRef.current = onSelectFrame;

  const selectedFrameIdRef = useRef(selectedFrameId);
  selectedFrameIdRef.current = selectedFrameId;

  // Query Supabase table 'frames' secara spesifik HANYA untuk event terkait
  const fetchFramesFromSupabase = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const targetEventId = eventId || '';

    try {
      let query = supabase
        .from('frames')
        .select('*');

      // Filter HANYA untuk event terkait jika eventId tersedia
      if (targetEventId) {
        query = query.eq('event_id', targetEventId);
      }

      const { data, error } = await query.order('sort_order', { ascending: true });

      if (error) {
        console.warn('Error fetching from Supabase frames for event:', targetEventId, error.message);
        setErrorMessage(error.message);
        setFrames([]);
        if (selectedFrameIdRef.current) {
          onSelectFrameRef.current('', null);
        }
      } else if (data && data.length > 0) {
        console.log('Supabase frames for event', targetEventId, ':', data);
        // Tampilkan frame yang aktif dan strictly milik event terkait
        const activeOnly = data.filter((item: any) => {
          const isActive = item.is_active !== false;
          const matchEvent = targetEventId ? String(item.event_id) === String(targetEventId) : true;
          return isActive && matchEvent;
        });

        const mapped: FrameConfig[] = activeOnly.map((item: any) => ({
          id: String(item.id),
          nama: item.name || 'Custom Frame',
          urlGambar: item.image_url || '',
          eventId: item.event_id || '',
          category: 'supabase',
          description: item.name || '',
          accentColor: '#10B981',
        }));

        setFrames(mapped);

        // Jika frame yang sebelumnya dipilih masih ada di daftar frame event ini, pertahankan.
        // Jika tidak atau belum ada, pilih frame pertama dari event ini (jika ada).
        const currentSelected = mapped.find((f) => f.id === selectedFrameIdRef.current);
        if (currentSelected) {
          onSelectFrameRef.current(currentSelected.id, currentSelected);
        } else if (mapped.length > 0) {
          onSelectFrameRef.current(mapped[0].id, mapped[0]);
        } else {
          onSelectFrameRef.current('', null);
        }
      } else {
        // Query berhasil tetapi tidak ada frame untuk event ini
        console.log('No frames found in Supabase for event:', targetEventId);
        setFrames([]);
        if (selectedFrameIdRef.current) {
          onSelectFrameRef.current('', null);
        }
      }
    } catch (err: any) {
      console.warn('Unexpected error querying Supabase frames for event:', targetEventId, err);
      setErrorMessage(err.message || 'Gagal tersambung ke Supabase');
      setFrames([]);
      if (selectedFrameIdRef.current) {
        onSelectFrameRef.current('', null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  // Fetch saat komponen mount atau saat eventId berubah
  useEffect(() => {
    fetchFramesFromSupabase();
  }, [fetchFramesFromSupabase]);

  // Filter visual yang aktif
  const activeFilter =
    FILTER_PRESETS.find((f) => f.id === selectedFilterId) || FILTER_PRESETS[0];

  // Frame yang sedang aktif dipilih dari daftar frames Supabase
  const activeFrame = frames.find((f) => f.id === selectedFrameId) || null;

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-amber-400" />
            Pilih Frame & Border
          </h2>
          <p className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
            <Cloud className="w-3 h-3 text-emerald-400 inline" />
            <span>Supabase: {isLoading ? 'Memuat...' : `${frames.length} frame`}</span>
          </p>
        </div>

        <button
          onClick={fetchFramesFromSupabase}
          disabled={isLoading}
          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-emerald-400 disabled:opacity-50 transition-colors flex items-center gap-1 text-xs"
          title="Refresh query Supabase frames"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          <span className="text-[10px] hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Main Preview: Photo + Filter + Frame Overlay (Hanya jika frame tersedia dan dipilih) */}
      <div className="relative w-full aspect-[4/5] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center my-auto">
        <div className="relative w-full h-full">
          {/* Base Photo with Filter */}
          <img
            src={originalPhoto}
            alt="Preview Foto"
            className="w-full h-full object-cover"
            style={{ filter: activeFilter.cssFilter }}
          />

          {/* Filter Tint */}
          {activeFilter.tint && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundColor: `rgba(${activeFilter.tint.r}, ${activeFilter.tint.g}, ${activeFilter.tint.b}, ${activeFilter.tint.alpha})`,
              }}
            />
          )}

          {/* Transparent Frame Overlay - HANYA tampil jika activeFrame ada dan memiliki urlGambar */}
          {activeFrame && activeFrame.urlGambar ? (
            <img
              src={activeFrame.urlGambar}
              alt={activeFrame.nama}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
            />
          ) : null}

          {/* Frame Label Badge */}
          <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md border border-white/15 text-[10px] font-mono text-zinc-200">
            {activeFrame ? activeFrame.nama : 'Tanpa Frame'}
          </div>
        </div>
      </div>

      {/* Frame Selection Container - Menampilkan HANYA data dari Supabase */}
      <div className="py-2 space-y-2">
        {isLoading ? (
          /* Loading State */
          <div className="py-8 px-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-center flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            <p className="text-xs text-zinc-400 font-mono">Memuat frame dari Supabase...</p>
          </div>
        ) : frames.length === 0 ? (
          /* Empty State: Tampilkan pesan bahwa belum ada frame untuk event ini */
          <div className="py-7 px-4 rounded-xl bg-zinc-900/70 border border-zinc-800 text-center flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mb-2 text-zinc-500">
              <ImageOff className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-zinc-200">Belum ada frame untuk event ini</p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-[260px]">
              {eventName ? `Event "${eventName}"` : 'Event ini'} belum memiliki bingkai foto khusus. Anda tetap bisa melanjutkan tanpa bingkai foto.
            </p>
            {errorMessage && (
              <p className="text-[10px] font-mono text-rose-400 mt-2 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                {errorMessage}
              </p>
            )}
            <button
              onClick={fetchFramesFromSupabase}
              className="mt-3 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium flex items-center gap-1.5 transition-colors border border-zinc-700 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Cek Ulang Supabase</span>
            </button>
          </div>
        ) : (
          /* List of Real Frames from Supabase for this event */
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-0.5">
              <span>Pilih dari {frames.length} frame event ini:</span>
              <button
                onClick={() => onSelectFrame('', null)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                  !selectedFrameId
                    ? 'border-amber-400 bg-amber-400/10 text-amber-400 font-semibold'
                    : 'border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Tanpa Frame
              </button>
            </div>

            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {frames.map((frame) => {
                const isSelected = frame.id === selectedFrameId;

                return (
                  <button
                    key={frame.id}
                    id={`frame-${frame.id}`}
                    onClick={() => onSelectFrame(frame.id, frame)}
                    className={`flex-shrink-0 w-24 p-2 rounded-xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/10 shadow-md shadow-amber-500/10'
                        : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-700'
                    }`}
                  >
                    {/* Frame Thumbnail */}
                    <div className="w-full aspect-[4/5] rounded-lg bg-zinc-950 border border-zinc-800 relative overflow-hidden flex items-center justify-center p-1">
                      {frame.urlGambar ? (
                        <img
                          src={frame.urlGambar}
                          alt={frame.nama}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            // Fallback jika image_url tidak dapat dimuat
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-zinc-600" />
                      )}
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-semibold mt-1.5 truncate block ${
                        isSelected ? 'text-amber-400' : 'text-zinc-300'
                      }`}
                      title={frame.nama}
                    >
                      {frame.nama}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3 pt-1 pb-2">
        <button
          id="btn-frame-back"
          onClick={onBack}
          className="flex-1 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali</span>
        </button>

        <button
          id="btn-frame-next"
          onClick={onNext}
          className="flex-2 py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
        >
          <span>Lihat Preview Hasil</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
