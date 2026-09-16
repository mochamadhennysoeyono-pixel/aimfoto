import React, { useEffect, useState } from 'react';
import { Lock, ArrowLeft, CreditCard, ShieldAlert, Sparkles, Printer } from 'lucide-react';
import { FilterPreset, FrameConfig, PhotoboothLayout, CustomDecorationItem } from '../types';
import { renderCompositedPhoto } from '../utils/canvasRenderer';

interface Step8PreviewLockedProps {
  photos: string[];
  slotAssignments: { [slotIndex: number]: string };
  layout: PhotoboothLayout;
  frameUrl?: string;
  filter: FilterPreset;
  price: number;
  decorations?: CustomDecorationItem[];
  onProceedToCheckout: (watermarkedPhotoUrl: string) => void;
  onBack: () => void;
}

export const Step8PreviewLocked: React.FC<Step8PreviewLockedProps> = ({
  photos = [],
  slotAssignments,
  layout,
  frameUrl,
  filter,
  price,
  decorations = [],
  onProceedToCheckout,
  onBack,
}) => {
  const [watermarkedImg, setWatermarkedImg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Generate watermarked composited canvas image
  useEffect(() => {
    let isMounted = true;
    async function generate() {
      setIsLoading(true);
      try {
        const result = await renderCompositedPhoto({
          photoSrc: photos[0],
          slotPhotos: slotAssignments,
          layout: layout,
          filter,
          frameUrl: frameUrl,
          decorations,
          withWatermark: true, // WATERMARKED FOR SECURITY
        });
        if (isMounted) {
          setWatermarkedImg(result);
        }
      } catch (err) {
        console.error('Gagal generate locked preview:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    generate();
    return () => {
      isMounted = false;
    };
  }, [photos, slotAssignments, filter, layout, frameUrl, decorations]);

  const formattedPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(price);

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full p-4 min-h-0 overflow-y-auto">
      {/* Top Header */}
      <div className="shrink-0">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Overlay</span>
          </button>

          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            Langkah 8 dari 10
          </span>
        </div>

        <div className="text-center pt-2 pb-1.5">
          <p className="text-[11px] font-mono tracking-widest text-amber-400 uppercase mb-0.5">
            Step 8: Pratinjau Terkunci
          </p>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
            <Lock className="w-4 h-4 text-amber-400" />
            Pratinjau Hasil Cetak
          </h2>
          <p className="text-[11px] text-zinc-400 font-mono">
            Watermark keamanan akan otomatis dihapus setelah pembayaran
          </p>
        </div>
      </div>

      {/* Watermarked Photo Container */}
      <div className="relative w-full flex-1 flex items-center justify-center my-2 min-h-[260px] max-h-[50vh] overflow-hidden">
        {isLoading || !watermarkedImg ? (
          <div className="w-full h-full max-w-xs flex flex-col items-center justify-center gap-2 text-zinc-400 bg-zinc-950 rounded-2xl border border-zinc-800">
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <p className="text-xs font-mono">Menyiapkan pratinjau proteksi...</p>
          </div>
        ) : (
          <div
            className="relative h-full max-h-[46vh] max-w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl select-none protected-preview flex items-center justify-center"
            style={{
              aspectRatio: `${layout.canvas_width || 1200} / ${layout.canvas_height || 1800}`,
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <img
              src={watermarkedImg}
              alt="Protected Preview"
              className="w-full h-full max-h-[46vh] object-contain pointer-events-none"
              draggable={false}
            />

            {/* Anti-screenshot transparent click interceptor */}
            <div
              className="absolute inset-0 bg-transparent cursor-not-allowed"
              title="Foto dilindungi hak cipta sebelum checkout"
            />
          </div>
        )}
      </div>

      {/* Price & Guarantee Pill */}
      <div className="shrink-0 flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 my-1.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Printer className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 uppercase font-mono block">
              Paket Cetak & Unduh Digital
            </span>
            <span className="text-sm font-bold text-white font-mono">
              {formattedPrice}
            </span>
          </div>
        </div>

        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
          Kualitas 300 DPI HD
        </span>
      </div>

      {/* Action Button */}
      <div className="shrink-0 pt-2 pb-1 border-t border-zinc-800">
        <button
          id="btn-proceed-to-checkout"
          disabled={isLoading || !watermarkedImg}
          onClick={() => watermarkedImg && onProceedToCheckout(watermarkedImg)}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <CreditCard className="w-4 h-4" />
          <span>Lanjut ke Pembayaran ({formattedPrice})</span>
        </button>
      </div>
    </div>
  );
};
