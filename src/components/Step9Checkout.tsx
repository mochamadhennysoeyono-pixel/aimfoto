import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  QrCode,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Loader2,
  ExternalLink,
  Zap,
  Banknote,
  Send,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import {
  PhotoboothOrder,
  PhotoboothSession,
  EventConfig,
  PhotoboothLayout,
  FilterPreset,
} from '../types';
import { createFlipBill, getFlipConfig, checkFlipBillStatus } from '../services/flipService';
import { getAdminWhatsapp } from '../services/adminContactService';
import { supabase, HARDCODED_EVENT_ID } from '../supabaseClient';
import { generateUuid } from '../utils/uuid';
import { renderCompositedPhoto } from '../utils/canvasRenderer';
import { uploadFinalPhotoToStorage } from '../services/storageService';

interface Step9CheckoutProps {
  session: PhotoboothSession;
  order: PhotoboothOrder;
  eventConfig: EventConfig;
  layout?: PhotoboothLayout;
  filter?: FilterPreset;
  frameUrl?: string;
  onPaymentSuccess: (order: PhotoboothOrder) => void;
  onBack: () => void;
  onOpenLegal?: (tab: 'terms' | 'refund' | 'contact' | 'privacy') => void;
}

export const Step9Checkout: React.FC<Step9CheckoutProps> = ({
  session,
  order,
  eventConfig,
  layout,
  filter,
  frameUrl,
  onPaymentSuccess,
  onBack,
  onOpenLegal,
}) => {
  // Mode Pembayaran: Tunai (Cash) vs Non Tunai (Flip)
  const [paymentType, setPaymentType] = useState<'tunai' | 'nontunai'>('nontunai');

  // Popup Modal Flip langsung muncul saat Non Tunai
  const [isFlipModalOpen, setIsFlipModalOpen] = useState(false);

  // States Flip
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);
  const [flipPaymentUrl, setFlipPaymentUrl] = useState<string | null>(null);
  const [flipBillId, setFlipBillId] = useState<string | null>(null);
  const [flipMode, setFlipMode] = useState<'test' | 'live'>('test');
  const [hasSecretKey, setHasSecretKey] = useState(false);
  const [flipIframeBlocked, setFlipIframeBlocked] = useState(false);
  const [flipErrorMessage, setFlipErrorMessage] = useState<string | null>(null);

  // Status Pembayaran Otomatis (Polling & Webhook Supabase)
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);

  // Tunai state
  const [isSavingCash, setIsSavingCash] = useState(false);
  const [cashSavedSuccess, setCashSavedSuccess] = useState(false);
  const [adminPhone, setAdminPhone] = useState<string>(getAdminWhatsapp());

  const isPaymentSuccessRef = useRef(false);
  isPaymentSuccessRef.current = isPaymentSuccess;

  const formattedPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(order.harga);

  useEffect(() => {
    setAdminPhone(getAdminWhatsapp());
    const cfg = getFlipConfig();
    setFlipMode(cfg.mode);
    setHasSecretKey(Boolean(cfg.secretKey && cfg.secretKey.trim() !== ''));
  }, []);

  // Helper simpan data foto & order ke Supabase
  const saveSessionAndOrderToSupabase = async (
    paymentMethodName: string,
    status: 'pending' | 'success' = 'pending'
  ): Promise<string | null> => {
    const activeSessionId = order.sessionId || session.id;

    // 1. Simpan / perbarui sessions
    const sessionPayload: any = {
      id: activeSessionId,
      event_id: session.eventId || eventConfig.id || HARDCODED_EVENT_ID,
      status: status === 'success' ? 'paid' : 'draft',
      filter_applied: session.filterDipilih,
    };

    if (session.frame_layout_id) {
      sessionPayload.frame_layout_id = session.frame_layout_id;
    }
    if (session.frameDipilih) {
      sessionPayload.frame_id = session.frameDipilih;
    }

    await supabase.from('sessions').upsert([sessionPayload], { onConflict: 'id' });

    // 2. Simpan order
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const validOrderId = (order.id && uuidRegex.test(order.id)) ? order.id : generateUuid();

    const orderPayload = {
      id: validOrderId,
      session_id: activeSessionId,
      amount: order.harga,
      payment_status: status === 'success' ? 'success' : 'pending',
      payment_method: paymentMethodName,
      paid_at: status === 'success' ? new Date().toISOString() : null,
    };

    await supabase.from('orders').upsert([orderPayload], { onConflict: 'id' });

    // 3. Render HD foto dan upload ke storage jika tersedia layout & filter
    let uploadedUrl: string | null = null;
    try {
      if (layout && filter) {
        const rendered = await renderCompositedPhoto({
          photoSrc: session.fotoOriginal,
          slotPhotos: session.slotAssignments,
          layout,
          filter,
          frameUrl: frameUrl || session.selectedFrameLayout?.image_url,
          decorations: session.decorations,
          withWatermark: false,
        });

        const uploadRes = await uploadFinalPhotoToStorage(
          activeSessionId,
          rendered,
          session.frame_layout_id
        );
        if (uploadRes.success && uploadRes.publicUrl) {
          uploadedUrl = uploadRes.publicUrl;
        }
      }
    } catch (renderErr) {
      console.warn('Render & upload note:', renderErr);
    }

    return uploadedUrl;
  };

  // Helper trigger selesai otomatis saat webhook / konfirmasi masuk
  const triggerAutoSuccess = (trxId?: string) => {
    if (isPaymentSuccessRef.current) return;
    setIsPaymentSuccess(true);

    const settledOrder: PhotoboothOrder = {
      ...order,
      statusPembayaran: 'success',
      paymentMethod: 'Flip Payment Gateway',
      transactionId: trxId || flipBillId || `FLIP-${Date.now()}`,
    };

    setTimeout(() => {
      setIsFlipModalOpen(false);
      onPaymentSuccess(settledOrder);
    }, 1200);
  };

  // 1. Inisialisasi tagihan Flip saat membuka Step 9
  const initFlip = async () => {
    const cfg = getFlipConfig();
    setFlipMode(cfg.mode);
    setHasSecretKey(Boolean(cfg.secretKey && cfg.secretKey.trim() !== ''));
    setIsGeneratingBill(true);
    setFlipErrorMessage(null);

    try {
      const checkoutAmount = Number(order.harga) || Number(eventConfig.hargaPerFoto) || 10000;
      const res = await createFlipBill({
        orderId: order.id || session.id,
        title: `Photobooth - ${eventConfig.nama || 'AimBoth'}`,
        amount: checkoutAmount,
      });

      if (res.success && res.paymentUrl) {
        setFlipPaymentUrl(res.paymentUrl);
        setFlipBillId(String(res.bill?.link_id || ''));
        setFlipErrorMessage(null);
      } else {
        setFlipPaymentUrl(null);
        setFlipErrorMessage(
          res.error || 'Gagal menghasilkan tagihan Flip. Periksa kembali Secret Key API Flip Anda.'
        );
      }
    } catch (err: any) {
      setFlipErrorMessage(err.message || 'Terjadi kesalahan saat memanggil API Flip.');
    } finally {
      setIsGeneratingBill(false);
    }
  };

  useEffect(() => {
    initFlip();
  }, [order.id, session.id, order.harga, eventConfig.nama]);

  // 2. Realtime Listener Webhook Supabase (Otomatis update saat Flip mengirim webhook ke Supabase)
  useEffect(() => {
    const activeSessionId = order.sessionId || session.id;

    const channel = supabase
      .channel(`order-webhook-${activeSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `session_id=eq.${activeSessionId}`,
        },
        (payload) => {
          if (
            payload.new &&
            (payload.new.payment_status === 'success' ||
              payload.new.payment_status === 'settlement' ||
              payload.new.status === 'paid')
          ) {
            triggerAutoSuccess(payload.new.transaction_id || payload.new.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.sessionId, session.id]);

  // 3. Polling Status Flip API (Jika sudah ada link_id tagihan resmi)
  useEffect(() => {
    if (!flipBillId || isPaymentSuccess) return;

    const interval = setInterval(async () => {
      try {
        const check = await checkFlipBillStatus(flipBillId);
        if (check.success && check.status === 'SUCCESSFUL') {
          clearInterval(interval);
          await saveSessionAndOrderToSupabase('Flip Payment Gateway', 'success');
          triggerAutoSuccess(flipBillId);
        }
      } catch (e) {
        // ignore polling error
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [flipBillId, isPaymentSuccess]);

  // Handler: Bayar Tunai (Simpan otomatis ke Supabase + Redirect WhatsApp Admin)
  const handlePayCash = async () => {
    setIsSavingCash(true);
    try {
      await saveSessionAndOrderToSupabase('Tunai (Cash)', 'pending');
      setCashSavedSuccess(true);

      const activeSessionId = order.sessionId || session.id;
      const targetPhone = adminPhone || getAdminWhatsapp();
      const messageText = `halo admin, saya mau bayar untuk photobooth dengan id ${activeSessionId}`;
      const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(messageText)}`;

      // Buka link WhatsApp admin setelah jeda singkat
      setTimeout(() => {
        window.open(waUrl, '_blank');
      }, 1000);
    } catch (err: any) {
      console.error('Error bayar tunai:', err);
    } finally {
      setIsSavingCash(false);
    }
  };

  // Handler: Buka Popup Flip Langsung
  const handleOpenFlipPopup = () => {
    setFlipIframeBlocked(false);
    setIsFlipModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full p-4 overflow-y-auto">
      {/* Top Header */}
      <div className="shrink-0">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Preview</span>
          </button>

          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            Langkah 9 dari 10
          </span>
        </div>

        <div className="text-center pt-3 pb-2">
          <p className="text-[11px] font-mono tracking-widest text-amber-400 uppercase mb-0.5">
            Step 9: Pilihan Pembayaran
          </p>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
            <CreditCard className="w-4 h-4 text-amber-400" />
            Pilih Metode Bayar
          </h2>
          <p className="text-xs text-zinc-400">
            Pilih bayar langsung secara Tunai atau Non-Tunai dengan Flip
          </p>
        </div>
      </div>

      {/* Main Choice: Tunai vs Non Tunai */}
      <div className="space-y-4 my-auto">
        {/* Total Tagihan Box */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-[11px] font-mono text-zinc-400 block">Total Tagihan Sesi</span>
            <span className="text-xl font-bold font-mono text-amber-400 block">
              {formattedPrice}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-zinc-500 block">ID Sesi Photobooth</span>
            <span className="text-xs font-mono text-zinc-300 font-semibold truncate max-w-[140px] block">
              {(order.sessionId || session.id).slice(0, 14)}...
            </span>
          </div>
        </div>

        {/* Tab Pilihan Bayar: Tunai vs Non Tunai */}
        <div className="grid grid-cols-2 gap-3">
          {/* Opsi Non Tunai */}
          <button
            type="button"
            id="btn-select-nontunai"
            onClick={() => {
              setPaymentType('nontunai');
              setCashSavedSuccess(false);
              handleOpenFlipPopup();
            }}
            className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer relative ${
              paymentType === 'nontunai'
                ? 'border-amber-400 bg-amber-500/10 text-white ring-2 ring-amber-400/20 shadow-lg'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              paymentType === 'nontunai' ? 'bg-amber-400 text-zinc-950' : 'bg-zinc-800 text-zinc-300'
            }`}>
              <QrCode className="w-5 h-5" />
            </div>
            <div className="text-center">
              <span className="text-xs font-bold block">Non Tunai</span>
              <span className="text-[10px] text-zinc-400 block">Popup Flip Payment</span>
            </div>
            {paymentType === 'nontunai' && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          {/* Opsi Tunai */}
          <button
            type="button"
            id="btn-select-tunai"
            onClick={() => {
              setPaymentType('tunai');
              setIsFlipModalOpen(false);
            }}
            className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer relative ${
              paymentType === 'tunai'
                ? 'border-emerald-500 bg-emerald-500/10 text-white ring-2 ring-emerald-500/20 shadow-lg'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              paymentType === 'tunai' ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300'
            }`}>
              <Banknote className="w-5 h-5" />
            </div>
            <div className="text-center">
              <span className="text-xs font-bold block">Tunai (Cash)</span>
              <span className="text-[10px] text-zinc-400 block">Simpan & Chat Admin</span>
            </div>
            {paymentType === 'tunai' && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>

        {/* Detail Panel */}
        {paymentType === 'tunai' ? (
          /* TAMPILAN TUNAI */
          <div className="space-y-3">
            {cashSavedSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3 animate-in fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Foto Berhasil Tersimpan!</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Data sesi foto Anda telah otomatis tersimpan ke Supabase. Silakan selesaikan pembayaran tunai dengan Admin di WhatsApp.
                  </p>
                </div>

                <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl text-left space-y-1">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-zinc-400">ID Sesi:</span>
                    <span className="text-zinc-200 font-bold">{order.sessionId || session.id}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-zinc-400">Total Bayar:</span>
                    <span className="text-emerald-400 font-bold">{formattedPrice}</span>
                  </div>
                </div>

                <a
                  href={`https://wa.me/${adminPhone || getAdminWhatsapp()}?text=${encodeURIComponent(
                    `halo admin, saya mau bayar untuk photobooth dengan id ${order.sessionId || session.id}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Buka WhatsApp Admin</span>
                </a>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Pembayaran Tunai ke Admin</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                      Sistem akan otomatis menyimpan foto Anda ke database Supabase, lalu menghubungkan Anda ke WhatsApp Admin.
                    </p>
                  </div>
                </div>

                <div className="p-2.5 bg-zinc-900 rounded-xl border border-zinc-800/80 text-[11px] font-mono text-zinc-400 space-y-1">
                  <span className="block text-zinc-500 text-[10px]">Pesan WhatsApp Otomatis:</span>
                  <p className="text-zinc-300 italic">
                    "halo admin, saya mau bayar untuk photobooth dengan id {order.sessionId || session.id}"
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* TAMPILAN NON TUNAI */
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Pembayaran Flip Payment Gateway</h3>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                  Popup Flip akan otomatis mendeteksi ketika pembayaran berhasil masuk via webhook.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-300 text-[11px]">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
                Flip {flipMode === 'test' ? 'Sandbox (TEST)' : 'Live Production'}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">Webhook Aktif</span>
            </div>

            <button
              type="button"
              id="btn-trigger-flip-popup"
              onClick={handleOpenFlipPopup}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs sm:text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Buka Popup Pembayaran Flip</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="pt-2 border-t border-zinc-800 space-y-2 shrink-0">
        {paymentType === 'tunai' && !cashSavedSuccess && (
          <button
            type="button"
            id="btn-process-cash"
            disabled={isSavingCash}
            onClick={handlePayCash}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-bold text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSavingCash ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyimpan Foto ke Supabase...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4 stroke-[2.5]" />
                <span>Simpan Foto & Redirect ke WhatsApp Admin</span>
              </>
            )}
          </button>
        )}

        {onOpenLegal && (
          <p className="text-[10px] text-center text-zinc-500 pt-1 leading-normal">
            Dengan melanjutkan transaksi, Anda menyetujui{' '}
            <button
              type="button"
              onClick={() => onOpenLegal('terms')}
              className="text-amber-400 hover:underline cursor-pointer"
            >
              Syarat & Ketentuan
            </button>{' '}
            dan{' '}
            <button
              type="button"
              onClick={() => onOpenLegal('refund')}
              className="text-amber-400 hover:underline cursor-pointer"
            >
              Kebijakan Refund
            </button>{' '}
            AimBoth.
          </p>
        )}
      </div>

      {/* POPUP MODAL RESMI PEMBAYARAN FLIP */}
      {isFlipModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-[#0b0d13] border border-zinc-800 rounded-2xl max-w-md w-full h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
            {/* Header Popup Flip */}
            <div className="p-3.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs">
                  F
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    Pembayaran Flip ({flipMode.toUpperCase()})
                  </h3>
                  <p className="text-[11px] font-mono text-amber-400 font-semibold">
                    Total: {formattedPrice}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {flipPaymentUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(flipPaymentUrl, '_blank')}
                    title="Buka di tab baru"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFlipModalOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body Popup: Realtime Status & Iframe / Webhook Status */}
            <div className="flex-1 bg-zinc-950 relative flex flex-col items-center justify-center overflow-hidden">
              {isPaymentSuccess ? (
                /* Sukses Terverifikasi Otomatis Melalui Webhook */
                <div className="flex flex-col items-center gap-3 p-6 text-center animate-in zoom-in-95">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Pembayaran Berhasil!</h4>
                    <p className="text-xs text-zinc-400 mt-1">
                      Webhook Flip terverifikasi. Mengalihkan ke hasil cetak foto...
                    </p>
                  </div>
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-400 mt-2" />
                </div>
              ) : isGeneratingBill ? (
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
                  <p className="text-xs text-zinc-300">Menghubungi Flip untuk membuat tagihan resmi...</p>
                </div>
              ) : !hasSecretKey || flipErrorMessage ? (
                /* Tampilan Jika API Key belum ada atau tidak valid */
                <div className="flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-sm">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-white">
                      {!hasSecretKey ? 'Kredensial Flip Belum Diisi' : 'Kredensial Flip Perlu Diperiksa'}
                    </h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {flipErrorMessage ||
                        'Silakan masukkan API Secret Key Flip Anda di menu Admin Portal > Integrasi Flip.'}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 text-left space-y-1.5 w-full">
                    <span className="font-semibold text-zinc-200 block">Catatan Flip Dashboard:</span>
                    <p>
                      Pastikan API Secret Key berasal dari dashboard <strong>Flip for Business</strong> (menu <em>Developer &gt; Kelola API</em>) dan mode yang dipilih (Sandbox vs Live) sesuai dengan API Key tersebut.
                    </p>
                  </div>

                  <div className="flex flex-col w-full gap-2">
                    <button
                      type="button"
                      onClick={() => initFlip()}
                      className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Coba Buat Tagihan Lagi</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await saveSessionAndOrderToSupabase('Flip Sandbox Test', 'success');
                        triggerAutoSuccess(`FLIP-SIM-${Date.now()}`);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Simulasikan Webhook Sukses (Test Kiosk)</span>
                    </button>
                  </div>
                </div>
              ) : flipPaymentUrl ? (
                <div className="w-full h-full flex flex-col relative">
                  {!flipIframeBlocked ? (
                    <iframe
                      src={flipPaymentUrl}
                      title="Flip Checkout"
                      className="w-full h-full border-0 bg-white"
                      onError={() => setFlipIframeBlocked(true)}
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
                      <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white">Buka Tagihan Flip di Jendela Baru</h4>
                        <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                          Selesaikan pembayaran di halaman Flip, sistem ini otomatis mendeteksi webhook dan langsung berlanjut ke langkah cetak.
                        </p>
                      </div>

                      <a
                        href={flipPaymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-3 px-5 rounded-xl bg-orange-500 hover:bg-orange-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
                      >
                        <span>Buka Halaman Bayar Flip</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 p-6 text-center">
                  <AlertCircle className="w-8 h-8 text-amber-400" />
                  <p className="text-xs text-zinc-300">Belum dapat memuat URL tagihan Flip.</p>
                </div>
              )}
            </div>

            {/* Footer Modal: Status Menunggu Webhook Flip (Tanpa tombol manual) */}
            <div className="p-3 bg-zinc-950 border-t border-zinc-800 shrink-0 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-zinc-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-mono">Menunggu notifikasi webhook...</span>
              </div>

              <button
                type="button"
                onClick={() => setIsFlipModalOpen(false)}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 font-medium transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
