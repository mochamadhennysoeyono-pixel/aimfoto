import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import {
  Download,
  Printer,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Loader2,
  Check,
  PartyPopper,
  Cloud,
  QrCode,
  Copy,
  ExternalLink,
  Smartphone,
  X,
  Layers,
} from 'lucide-react';
import { FilterPreset, PhotoboothOrder, PhotoboothSession, PhotoboothLayout } from '../types';
import { renderCompositedPhoto, downloadDataUrl } from '../utils/canvasRenderer';
import { sendToPrinter } from '../services/printerService';
import { playSuccessChime } from '../utils/audioEffects';
import { uploadFinalPhotoToStorage } from '../services/storageService';

interface Step10FinalSuccessProps {
  session: PhotoboothSession;
  order: PhotoboothOrder;
  filter: FilterPreset;
  layout: PhotoboothLayout;
  frameUrl?: string;
  onRestart: () => void;
}

export const Step10FinalSuccess: React.FC<Step10FinalSuccessProps> = ({
  session,
  order,
  filter,
  layout,
  frameUrl,
  onRestart,
}) => {
  const [finalHdPhoto, setFinalHdPhoto] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  // Cloud Storage & QR States
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [cloudPhotoUrl, setCloudPhotoUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Printer modal states
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [printStatus, setPrintStatus] = useState<'idle' | 'transmitting' | 'printing' | 'completed'>('idle');
  const [printJobId, setPrintJobId] = useState<string | null>(null);

  // 1. Render full HD unwatermarked composited photo
  useEffect(() => {
    let isMounted = true;
    async function renderHd() {
      setIsRendering(true);
      try {
        const result = await renderCompositedPhoto({
          photoSrc: session.fotoOriginal,
          slotPhotos: session.slotAssignments,
          layout: layout,
          filter,
          frameUrl: frameUrl,
          decorations: session.decorations,
          withWatermark: false, // 100% UNWATERMARKED
        });

        if (isMounted) {
          setFinalHdPhoto(result);
          // Play celebration chime
          playSuccessChime();

          // Fire celebratory confetti bursts
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#FFFFFF'],
            });
          } catch (e) {
            console.warn('Confetti error:', e);
          }

          // 2. Otomatis upload ke Supabase Storage & simpan frame_layout_id ke sessions
          uploadToCloud(result);
        }
      } catch (err) {
        console.error('Gagal render HD photo:', err);
      } finally {
        if (isMounted) setIsRendering(false);
      }
    }

    renderHd();
    return () => {
      isMounted = false;
    };
  }, [session.fotoOriginal, session.slotAssignments, filter, layout, frameUrl]);

  // Upload ke Supabase Storage & buat QR Code
  const uploadToCloud = async (photoDataUrl: string) => {
    setUploadStatus('uploading');
    try {
      const res = await uploadFinalPhotoToStorage(session.id, photoDataUrl, session.frame_layout_id);
      if (res.success && res.publicUrl) {
        setUploadStatus('success');
        setCloudPhotoUrl(res.publicUrl);

        // Buat QR Code untuk di-scan pengunjung dari layar Kiosk
        try {
          const qr = await QRCode.toDataURL(res.publicUrl, {
            width: 280,
            margin: 2,
            color: {
              dark: '#0b0d13',
              light: '#ffffff',
            },
          });
          setQrCodeDataUrl(qr);
        } catch (qrErr) {
          console.warn('Gagal generate QR Code:', qrErr);
        }
      } else {
        setUploadStatus('error');
      }
    } catch (err) {
      console.warn('Gagal upload ke storage:', err);
      setUploadStatus('error');
    }
  };

  // Handle Download to device
  const handleDownload = () => {
    if (finalHdPhoto) {
      const filename = `snapmoment-${session.id.slice(0, 8)}.jpg`;
      downloadDataUrl(finalHdPhoto, filename);
    }
  };

  // Handle Kiosk Printer Command
  const handlePrint = async () => {
    if (!finalHdPhoto) return;
    setPrinterModalOpen(true);
    setPrintStatus('transmitting');

    try {
      setTimeout(() => setPrintStatus('printing'), 1000);
      const result = await sendToPrinter(order.id, finalHdPhoto);
      setPrintJobId(result.jobId);
      setPrintStatus('completed');
    } catch (err) {
      console.error('Gagal kirim ke printer:', err);
      setPrintStatus('idle');
    }
  };

  // Handle Salin Link Cloud
  const handleCopyLink = async () => {
    if (!cloudPhotoUrl) return;
    try {
      await navigator.clipboard.writeText(cloudPhotoUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (e) {
      console.warn('Gagal menyalin:', e);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full p-4 overflow-y-auto">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pembayaran Lunas
          </div>

          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            Langkah 10 dari 10
          </span>
        </div>

        <div className="text-center pt-3 pb-2">
          <div className="inline-flex items-center justify-center p-2 rounded-full bg-amber-500/10 text-amber-400 mb-1">
            <PartyPopper className="w-5 h-5 animate-bounce" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Momen Anda Siap Diunduh & Dicetak!
          </h2>
          <p className="text-xs text-zinc-400">
            Foto HD tanpa watermark dengan layout pilihan Anda
          </p>
        </div>
      </div>

      {/* Final HD Unwatermarked Photo Container */}
      <div className="relative w-full flex-1 flex items-center justify-center my-auto min-h-[38vh] max-h-[48vh] p-1">
        {isRendering || !finalHdPhoto ? (
          <div className="w-full h-full max-w-xs flex flex-col items-center justify-center gap-2 text-zinc-400 bg-zinc-950 rounded-2xl border border-zinc-800">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
            <p className="text-xs font-mono">Merender foto beresolusi tinggi (HD)...</p>
          </div>
        ) : (
          <div
            className="relative max-h-full max-w-full rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl flex items-center justify-center"
            style={{
              aspectRatio: `${layout?.canvas_width || 1200} / ${layout?.canvas_height || 1800}`,
              height: '100%',
            }}
          >
            <img
              src={finalHdPhoto}
              alt="Hasil Akhir Photobooth"
              className="w-full h-full object-contain"
            />
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-mono text-emerald-400 flex items-center gap-1 shadow-md">
              <Check className="w-3 h-3 stroke-[3]" />
              Bebas Watermark (HD)
            </div>
          </div>
        )}
      </div>

      {/* Cloud & QR Sync Status */}
      <div className="py-2">
        {uploadStatus === 'uploading' && (
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-zinc-400 py-1 bg-zinc-900/60 rounded-xl border border-zinc-800">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>Mengunggah ke Cloud Storage...</span>
          </div>
        )}

        {uploadStatus === 'success' && cloudPhotoUrl && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-amber-500/30">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Cloud className="w-4 h-4" />
              </div>
              <div className="truncate">
                <span className="text-[11px] font-bold text-white block">
                  Foto Tersimpan di Cloud
                </span>
                <span className="text-[10px] text-zinc-400 font-mono truncate block">
                  Scan QR untuk unduh ke ponsel
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsQrModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Buka QR</span>
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons: Print, Download, Restart */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <div className="grid grid-cols-2 gap-2">
          {/* Print Button */}
          <button
            id="btn-print-kiosk"
            disabled={!finalHdPhoto}
            onClick={handlePrint}
            className="py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Kiosk</span>
          </button>

          {/* Download Button */}
          <button
            id="btn-download-photo"
            disabled={!finalHdPhoto}
            onClick={handleDownload}
            className="py-3 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 border border-zinc-700"
          >
            <Download className="w-4 h-4" />
            <span>Simpan ke Perangkat</span>
          </button>
        </div>

        {/* Start Fresh Session */}
        <button
          id="btn-start-fresh"
          onClick={onRestart}
          className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 border border-zinc-800 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Selesai & Foto Sesi Baru</span>
        </button>
      </div>

      {/* MODAL QR CODE DOWNLOAD */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xs w-full p-5 space-y-4 shadow-2xl text-center relative">
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-3 right-3 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pt-2">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center mb-2">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Scan untuk Unduh</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Buka kamera smartphone tamu dan arahkan ke QR Code di bawah
              </p>
            </div>

            {/* Rendered QR Code */}
            <div className="p-3 bg-white rounded-xl mx-auto w-fit shadow-md">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="QR Code Unduh" className="w-48 h-48 mx-auto" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-zinc-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-800" />
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleCopyLink}
                className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Tautan Disalin!' : 'Salin Tautan'}</span>
              </button>

              <button
                onClick={() => setIsQrModalOpen(false)}
                className="w-full py-2 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRINTER TRANSMISSION STATUS */}
      {printerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xs w-full p-5 space-y-4 shadow-2xl text-center relative">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
              <Printer className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">
                {printStatus === 'transmitting' && 'Mengirim ke Mesin Cetak...'}
                {printStatus === 'printing' && 'Sedang Mencetak Foto...'}
                {printStatus === 'completed' && 'Cetak Selesai!'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {printStatus === 'completed'
                  ? 'Silakan ambil foto Anda di baki printer Kiosk.'
                  : 'Harap tunggu beberapa detik, mesin printer sedang memproses.'}
              </p>
            </div>

            <div className="py-2">
              {printStatus !== 'completed' ? (
                <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center mx-auto shadow-md">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
              )}
            </div>

            {printJobId && (
              <p className="text-[10px] font-mono text-zinc-500">
                Job ID: {printJobId}
              </p>
            )}

            {printStatus === 'completed' && (
              <button
                onClick={() => setPrinterModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 cursor-pointer"
              >
                Selesai
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
