import React, { useEffect, useState } from 'react';
import { Lock, ArrowLeft, CreditCard, ShieldAlert, Sparkles, Printer } from 'lucide-react';
import { FilterPreset, FrameConfig } from '../types';
import { renderCompositedPhoto } from '../utils/canvasRenderer';

interface Step5PreviewLockedProps {
  originalPhoto: string;
  photos?: string[];
  slotAssignments?: { [slotIndex: number]: string };
  filter: FilterPreset;
  frame?: FrameConfig | null;
  price: number;
  onProceedToCheckout: (watermarkedPhotoUrl: string) => void;
  onBackToFrames: () => void;
}

export const Step5PreviewLocked: React.FC<Step5PreviewLockedProps> = ({
  originalPhoto,
  photos = [],
  slotAssignments,
  filter,
  frame,
  price,
  onProceedToCheckout,
  onBackToFrames,
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
          photoSrc: originalPhoto,
          slotPhotos: slotAssignments,
          layout: frame?.layout,
          layoutType: frame?.layoutType,
          filter,
          frameUrl: frame?.urlGambar,
          withWatermark: true,
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
  }, [originalPhoto, slotAssignments, filter, frame]);

  const formattedPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(price);

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full p-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-amber-400" />
            Pratinjau Terkunci
          </h2>
          <p className="text-[11px] text-zinc-400 font-mono">
            Watermark dihapus otomatis setelah checkout
          </p>
        </div>

        <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" />
          Preview Mode
        </span>
      </div>

      {/* Watermarked Photo Container with Security Measures */}
      <div className="relative w-full aspect-[4/5] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center my-auto">
        {isLoading || !watermarkedImg ? (
          <div className="flex flex-col items-center justify-center gap-2 text-zinc-400">
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <p className="text-xs font-mono">Menyiapkan pratinjau proteksi...</p>
          </div>
        ) : (
          <div
            className="relative w-full h-full select-none protected-preview"
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* The Image with security protections */}
            <img
              src={watermarkedImg}
              alt="Hasil Photobooth (Terkunci)"
              draggable={false}
              className="w-full h-full object-cover pointer-events-none filter blur-[0.3px]"
              onContextMenu={(e) => e.preventDefault()}
            />

            {/* Transparent click blocker overlay */}
            <div
              className="absolute inset-0 z-20"
              onContextMenu={(e) => e.preventDefault()}
              onTouchStart={(e) => {
                // Prevent long press menu
                e.stopPropagation();
              }}
            />

            {/* Floating Protection Notice */}
            <div className="absolute bottom-3 left-3 right-3 z-30 p-2.5 rounded-xl bg-zinc-950/85 backdrop-blur-md border border-amber-500/30 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="text-[11px] text-zinc-200 leading-tight">
                <p className="font-semibold text-white">Watermark & Blur Sementara</p>
                <p className="text-zinc-400 text-[10px]">
                  Buka kunci file HD jernih & cetak fisik di kiosk via checkout.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Package Perks Summary */}
      <div className="py-2.5 grid grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="text-[11px] leading-tight text-zinc-300">
            <span className="font-semibold text-white block">File Digital HD</span>
            Resolusi penuh tanpa watermark
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex items-center gap-2">
          <Printer className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="text-[11px] leading-tight text-zinc-300">
            <span className="font-semibold text-white block">Cetak Kiosk Fisik</span>
            Kertas foto studio glossy
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1 pb-2">
        <button
          id="btn-preview-back"
          onClick={onBackToFrames}
          className="py-3.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Ganti Gaya</span>
        </button>

        <button
          id="btn-preview-checkout"
          disabled={isLoading || !watermarkedImg}
          onClick={() => watermarkedImg && onProceedToCheckout(watermarkedImg)}
          className="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
        >
          <CreditCard className="w-4 h-4" />
          <span>Checkout & Cetak ({formattedPrice})</span>
        </button>
      </div>
    </div>
  );
};
