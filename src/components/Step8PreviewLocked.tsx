import React, { useEffect, useState } from 'react';
import {
  Lock,
  ArrowLeft,
  CreditCard,
  Printer,
  Smartphone,
  Check,
  Gift,
  Sparkles,
} from 'lucide-react';
import {
  FilterPreset,
  PhotoboothLayout,
  CustomDecorationItem,
  SlotAdjustmentsMap,
  EventConfig,
  PhotoboothSession,
} from '../types';
import { renderCompositedPhoto } from '../utils/canvasRenderer';
import { supabase, HARDCODED_EVENT_ID } from '../supabaseClient';
import { uploadFinalPhotoToStorage, uploadBoomerangToStorage } from '../services/storageService';
import { generateUuid } from '../utils/idGenerator';

interface Step8PreviewLockedProps {
  photos: string[];
  slotAssignments: { [slotIndex: number]: string };
  slotAdjustments?: SlotAdjustmentsMap;
  layout: PhotoboothLayout;
  frameUrl?: string;
  filter: FilterPreset;
  price: number;
  decorations?: CustomDecorationItem[];
  eventConfig?: EventConfig;
  selectedPackage?: 'digital' | 'print';
  session?: PhotoboothSession;
  onSelectPackage?: (pkg: 'digital' | 'print') => void;
  onProceedToCheckout: (watermarkedPhotoUrl: string, chosenPackage?: 'digital' | 'print') => void;
  onBack: () => void;
}

