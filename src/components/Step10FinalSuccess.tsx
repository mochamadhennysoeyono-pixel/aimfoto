import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Printer,
  RotateCcw,
  Sparkles,
  Loader2,
  Check,
  CheckCircle2,
  PartyPopper,
  Cloud,
  Copy,
  Zap,
  Play,
  Film,
  Camera,
  MessageSquare,
} from 'lucide-react';
import { FilterPreset, PhotoboothOrder, PhotoboothSession, PhotoboothLayout, EventConfig } from '../types';
import { renderCompositedPhoto } from '../utils/canvasRenderer';
import { sendToPrinter } from '../services/printerService';
import { playSuccessChime } from '../utils/audioEffects';
import { uploadFinalPhotoToStorage, uploadBoomerangToStorage } from '../services/storageService';
import { generateBoomerangFromPhotos } from '../utils/boomerangRecorder';
import { compileCompositedAnimatedFrameVideo } from '../utils/animatedFrameRenderer';
import { getAdminWhatsapp } from '../services/adminContactService';
import { generateWhatsAppPaymentMessage, buildWhatsAppUrl } from '../utils/whatsappHelper';

interface Step10FinalSuccessProps {
  session: PhotoboothSession;
  order: PhotoboothOrder;
  filter: FilterPreset;
  layout: PhotoboothLayout;
  frameUrl?: string;
  eventConfig?: EventConfig;
  onRestart: () => void;
}

