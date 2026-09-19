import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Banknote,
  Send,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  ExternalLink,
  MessageSquare,
  Phone,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Printer,
  Gift,
  HelpCircle,
} from 'lucide-react';
import {
  PhotoboothOrder,
  PhotoboothSession,
  EventConfig,
  PhotoboothLayout,
  FilterPreset,
} from '../types';
import { getAdminWhatsapp } from '../services/adminContactService';
import { generateWhatsAppPaymentMessage, buildWhatsAppUrl } from '../utils/whatsappHelper';
import { supabase, HARDCODED_EVENT_ID } from '../supabaseClient';
import { generateUuid } from '../utils/uuid';
import { renderCompositedPhoto } from '../utils/canvasRenderer';
import { uploadFinalPhotoToStorage, uploadBoomerangToStorage } from '../services/storageService';

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
  const [adminPhone, setAdminPhone] = useState<string>(getAdminWhatsapp());
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [waQrCode, setWaQrCode] = useState<string | null>(null);
  const [qrisQrCode, setQrisQrCode] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [isSuccessHandled, setIsSuccessHandled] = useState(false);

  // Mode pembayaran yang diizinkan admin ('all' | 'cash' | 'digital')
  const paymentAllowed = eventConfig.paymentMethodsAllowed || 'all';

  // State tab pembayaran: 'cash' atau 'qris'
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'qris'>(() => {
    if (paymentAllowed === 'cash') return 'cash';
    if (paymentAllowed === 'digital') return 'qris';
    return 'cash'; // default tunai untuk studio rumahan
  });

  const isSuccessHandledRef = useRef(false);
  isSuccessHandledRef.current = isSuccessHandled;

  const activeSessionId = order.sessionId || session.id;
  const shortTicketId = `#BOOTH-${activeSessionId.slice(0, 6).toUpperCase()}`;

  const isFreeEvent =
    eventConfig.isFreeEvent === true ||
    order.harga === 0 ||
    (eventConfig.hargaPerFoto === 0 &&
      (eventConfig.hargaDigital ?? 0) === 0 &&
      (eventConfig.hargaPrint ?? 0) === 0);

  const formattedPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(order.harga);

  // Normalisasi nomor HP untuk link WA
  const cleanPhone = adminPhone.replace(/[^0-9]/g, '');
  const targetWaNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

  // Cek apakah paket cetak atau hanya digital
  const isPrint = order.selectedPackage === 'print' || session.selectedPackage === 'print';

  // Deteksi secara akurat apakah ada slot foto yang mengaktifkan boomerang
  const activeBoomerangSlots: number[] = [];
  if (session.slotBoomerangConfig) {
    Object.entries(session.slotBoomerangConfig).forEach(([slotIdx, isActive]) => {
      if (isActive) {
        activeBoomerangSlots.push(Number(slotIdx) + 1);
      }
    });
  }
  if (activeBoomerangSlots.length === 0 && session.boomerangClips && session.boomerangClips.length > 0) {
    session.boomerangClips.forEach((clip, idx) => {
      if (clip) {
        activeBoomerangSlots.push(idx + 1);
      }
    });
  }

  const hasBoomerang =
    activeBoomerangSlots.length > 0 ||
    session.boomerangEnabled ||
    (session.boomerangClips && session.boomerangClips.length > 0) ||
    !!session.boomerangVideoUrl;

  // Pesan WhatsApp otomatis yang terstruktur rapi menyesuaikan opsi cetak & metode bayar
  const messageText = generateWhatsAppPaymentMessage({
    method: selectedMethod,
    isPrint,
    ticketId: shortTicketId,
    totalPriceFormatted: formattedPrice,
    eventName: eventConfig.nama || 'Photobooth',
    hasBoomerang,
  });

  const waUrl = buildWhatsAppUrl(adminPhone, messageText);

  // Sample static / dynamic QRIS string for Indonesian National Standard QR
  const qrisPayload = `00020101021126600014ID.LINKAJA.WWW0118936009110021008747021008747021000303UMI51440014ID.CO.QRIS.WWW0215ID10200210087470303UMI520458125303360540${order.harga}5802ID5916AIM SPACE STUDIO6007JAKARTA61051234062250721${activeSessionId.slice(0, 16)}6304`;

  useEffect(() => {
    setAdminPhone(getAdminWhatsapp());

    // Generate QR Code untuk link WhatsApp
    QRCode.toDataURL(waUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((url) => setWaQrCode(url))
      .catch((err) => console.warn('Gagal membuat QR WA:', err));

    // Generate QR Code untuk QRIS
    QRCode.toDataURL(qrisPayload, {
      width: 260,
      margin: 2,
      color: { dark: '#0b0d13', light: '#ffffff' },
    })
      .then((url) => setQrisQrCode(url))
      .catch((err) => console.warn('Gagal membuat QRIS:', err));
  }, [waUrl, qrisPayload]);

  // Simpan data order & sesi ke Supabase
  const saveSessionAndOrderToSupabase = async (
    status: 'pending' | 'success' = 'pending',
    method: string = 'Tunai (Kasir)'
  ) => {
    try {
      // 1. Upsert session
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

      // 2. Upsert order dengan metadata deteksi boomerang
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const validOrderId = order.id && uuidRegex.test(order.id) ? order.id : generateUuid();

      const boomerangMetaTag = hasBoomerang
        ? ` [BOOMERANG${activeBoomerangSlots.length > 0 ? `: Slot ${activeBoomerangSlots.join(', ')}` : ''}]`
        : '';
      const paymentRef = `${method.toUpperCase()}-${Date.now().toString().slice(-6)}${boomerangMetaTag}`;

      const orderPayload: any = {
        id: validOrderId,
        session_id: activeSessionId,
        amount: order.harga,
        payment_status: status === 'success' ? 'success' : 'pending',
        payment_method: method,
        payment_reference: paymentRef,
        paid_at: status === 'success' ? new Date().toISOString() : null,
      };

      await supabase.from('orders').upsert([orderPayload], { onConflict: 'id' });

      // Simpan juga ke cache lokal agar langsung terdeteksi di portal admin
      if (hasBoomerang) {
        try {
          const cachedBoomerang = JSON.parse(localStorage.getItem('photobooth_boomerang_sessions') || '{}');
          cachedBoomerang[activeSessionId] = {
            orderId: validOrderId,
            hasBoomerang: true,
            slots: activeBoomerangSlots,
            primaryVideoUrl: session.boomerangVideoUrl || session.boomerangClips?.find(Boolean) || '',
            slotBoomerangs: session.slotBoomerangs || {},
            updatedAt: new Date().toISOString(),
          };
          localStorage.setItem('photobooth_boomerang_sessions', JSON.stringify(cachedBoomerang));
        } catch (cacheErr) {
          console.warn('Cache local boomerang error:', cacheErr);
        }
      }

      // 3. Render HD foto & upload ke Supabase Storage di background
      if (layout && filter) {
        renderCompositedPhoto({
          photoSrc: session.fotoOriginal,
          slotPhotos: session.slotAssignments,
          slotAdjustments: session.slotAdjustments,
          layout,
          filter,
          frameUrl: frameUrl || session.selectedFrameLayout?.image_url,
          decorations: session.decorations,
          withWatermark: false,
        })
          .then((rendered) => {
            uploadFinalPhotoToStorage(activeSessionId, rendered, session.frame_layout_id);
          })
          .catch((e) => console.warn('Render HD background error:', e));
      }

      // 4. Upload klip Boomerang ke Supabase Storage di background jika ada
      if (hasBoomerang) {
        if (session.slotBoomerangs && Object.keys(session.slotBoomerangs).length > 0) {
          Object.entries(session.slotBoomerangs).forEach(([slotIdx, clip]) => {
            if (clip) {
              uploadBoomerangToStorage(activeSessionId, clip as string | Blob, Number(slotIdx)).catch((e) =>
                console.warn(`Upload boomerang slot ${slotIdx} error:`, e)
              );
            }
          });
        } else if (session.boomerangClips && session.boomerangClips.length > 0) {
          session.boomerangClips.forEach((clip, idx) => {
            if (clip) {
              uploadBoomerangToStorage(activeSessionId, clip as string | Blob, idx).catch((e) =>
                console.warn(`Upload boomerang clip ${idx} error:`, e)
              );
            }
          });
        } else if (session.boomerangVideoUrl) {
          uploadBoomerangToStorage(activeSessionId, session.boomerangVideoUrl, 0).catch((e) =>
            console.warn('Upload primary boomerang error:', e)
          );
        }
      }
    } catch (err) {
      console.warn('Simpan data order ke database error:', err);
    }
  };

  // Trigger transisi sukses ke Step 10
  const triggerSuccessTransition = (methodUsed: string, trxId?: string) => {
    if (isSuccessHandledRef.current) return;
    setIsSuccessHandled(true);

    const settledOrder: PhotoboothOrder = {
      ...order,
      statusPembayaran: 'success',
      paymentMethod: methodUsed,
      transactionId: trxId || `${methodUsed.toUpperCase()}-${Date.now()}`,
    };

    onPaymentSuccess(settledOrder);
  };

  // Realtime Supabase Listener: jika admin mengubah status order menjadi paid di dashboard
  useEffect(() => {
    const channel = supabase
      .channel(`order-cash-update-${activeSessionId}`)
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
            triggerSuccessTransition(payload.new.payment_method || 'Kasir', payload.new.transaction_id || payload.new.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSessionId]);

  // Handler: Selesaikan untuk Event Gratis (0rb)
  const handleFreeEventFinish = async () => {
    setIsProcessing(true);
    try {
      await saveSessionAndOrderToSupabase('success', 'Gratis (Event Free)');
      triggerSuccessTransition('Gratis (Event)');
    } catch (e) {
      console.error('Error proses free event:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Pembayaran Tunai Kasir Diterima
  const handleConfirmCashPaid = async () => {
    setIsProcessing(true);
    try {
      await saveSessionAndOrderToSupabase('success', 'Tunai di Kasir');
      triggerSuccessTransition('Tunai (Kasir)');
    } catch (e) {
      console.error('Error konfirmasi bayar tunai:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handler: Pembayaran QRIS Berhasil & Langsung Buka WA Bukti Bayar
  const handleConfirmQrisPaid = async () => {
    setIsProcessing(true);
    try {
      await saveSessionAndOrderToSupabase('pending', 'QRIS Digital');
      // Buka WA dengan teks konfirmasi bayar QRIS
      window.open(waUrl, '_blank');
      // Lanjut ke Step 10 layar status pengiriman oleh admin
      triggerSuccessTransition('QRIS Digital');
    } catch (e) {
      console.error('Error konfirmasi bayar QRIS:', e);
      triggerSuccessTransition('QRIS Digital');
    } finally {
      setIsProcessing(false);
    }
  };

  // Buka WhatsApp Admin
  const handleOpenWhatsapp = async () => {
    setIsProcessing(true);
    try {
      await saveSessionAndOrderToSupabase('pending', selectedMethod === 'cash' ? 'Tunai (Kasir)' : 'QRIS Digital');
      setIsSubmitted(true);
      window.open(waUrl, '_blank');
    } catch (e) {
      console.error('Error proses WhatsApp:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(shortTicketId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // JIKA EVENT GRATIS (0rb)
  if (isFreeEvent) {
    return (
      <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full p-4 overflow-y-auto space-y-4">
        <div className="shrink-0 flex items-center justify-between pb-2 border-b border-zinc-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
            Free Event
          </span>
        </div>

        <div className="my-auto py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
            <Gift className="w-8 h-8 stroke-[2.5]" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-black text-white">Sesi Foto Gratis Event</h2>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              Tidak ada biaya yang perlu dibayar. Foto Anda siap diproses untuk cetak & unduh HD!
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 max-w-xs mx-auto text-left space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Nomor Sesi</span>
              <span className="font-mono font-bold text-white">{shortTicketId}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Biaya Pembayaran</span>
              <span className="font-mono font-bold text-emerald-400">GRATIS (Rp 0)</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-800">
          <button
            onClick={handleFreeEventFinish}
            disabled={isProcessing}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyiapkan Cetak & File HD...</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                <span>Lanjut ke Cetak & Download HD (Gratis) ➔</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // JIKA EVENT BERBAYAR (Toko / Rumahan)
  return (
    <div className="flex-1 flex flex-col justify-between max-w-lg mx-auto w-full p-4 overflow-y-auto space-y-3">
      {/* Header Langkah */}
      <div className="shrink-0">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Pratinjau</span>
          </button>
          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
            Pembayaran
          </span>
        </div>

        <div className="text-center pt-2 pb-1">
          <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center justify-center gap-1.5">
            <span>Pilih Metode Pembayaran</span>
          </h2>
          <p className="text-[11px] text-zinc-400">
            Pilih bayar tunai langsung ke kasir toko atau scan QRIS digital
          </p>
        </div>
      </div>

      {/* Ringkasan Tagihan & Nomor Tiket */}
      <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono text-zinc-400 uppercase">Total Tagihan</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
              isPrint
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
            }`}>
              {isPrint ? <Printer className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />}
              <span>{isPrint ? 'Cetak Fisik + Softfile' : 'Digital Softfile Saja'}</span>
            </span>
          </div>
          <span className="text-xl font-black text-amber-400 font-mono">{formattedPrice}</span>
        </div>

        <div className="text-right">
          <span className="text-[10px] font-mono text-zinc-400 uppercase block mb-1">Nomor Tiket Sesi</span>
          <button
            onClick={handleCopyId}
            className="inline-flex items-center gap-1 text-xs font-mono font-bold text-zinc-200 hover:text-white bg-zinc-800 px-2.5 py-1.5 rounded-lg border border-zinc-700 cursor-pointer transition-colors"
            title="Klik untuk salin ID"
          >
            <span>{shortTicketId}</span>
            {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Tab Pilihan Metode Pembayaran (Jika Admin Mengizinkan 'all') */}
      {paymentAllowed === 'all' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSelectedMethod('cash')}
            className={`py-2.5 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              selectedMethod === 'cash'
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>💵 Bayar Tunai (Kasir)</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMethod('qris')}
            className={`py-2.5 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              selectedMethod === 'qris'
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>📱 Scan QRIS Digital</span>
          </button>
        </div>
      )}

      {/* Konten Metode: 1. BAYAR TUNAI KE KASIR */}
      {selectedMethod === 'cash' && (
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3.5 shadow-xl">
          <div className="flex items-center gap-2.5 border-b border-zinc-800 pb-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Alur Pembayaran Tunai di Kasir</h3>
              <p className="text-[11px] text-zinc-400">
                Konfirmasi via WhatsApp & serahkan uang tunai ke kasir toko
              </p>
            </div>
          </div>

          {/* Tahapan Alur Tunai */}
          <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800 space-y-2.5 text-xs">
            <span className="text-[11px] font-bold text-zinc-200 block">
              Tahapan Pembayaran Tunai:
            </span>
            <div className="space-y-1.5 text-[11px] text-zinc-300">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Klik tombol <strong>Konfirmasi ke WA Admin</strong> di bawah untuk mengirim nomor sesi <span className="font-mono text-emerald-300">{shortTicketId}</span>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Serahkan uang tunai sebesar <strong className="text-white font-mono">{formattedPrice}</strong> ke kasir / operator photobooth.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Setelah pembayaran lunas diterima, {isPrint ? 'operator akan mencetak foto fisik Anda dan ' : ''}admin akan mengirimkan soft file langsung ke nomor WhatsApp Anda!
                </span>
              </div>
            </div>
          </div>

          {/* Pratinjau Pesan WA */}
          <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/70 text-[11px]">
            <span className="text-zinc-400 text-[10px] block mb-1">
              💬 Format Pesan WhatsApp Otomatis:
            </span>
            <p className="text-zinc-300 whitespace-pre-line font-mono text-[10px] leading-relaxed bg-black/40 p-2 rounded-lg border border-zinc-800">
              {messageText}
            </p>
          </div>

          {/* Tombol Aksi Tunai */}
          <div className="space-y-2 pt-1">
            {/* Langkah 1: Buka WA untuk konfirmasi */}
            <button
              type="button"
              onClick={handleOpenWhatsapp}
              disabled={isProcessing}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4" />
              <span>1. Konfirmasi ke WA Admin (+{targetWaNumber})</span>
            </button>

            {/* Langkah 2: Sudah bayar & serahkan uang */}
            <button
              type="button"
              onClick={handleConfirmCashPaid}
              disabled={isProcessing}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan Sesi...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. Saya Sudah Serahkan Uang Tunai (Lanjut ➔)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Konten Metode: 2. SCAN QRIS DIGITAL */}
      {selectedMethod === 'qris' && (
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-3.5 shadow-xl text-center">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 text-left">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Alur Pembayaran Scan QRIS</h3>
                <p className="text-[10px] text-zinc-400">Bayar dulu via QRIS, lalu konfirmasi ke WA admin</p>
              </div>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              Instan
            </span>
          </div>

          {/* Tahapan Alur QRIS */}
          <div className="bg-zinc-900/90 rounded-xl p-3 border border-zinc-800 space-y-2 text-left text-xs">
            <span className="text-[11px] font-bold text-zinc-200 block">
              Tahapan Pembayaran QRIS:
            </span>
            <div className="space-y-1.5 text-[11px] text-zinc-300">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Scan kode QRIS di bawah dan selesaikan pembayaran <strong className="text-white font-mono">{formattedPrice}</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Klik tombol <strong>Konfirmasi & Kirim Bukti ke WA Admin</strong> di bawah.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Setelah diverifikasi, {isPrint ? 'operator akan mencetak foto fisik dan ' : ''}admin akan mengirimkan soft file ke WhatsApp Anda!
                </span>
              </div>
            </div>
          </div>

          {/* Gambar QRIS */}
          <div className="flex flex-col items-center justify-center py-1">
            <div className="p-3 bg-white rounded-2xl shadow-xl border-2 border-zinc-200 inline-block">
              {qrisQrCode ? (
                <img src={qrisQrCode} alt="QRIS Code" className="w-44 h-44 object-contain" />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center text-zinc-500">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}
            </div>
            <span className="text-[11px] font-mono text-zinc-400 mt-2">
              Nominal Tertera: <strong className="text-white">{formattedPrice}</strong>
            </span>
          </div>

          {/* Tombol Aksi QRIS */}
          <div className="space-y-2 pt-1">
            <button
              onClick={handleConfirmQrisPaid}
              disabled={isProcessing}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs sm:text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Membuka WhatsApp Admin...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Sudah Bayar? Konfirmasi & Kirim Bukti ke WA Admin ➔</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => triggerSuccessTransition('QRIS Digital')}
              className="w-full py-2 px-3 rounded-xl bg-transparent hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Sudah chat admin? Lanjut ke Layar Status ➔
            </button>
          </div>
        </div>
      )}

      {/* Footer Legal */}
      <div className="pt-2 border-t border-zinc-900 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 font-sans">
        {onOpenLegal && (
          <>
            <button
              onClick={() => onOpenLegal('terms')}
              className="hover:text-amber-400 hover:underline transition-colors cursor-pointer"
            >
              Syarat & Ketentuan
            </button>
            <span>•</span>
            <button
              onClick={() => onOpenLegal('refund')}
              className="hover:text-amber-400 hover:underline transition-colors cursor-pointer"
            >
              Kebijakan Refund
            </button>
            <span>•</span>
            <button
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-amber-400 hover:underline transition-colors cursor-pointer"
            >
              Kebijakan Privasi
            </button>
            <span>•</span>
            <button
              onClick={() => onOpenLegal('contact')}
              className="hover:text-amber-400 hover:underline transition-colors cursor-pointer"
            >
              Bantuan
            </button>
          </>
        )}
      </div>
    </div>
  );
};