export const Step8PreviewLocked: React.FC<Step8PreviewLockedProps> = ({
  photos = [],
  slotAssignments,
  slotAdjustments,
  layout,
  frameUrl,
  filter,
  price,
  decorations = [],
  eventConfig,
  selectedPackage = 'print',
  session,
  onSelectPackage,
  onProceedToCheckout,
  onBack,
}) => {
  const [watermarkedImg, setWatermarkedImg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isFreeEvent =
    eventConfig?.isFreeEvent === true ||
    (eventConfig?.hargaPerFoto === 0 &&
      (eventConfig?.hargaDigital ?? 0) === 0 &&
      (eventConfig?.hargaPrint ?? 0) === 0) ||
    price === 0;

  const packagesAllowed = eventConfig?.packagesAllowed || 'both';

  // Sinkronisasi paket jika mode single-package
  useEffect(() => {
    if (packagesAllowed === 'digital_only' && selectedPackage !== 'digital') {
      onSelectPackage?.('digital');
    } else if (packagesAllowed === 'print_only' && selectedPackage !== 'print') {
      onSelectPackage?.('print');
    }
  }, [packagesAllowed, selectedPackage, onSelectPackage]);

  const priceDigital = eventConfig?.hargaDigital ?? (isFreeEvent ? 0 : 10000);
  const pricePrint =
    eventConfig?.hargaPrint ??
    (isFreeEvent ? 0 : eventConfig?.hargaPerFoto ? eventConfig.hargaPerFoto : 25000);

  const currentPrice = selectedPackage === 'digital' ? priceDigital : pricePrint;

  // Generate watermarked composited canvas image & OTOMATIS simpan file HD ke Cloud Storage di Step 7
  useEffect(() => {
    let isMounted = true;
    async function generateAndSave() {
      setIsLoading(true);
      try {
        // 1. Generate watermarked image untuk tampilan pratinjau pengunjung
        const result = await renderCompositedPhoto({
          photoSrc: photos[0],
          slotPhotos: slotAssignments,
          slotAdjustments,
          layout: layout,
          filter,
          frameUrl: frameUrl,
          decorations,
          withWatermark: !isFreeEvent, // Bebas watermark jika event gratis
        });
        if (isMounted) {
          setWatermarkedImg(result);
        }

        // 2. DI LANGKAH 7: Render foto bersih (tanpa watermark) & langsung simpan ke Supabase Storage & Database
        if (session && session.id) {
          renderCompositedPhoto({
            photoSrc: session.fotoOriginal || photos[0],
            slotPhotos: slotAssignments,
            slotAdjustments,
            layout: layout,
            filter,
            frameUrl: frameUrl,
            decorations,
            withWatermark: false, // File asli bersih tanpa watermark
          })
            .then(async (cleanResult) => {
              // Upload foto final HD ke Supabase Storage (Bucket 'photos')
              const uploadRes = await uploadFinalPhotoToStorage(
                session.id,
                cleanResult,
                session.frame_layout_id,
                isFreeEvent ? 'paid' : 'draft'
              );

              // Upsert data session ke tabel sessions
              const sessionPayload: any = {
                id: session.id,
                event_id: session.eventId || eventConfig?.id || HARDCODED_EVENT_ID,
                status: isFreeEvent ? 'paid' : 'draft',
                filter_applied: session.filterDipilih,
              };
              if (session.frame_layout_id) {
                sessionPayload.frame_layout_id = session.frame_layout_id;
              }
              if (session.frameDipilih) {
                sessionPayload.frame_id = session.frameDipilih;
              }
              if (uploadRes?.publicUrl) {
                sessionPayload.final_url = uploadRes.publicUrl;
              }
              await supabase.from('sessions').upsert([sessionPayload], { onConflict: 'id' });

              // Upload boomerang jika ada
              if (session.slotBoomerangs && Object.keys(session.slotBoomerangs).length > 0) {
                Object.entries(session.slotBoomerangs).forEach(([slotIdx, clip]) => {
                  if (clip) {
                    uploadBoomerangToStorage(session.id, clip as string | Blob, Number(slotIdx)).catch((e) =>
                      console.warn(`Upload boomerang slot ${slotIdx} error:`, e)
                    );
                  }
                });
              } else if (session.boomerangVideoUrl) {
                uploadBoomerangToStorage(session.id, session.boomerangVideoUrl, 'frame').catch((e) =>
                  console.warn('Upload boomerang error:', e)
                );
              }

              console.log('✅ File dan sesi berhasil disimpan ke Supabase di Langkah 7:', session.id);
            })
            .catch((saveErr) => {
              console.warn('Simpan file HD di Langkah 7 note:', saveErr);
            });
        }
      } catch (err) {
        console.error('Gagal generate locked preview:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    generateAndSave();
    return () => {
      isMounted = false;
    };
  }, [photos, slotAssignments, slotAdjustments, filter, layout, frameUrl, decorations, isFreeEvent, session, currentPrice]);

  const formattedPrice = (val: number) => {
    if (val === 0 || isFreeEvent) return 'GRATIS (Rp 0)';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="flex-1 flex flex-col max-w-md mx-auto w-full relative">
      {/* Scrollable Content dengan padding bawah */}
      <div className="p-4 pb-44 sm:pb-32 space-y-3">
        {/* Top Header */}
        <div className="shrink-0">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Hias Foto</span>
          </button>

          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            Pratinjau Akhir
          </span>
        </div>

        <div className="text-center pt-2 pb-1">
          {isFreeEvent ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold mb-1">
              <Gift className="w-3.5 h-3.5" />
              <span>Sesi Foto Gratis • Hadiah Event</span>
            </div>
          ) : (
            <p className="text-[11px] font-mono tracking-widest text-amber-400 uppercase mb-0.5">
              Pratinjau Hasil Cetak
            </p>
          )}

          <h2 className="text-base font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
            {!isFreeEvent && <Lock className="w-4 h-4 text-amber-400" />}
            <span>Hasil Akhir Siap Cetak</span>
          </h2>
          <p className="text-[11px] text-zinc-400">
            {isFreeEvent
              ? 'Foto Anda siap disimpan dan dicetak tanpa dipungut biaya!'
              : 'Pilih paket yang diinginkan lalu lanjutkan ke pembayaran'}
          </p>
        </div>
      </div>

      {/* Watermarked Photo Container */}
      <div className="relative w-full h-[42vh] sm:h-[46vh] md:h-[50vh] min-h-[280px] max-h-[500px] flex items-center justify-center my-2 overflow-hidden">
        {isLoading || !watermarkedImg ? (
          <div className="w-full h-full max-w-xs flex flex-col items-center justify-center gap-2 text-zinc-400 bg-zinc-950 rounded-2xl border border-zinc-800">
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            <p className="text-xs font-mono">Menyiapkan pratinjau...</p>
          </div>
        ) : (
          <div
            className="relative h-full max-h-[44vh] max-w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl select-none protected-preview flex items-center justify-center"
            style={{
              aspectRatio: `${layout.canvas_width || 1200} / ${layout.canvas_height || 1800}`,
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <img
              src={watermarkedImg}
              alt="Protected Preview"
              className="w-full h-full max-h-[44vh] object-contain pointer-events-none"
              draggable={false}
            />

            {!isFreeEvent && (
              <div
                className="absolute inset-0 bg-transparent cursor-not-allowed"
                title="Foto dilindungi sebelum checkout"
              />
            )}
          </div>
        )}
      </div>

      {/* Package Selector / Price Card */}
      {!isFreeEvent && (
        <div className="shrink-0 my-1.5">
          {packagesAllowed === 'digital_only' ? (
            /* Mode Hanya Digital */
            <div className="p-3 rounded-xl border bg-zinc-900 border-cyan-400/80 shadow-md shadow-cyan-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">Paket Digital Softfile HD</span>
                    <span className="px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 text-[9px] font-bold">
                      Aktif
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 block">File HD asli dikirimkan oleh admin via WhatsApp</span>
                </div>
              </div>
              <span className="text-sm font-mono font-bold text-cyan-300">
                {formattedPrice(priceDigital)}
              </span>
            </div>
          ) : packagesAllowed === 'print_only' ? (
            /* Mode Hanya Cetak */
            <div className="p-3 rounded-xl border bg-zinc-900 border-amber-400/80 shadow-md shadow-amber-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Printer className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">Paket Cetak Fisik + HD</span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[9px] font-bold">
                      Aktif
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400 block">Cetak foto strip tebal & bonus softfile dikirim via WA</span>
                </div>
              </div>
              <span className="text-sm font-mono font-bold text-amber-300">
                {formattedPrice(pricePrint)}
              </span>
            </div>
          ) : (
            /* Mode Keduanya (Bisa Pilih Salah Satu) */
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSelectPackage && onSelectPackage('digital')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedPackage === 'digital'
                    ? 'bg-zinc-900 border-cyan-400 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/40'
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-white flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Softfile Digital</span>
                  </span>
                  {selectedPackage === 'digital' && (
                    <div className="w-4 h-4 rounded-full bg-cyan-400 text-zinc-950 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 block mb-1">Dikirim Admin via WA</span>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {formattedPrice(priceDigital)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelectPackage && onSelectPackage('print')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                  selectedPackage === 'print'
                    ? 'bg-zinc-900 border-amber-400 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/40'
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-white flex items-center gap-1">
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cetak Fisik + HD</span>
                  </span>
                  {selectedPackage === 'print' && (
                    <div className="w-4 h-4 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 block mb-1">Cetak Strip + WA Softfile</span>
                <span className="text-xs font-mono font-bold text-amber-300">
                  {formattedPrice(pricePrint)}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Free Event Notice */}
      {isFreeEvent && (
        <div className="shrink-0 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center my-1">
          <span className="text-xs font-bold text-emerald-300 block">
            🎉 Fasilitas Gratis Tamu Event
          </span>
          <span className="text-[11px] text-emerald-200/80">
            Dapat dicetak dan diunduh langsung tanpa biaya kasir.
          </span>
        </div>
      )}
      </div>

      {/* Bottom Action Bar (Fixed di Bawah Layar Seperti Bottom Nav Menu Admin) */}
      <div className="fixed-bottom-action-bar">
        <button
          id="btn-proceed-to-checkout"
          disabled={isLoading || !watermarkedImg}
          onClick={() =>
            watermarkedImg && onProceedToCheckout(watermarkedImg, selectedPackage)
          }
          className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99] ${
            isFreeEvent
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 shadow-emerald-500/20'
              : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 shadow-amber-500/20'
          }`}
        >
          {isFreeEvent ? (
            <>
              <Printer className="w-4 h-4" />
              <span>Selesai & Simpan Foto (Gratis ➔)</span>
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              <span>
                Lanjut ke Pembayaran ({formattedPrice(currentPrice)})
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