export const Step10FinalSuccess: React.FC<Step10FinalSuccessProps> = ({
  session,
  order,
  filter,
  layout,
  frameUrl,
  eventConfig,
  onRestart,
}) => {
  const [finalHdPhoto, setFinalHdPhoto] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);

  // Boomerang states & clips
  const initialClips =
    session.boomerangClips && session.boomerangClips.length > 0
      ? session.boomerangClips
      : session.boomerangVideoUrl
      ? [session.boomerangVideoUrl]
      : [];
  const [boomerangClips, setBoomerangClips] = useState<string[]>(initialClips);
  const [isSynthesizingBoomerang, setIsSynthesizingBoomerang] = useState(false);
  // Default to -1 (Full Composited Photobooth Frame with all animated & static slots)
  const [selectedBoomerangIndex, setSelectedBoomerangIndex] = useState<number>(-1);

  // Animated Frame Video State (The whole photobooth frame composited with moving boomerangs and still photos)
  const [animatedFrameVideoUrl, setAnimatedFrameVideoUrl] = useState<string | null>(
    session.animatedFrameVideoUrl || null
  );
  const [isCompilingAnimatedFrame, setIsCompilingAnimatedFrame] = useState(false);
  const [animatedFrameProgress, setAnimatedFrameProgress] = useState(0);

  // Active View Tab: 'print-photo' (Foto Cetak) vs 'boomerang' (Soft File Video)
  const [activeTab, setActiveTab] = useState<'print-photo' | 'boomerang'>('print-photo');

  // Cloud Storage & QR States
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [cloudPhotoUrl, setCloudPhotoUrl] = useState<string | null>(null);
  const [cloudBoomerangUrl, setCloudBoomerangUrl] = useState<string | null>(null);

  // Printer modal states
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [printStatus, setPrintStatus] = useState<'idle' | 'transmitting' | 'printing' | 'completed'>('idle');
  const [printJobId, setPrintJobId] = useState<string | null>(null);

  // Active boomerang clip URL
  const currentBoomerangClip =
    boomerangClips[selectedBoomerangIndex] ||
    boomerangClips[0] ||
    session.boomerangVideoUrl ||
    null;

  // Auto-synthesize individual Boomerang loop if not already recorded live
  useEffect(() => {
    let isMounted = true;
    async function ensureBoomerang() {
      if (boomerangClips.length > 0) return;

      const candidates: string[] = [];
      if (session.capturedPhotos && session.capturedPhotos.length > 0) {
        candidates.push(...session.capturedPhotos);
      } else if (session.fotoOriginal) {
        candidates.push(session.fotoOriginal);
      } else if (session.slotAssignments) {
        const slotUrls = (Object.values(session.slotAssignments).filter(Boolean) as string[]);
        if (slotUrls.length > 0) candidates.push(...slotUrls);
      }

      if (candidates.length === 0) return;

      setIsSynthesizingBoomerang(true);
      try {
        const synthRes = await generateBoomerangFromPhotos(candidates, 720);
        if (isMounted && synthRes?.videoUrl) {
          setBoomerangClips([synthRes.videoUrl]);
          // Upload to Supabase Storage in background
          uploadBoomerangToStorage(session.id, synthRes.videoUrl, 0)
            .then((res) => {
              if (res.success && res.publicUrl && isMounted) {
                setCloudBoomerangUrl(res.publicUrl);
              }
            })
            .catch(console.warn);
        }
      } catch (err) {
        console.warn('Gagal sintesis otomatis Boomerang:', err);
      } finally {
        if (isMounted) setIsSynthesizingBoomerang(false);
      }
    }

    ensureBoomerang();
    return () => {
      isMounted = false;
    };
  }, [session.capturedPhotos, session.fotoOriginal, session.slotAssignments, session.id]);

  // Compile the Full Composited Animated Photobooth Frame Video
  // Slots with Boomerang animate continuously; slots without remain static photos!
  useEffect(() => {
    let isMounted = true;
    async function compileFrameVideo() {
      if (animatedFrameVideoUrl) return;

      const slotPhotos: Record<number, string> = { ...(session.slotAssignments || {}) };
      if (Object.keys(slotPhotos).length === 0 && session.capturedPhotos) {
        session.capturedPhotos.forEach((p, idx) => {
          slotPhotos[idx] = p;
        });
      }
      if (Object.keys(slotPhotos).length === 0 && session.fotoOriginal) {
        slotPhotos[0] = session.fotoOriginal;
      }
      if (Object.keys(slotPhotos).length === 0) return;

      const slotBoomerangs: Record<number, string> = { ...(session.slotBoomerangs || {}) };
      if (Object.keys(slotBoomerangs).length === 0 && session.boomerangClips) {
        session.boomerangClips.forEach((b, idx) => {
          if (b) slotBoomerangs[idx] = b;
        });
      }

      setIsCompilingAnimatedFrame(true);
      setAnimatedFrameProgress(12);

      try {
        const result = await compileCompositedAnimatedFrameVideo({
          layout,
          slotPhotos,
          capturedPhotos: session.capturedPhotos,
          slotBoomerangs,
          slotAdjustments: session.slotAdjustments,
          filter,
          frameUrl,
          decorations: session.decorations,
          withWatermark: false,
          totalDurationMs: 6000,
          fps: 24,
          scaleDownWidth: 720,
          onProgress: (pct) => {
            if (isMounted) setAnimatedFrameProgress(pct);
          },
        });

        if (isMounted && result.videoUrl) {
          setAnimatedFrameVideoUrl(result.videoUrl);
          // Upload composited 1-frame video to Supabase Storage as primary frame boomerang
          uploadBoomerangToStorage(session.id, result.videoUrl, 'frame')
            .then((res) => {
              if (res.success && res.publicUrl && isMounted) {
                setCloudBoomerangUrl(res.publicUrl);
                try {
                  const existingCache = JSON.parse(localStorage.getItem('photobooth_boomerang_sessions') || '{}');
                  existingCache[session.id] = {
                    ...(existingCache[session.id] || {}),
                    orderId: order.id,
                    hasBoomerang: true,
                    frameVideoUrl: res.publicUrl,
                    primaryVideoUrl: res.publicUrl,
                    updatedAt: new Date().toISOString(),
                  };
                  localStorage.setItem('photobooth_boomerang_sessions', JSON.stringify(existingCache));
                } catch (e) {
                  console.warn('Cache local frame boomerang error:', e);
                }
              }
            })
            .catch(console.warn);
        }
      } catch (err) {
        console.warn('Gagal compile video frame:', err);
      } finally {
        if (isMounted) setIsCompilingAnimatedFrame(false);
      }
    }

    compileFrameVideo();
    return () => {
      isMounted = false;
    };
  }, [session, layout, filter, frameUrl]);

  // 1. Render full HD unwatermarked composited photo for printing and download
  useEffect(() => {
    let isMounted = true;
    async function renderHd() {
      setIsRendering(true);
      try {
        const result = await renderCompositedPhoto({
          photoSrc: session.fotoOriginal,
          slotPhotos: session.slotAssignments,
          slotAdjustments: session.slotAdjustments,
          layout: layout,
          filter,
          frameUrl: frameUrl,
          decorations: session.decorations,
          withWatermark: false, // 100% UNWATERMARKED
        });

        if (isMounted) {
          setFinalHdPhoto(result);
          playSuccessChime();

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

          // Otomatis upload ke Supabase Storage
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

  // Upload ke Supabase Storage (Foto Cetak & Boomerang) & generate QR Code
  const uploadToCloud = async (photoDataUrl: string) => {
    setUploadStatus('uploading');
    try {
      const res = await uploadFinalPhotoToStorage(session.id, photoDataUrl, session.frame_layout_id);
      if (res.success && res.publicUrl) {
        setUploadStatus('success');
        setCloudPhotoUrl(res.publicUrl);

        // Upload 1-Frame Boomerang Video jika sudah ada
        if (animatedFrameVideoUrl) {
          try {
            const bRes = await uploadBoomerangToStorage(session.id, animatedFrameVideoUrl, 'frame');
            if (bRes.success && bRes.publicUrl) {
              setCloudBoomerangUrl(bRes.publicUrl);
            }
          } catch (bErr) {
            console.warn('Gagal upload frame boomerang video:', bErr);
          }
        }

        // Simpan ke cache lokal untuk akses langsung portal admin (fokus 1 frame video)
        const effectiveFrameVideo = cloudBoomerangUrl || animatedFrameVideoUrl || currentBoomerangClip || '';
        if (effectiveFrameVideo || session.boomerangEnabled) {
          try {
            const existingCache = JSON.parse(localStorage.getItem('photobooth_boomerang_sessions') || '{}');
            existingCache[session.id] = {
              orderId: order.id,
              hasBoomerang: true,
              slots: session.slotBoomerangConfig
                ? Object.entries(session.slotBoomerangConfig)
                    .filter(([_, active]) => active)
                    .map(([idx]) => Number(idx) + 1)
                : [1],
              frameVideoUrl: effectiveFrameVideo,
              primaryVideoUrl: effectiveFrameVideo,
              updatedAt: new Date().toISOString(),
            };
            localStorage.setItem('photobooth_boomerang_sessions', JSON.stringify(existingCache));
          } catch (cErr) {
            console.warn('Cache local boomerang error:', cErr);
          }
        }

        // Upload sukses, file tersimpan di cloud storage untuk admin
      } else {
        setUploadStatus('error');
      }
    } catch (err) {
      console.warn('Gagal upload ke storage:', err);
      setUploadStatus('error');
    }
  };

  const activeSessionId = order.sessionId || session.id;
  const shortTicketId = `#BOOTH-${activeSessionId.slice(0, 6).toUpperCase()}`;

  const isPrint =
    order.selectedPackage === 'print' ||
    session.selectedPackage === 'print' ||
    (order.detailPaket && order.detailPaket.toLowerCase().includes('cetak'));

  const formattedPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(order.harga);

  const [adminPhone] = useState<string>(getAdminWhatsapp());
  const cleanPhone = adminPhone.replace(/[^0-9]/g, '');
  const targetWaNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

  // Pesan WhatsApp otomatis untuk follow-up status pengiriman softfile
  const hasAnyBoomerang = !!currentBoomerangClip || isSynthesizingBoomerang || boomerangClips.length > 0;
  const waFollowupMessage = generateWhatsAppPaymentMessage({
    method: order.metodePembayaran?.toLowerCase().includes('qris') ? 'qris' : 'cash',
    isPrint: !!isPrint,
    ticketId: shortTicketId,
    totalPriceFormatted: formattedPrice,
    eventName: eventConfig?.nama || 'Photobooth',
    hasBoomerang: hasAnyBoomerang,
  });
  const waFollowupUrl = buildWhatsAppUrl(adminPhone, waFollowupMessage);

  // Handle Kiosk Printer Command (Strictly Prints the static Photo Frame)
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

  const [isCopiedId, setIsCopiedId] = useState(false);
  const handleCopyTicketId = async () => {
    try {
      await navigator.clipboard.writeText(shortTicketId);
      setIsCopiedId(true);
      setTimeout(() => setIsCopiedId(false), 2000);
    } catch (e) {
      console.warn('Gagal salin ID:', e);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full p-3 sm:p-4 min-h-0 overflow-y-auto">
      {/* Top Header */}
      <div className="shrink-0">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pembayaran Lunas
          </div>

          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            Langkah 10 dari 10
          </span>
        </div>

        <div className="text-center pt-2.5 pb-2">
          <div className="inline-flex items-center justify-center p-2 rounded-full bg-amber-500/10 text-amber-400 mb-1">
            <PartyPopper className="w-5 h-5 animate-bounce" />
          </div>

          {order.harga === 0 || order.paymentMethod === 'Gratis Event' ? (
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold mb-1">
              🎉 Sesi Event Gratis (Rp 0)
            </div>
          ) : order.selectedPackage === 'digital' ? (
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono font-bold mb-1">
              📱 Paket Softfile Digital HD + Boomerang Video
            </div>
          ) : (
            <div className="inline-block px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold mb-1">
              🖨️ Cetak Fisik + Softfile HD & Boomerang Video
            </div>
          )}

          <h2 className="text-lg font-bold text-white tracking-tight">
            Momen Anda Siap Diunduh & Dicetak!
          </h2>
          <p className="text-xs text-zinc-400">
            Foto cetak fisik siap dicetak, dan soft file video Boomerang siap disimpan
          </p>
        </div>

        {/* View Switcher Tabs: Foto Cetak vs Soft File Boomerang */}
        <div className="flex items-center justify-center gap-2 pt-1 pb-2">
          <button
            onClick={() => setActiveTab('print-photo')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'print-photo'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Foto Frame Cetak (HD)</span>
          </button>

          <button
            onClick={() => setActiveTab('boomerang')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'boomerang'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/20'
                : 'bg-zinc-900 hover:bg-zinc-800 text-pink-400 border border-pink-500/30'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Soft File Boomerang ⚡</span>
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="relative w-full flex-1 flex flex-col items-center justify-center my-auto min-h-[36vh] max-h-[46vh] p-1">
        {activeTab === 'print-photo' ? (
          /* TAB 1: Final HD Unwatermarked Photo Container */
          isRendering || !finalHdPhoto ? (
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
                Foto Cetak HD
              </div>
            </div>
          )
        ) : (
          /* TAB 2: Boomerang Animated Photobooth Frame Video Player */
          <div className="w-full h-full max-w-xs flex flex-col items-center justify-center gap-2">
            <div
              className="relative max-h-full max-w-full rounded-2xl overflow-hidden bg-black border-2 border-pink-500/50 shadow-2xl shadow-pink-500/10 flex items-center justify-center"
              style={{
                aspectRatio: `${layout?.canvas_width || 1200} / ${layout?.canvas_height || 1800}`,
                height: '100%',
              }}
            >
              {selectedBoomerangIndex >= 0 && boomerangClips[selectedBoomerangIndex] ? (
                <video
                  key={`clip-${selectedBoomerangIndex}`}
                  src={boomerangClips[selectedBoomerangIndex]}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : animatedFrameVideoUrl ? (
                <video
                  key={animatedFrameVideoUrl}
                  src={animatedFrameVideoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : isCompilingAnimatedFrame || isSynthesizingBoomerang ? (
                <div className="flex flex-col items-center justify-center gap-2.5 text-center p-4">
                  <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
                  <span className="text-xs font-bold text-white">Menyusun Video Frame Boomerang...</span>
                  <div className="w-36 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-pink-500 to-rose-500 h-full transition-all duration-300"
                      style={{ width: `${Math.max(15, animatedFrameProgress)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {animatedFrameProgress > 0 ? `${animatedFrameProgress}% selesai` : 'Memproses per-slot boomerang'}
                  </span>
                </div>
              ) : currentBoomerangClip ? (
                <video
                  key={currentBoomerangClip}
                  src={currentBoomerangClip}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-zinc-500 font-mono">Video Boomerang siap disintesis</div>
              )}

              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-pink-600/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-md">
                <Zap className="w-3 h-3 fill-current" />
                <span>
                  {selectedBoomerangIndex >= 0 ? `Pose #${selectedBoomerangIndex + 1} (6s)` : 'Frame Boomerang (6s)'}
                </span>
              </div>

              <div className="absolute bottom-3 left-3 px-2.5 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] text-zinc-300 font-mono">
                {selectedBoomerangIndex >= 0 ? `Klip Slot #${selectedBoomerangIndex + 1} • Loop 6 Detik` : 'Frame Foto + Boomerang • Loop 6 Detik'}
              </div>
            </div>

            {/* Selector for Full Frame Video vs Individual Pose Clips */}
            {(boomerangClips.length > 0 || animatedFrameVideoUrl) && (
              <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto max-w-full">
                <button
                  onClick={() => setSelectedBoomerangIndex(-1)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    selectedBoomerangIndex === -1
                      ? 'bg-pink-500 text-white shadow-sm'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
                  }`}
                >
                  Full Frame
                </button>
                {boomerangClips.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedBoomerangIndex(idx)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer ${
                      selectedBoomerangIndex === idx
                        ? 'bg-pink-500 text-white shadow-sm'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
                    }`}
                  >
                    Pose #{idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Sinkronisasi Cloud (Background Upload untuk Kebutuhan Admin) */}
      <div className="py-1 shrink-0">
        {uploadStatus === 'uploading' && (
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-zinc-400 py-1.5 px-3 bg-zinc-900/60 rounded-xl border border-zinc-800">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>Menyimpan file HD ke sistem server...</span>
          </div>
        )}
      </div>

      {/* CARD UTAMA: PENGIRIMAN SOFTFILE OLEH ADMIN VIA WHATSAPP */}
      <div className="p-4 rounded-2xl bg-zinc-950 border border-emerald-500/30 shadow-xl space-y-3 shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-white">
                Soft File Dikirim oleh Admin via WhatsApp
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
              Setelah pembayaran terverifikasi, admin kami akan langsung mengirimkan file foto asli HD (300 DPI) {hasAnyBoomerang ? '& video loop boomerang' : ''} ke nomor WhatsApp Anda.
            </p>
          </div>
        </div>

        {/* Info Rincian Sesi */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-850">
          <div className="p-2 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 uppercase block font-mono">Nomor Sesi</span>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs font-mono font-bold text-white">{shortTicketId}</span>
              <button
                type="button"
                onClick={handleCopyTicketId}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Salin ID"
              >
                {isCopiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
            <span className="text-[10px] text-zinc-500 uppercase block font-mono">Pilihan Paket</span>
            <span className="text-xs font-bold text-amber-300 mt-0.5 block truncate">
              {isPrint ? 'Cetak Fisik + HD' : 'Digital Softfile'}
            </span>
          </div>
        </div>

        {/* Informasi Khusus Cetak Fisik */}
        {isPrint && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-left">
            <Printer className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-[11px] font-bold text-amber-300 block">
                Cetak Foto Fisik Sedang Diproses
              </span>
              <span className="text-[10px] text-amber-200/80 block leading-tight mt-0.5">
                Operator photobooth sedang mencetak lembar foto strip fisik Anda. Silakan tunggu sebentar dan ambil di meja kasir / loket!
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-2 border-t border-zinc-800 shrink-0">
        {/* Tombol Buka WhatsApp Admin */}
        <a
          href={waFollowupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Buka Chat WhatsApp Admin (+{targetWaNumber})</span>
        </a>

        {/* Tombol Cetak Manual Kiosk untuk Operator (Jika Paket Cetak Fisik) */}
        {isPrint && (
          <button
            id="btn-print-kiosk"
            disabled={!finalHdPhoto}
            onClick={handlePrint}
            className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>Kirim Cetak ke Mesin Printer Kiosk (Operator)</span>
          </button>
        )}

        {/* Tombol Selesai & Foto Sesi Baru */}
        <button
          id="btn-start-fresh"
          onClick={onRestart}
          className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 border border-zinc-800 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Selesai & Foto Sesi Baru</span>
        </button>
      </div>

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
                  ? 'Silakan ambil foto cetak Anda di baki printer Kiosk.'
                  : 'Harap tunggu beberapa detik, mesin printer sedang memproses foto fisik Anda.'}
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

