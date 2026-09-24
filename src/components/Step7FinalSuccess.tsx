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
} from 'lucide-react';
import { FilterPreset, FrameConfig, PhotoboothOrder, PhotoboothSession } from '../types';
import { renderCompositedPhoto, downloadDataUrl } from '../utils/canvasRenderer';
import { sendToPrinter } from '../services/printerService';
import { playSuccessChime } from '../utils/audioEffects';
import { uploadFinalPhotoToStorage } from '../services/storageService';

interface Step7FinalSuccessProps {
  session: PhotoboothSession;
  order: PhotoboothOrder;
  filter: FilterPreset;
  frame?: FrameConfig | null;
  onRestart: () => void;
}

export const Step7FinalSuccess: React.FC<Step7FinalSuccessProps> = ({
  session,
  order,
  filter,
  frame,
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
          layout: frame?.layout || session.layout,
          layoutType: session.layoutType || frame?.layoutType,
          filter,
          frameUrl: frame?.urlGambar,
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

          // 2. Otomatis upload ke Supabase Storage
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
  }, [session.fotoOriginal, filter, frame]);

  // Upload ke Supabase Storage & buat QR Code
  const uploadToCloud = async (photoDataUrl: string) => {
    setUploadStatus('uploading');
    try {
      const res = await uploadFinalPhotoToStorage(session.id, photoDataUrl);
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
    <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full p-4">
      {/* Top Header Badge */}
      <div className="flex items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              Pembayaran Berhasil!
            </h2>
            <p className="text-[10px] font-mono text-zinc-400">
              TRX: {order.transactionId || order.id.slice(0, 8)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {uploadStatus === 'uploading' && (
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Cloud Sync...
            </span>
          )}
          {uploadStatus === 'success' && (
            <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Cloud className="w-3 h-3" />
              Cloud Siap
            </span>
          )}
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <PartyPopper className="w-3 h-3" />
            HD Siap
          </span>
        </div>
      </div>

      {/* Main Final HD Photo (Clean & Unwatermarked) */}
      <div className="relative w-full aspect-[4/5] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center my-auto">
        {isRendering || !finalHdPhoto ? (
          <div className="flex flex-col items-center justify-center gap-2 text-zinc-400">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <p className="text-xs font-mono">Menyiapkan cetakan resolusi penuh...</p>
          </div>
        ) : (
          <div className="relative w-full h-full group">
            <img
              src={finalHdPhoto}
              alt="Foto Final Photobooth"
              className="w-full h-full object-cover"
            />
            {/* Resolution watermark free badge */}
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              1080 × 1350 • ZERO WATERMARK
            </div>

            {/* Quick QR Float Button on Preview */}
            {cloudPhotoUrl && (
              <button
                onClick={() => setIsQrModalOpen(true)}
                className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-amber-500/40 text-amber-400 text-xs font-bold flex items-center gap-1.5 shadow-xl active:scale-95 transition-all cursor-pointer backdrop-blur-md"
              >
                <QrCode className="w-4 h-4" />
                <span>QR Download HP</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cloud Status Notice */}
      {uploadStatus === 'success' && cloudPhotoUrl && (
        <div className="mt-2 p-2 px-3 rounded-xl bg-sky-950/40 border border-sky-800/50 flex items-center justify-between text-xs text-sky-200">
          <div className="flex items-center gap-2 truncate mr-2">
            <Cloud className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="truncate text-[11px]">Tersimpan di Supabase Storage</span>
          </div>
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5" />
            Buka QR
          </button>
        </div>
      )}

      {/* Action Buttons: Download, Print, QR Code, Restart */}
      <div className="pt-2.5 pb-1 space-y-2">
        <div className="flex items-center gap-2">
          {/* Download Button */}
          <button
            id="btn-download-photo"
            onClick={handleDownload}
            disabled={isRendering || !finalHdPhoto}
            className="flex-1 py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Download HD</span>
          </button>

          {/* QR Code Phone Button */}
          <button
            id="btn-open-qr"
            onClick={() => setIsQrModalOpen(true)}
            disabled={!cloudPhotoUrl}
            className="flex-1 py-3 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-sky-600/20"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan QR di HP</span>
          </button>

          {/* Send to Printer Button */}
          <button
            id="btn-send-printer"
            onClick={handlePrint}
            disabled={isRendering || !finalHdPhoto}
            className="py-3 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-zinc-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="Kirim ke Printer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Cetak</span>
          </button>
        </div>

        {/* Start Fresh / Next Guest Button */}
        <button
          id="btn-restart-booth"
          onClick={onRestart}
          className="w-full py-2.5 px-4 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-zinc-800/80 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Ambil Foto Baru (Tamu Berikutnya)</span>
        </button>
      </div>

      {/* QR Code Phone Download Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center relative animate-in fade-in zoom-in duration-200">
            {/* Close Button */}
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Scan untuk Download di HP</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Buka kamera HP Anda dan arahkan ke QR Code di bawah
              </p>
            </div>

            {/* QR Code Canvas Frame */}
            <div className="p-4 bg-white rounded-2xl mx-auto w-fit shadow-xl border-4 border-amber-500/30">
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code Download"
                  className="w-52 h-52 object-contain"
                />
              ) : (
                <div className="w-52 h-52 flex flex-col items-center justify-center text-zinc-500 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                  <span className="text-xs font-mono">Membuat QR Code...</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed px-2">
              Foto HD 1080×1350 bebas watermark tersimpan aman di Supabase CDN Storage.
            </p>

            {/* Direct Link Action Bar */}
            {cloudPhotoUrl && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-zinc-700 transition-colors cursor-pointer"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Link Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Salin Link</span>
                    </>
                  )}
                </button>

                <a
                  href={cloudPhotoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Buka Foto</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Printer Progress Modal */}
      {printerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4 text-center">
            {printStatus === 'transmitting' && (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Menghubungkan ke Printer...</h3>
                  <p className="text-xs text-zinc-400 mt-1">Mengirim data foto ke spooler kiosk</p>
                </div>
              </div>
            )}

            {printStatus === 'printing' && (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto animate-pulse">
                  <Printer className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Sedang Mencetak...</h3>
                  <p className="text-xs text-zinc-400 mt-1">Proses cetak 4R Dye-Sublimation</p>
                </div>
              </div>
            )}

            {printStatus === 'completed' && (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Cetak Berhasil Dikirim!</h3>
                  <p className="text-xs text-zinc-300 mt-1">
                    Silakan ambil lembaran foto fisik Anda di baki printer kiosk.
                  </p>
                  {printJobId && (
                    <p className="text-[10px] font-mono text-zinc-500 mt-2">Job ID: {printJobId}</p>
                  )}
                </div>

                <button
                  onClick={() => setPrinterModalOpen(false)}
                  className="w-full py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs mt-2 cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
