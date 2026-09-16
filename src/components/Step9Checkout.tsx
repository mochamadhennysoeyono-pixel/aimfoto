import React, { useState } from 'react';
import {
  CreditCard,
  QrCode,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Printer,
  Sparkles,
  Smartphone,
  Building,
  Loader2,
  Cloud,
} from 'lucide-react';
import { PhotoboothOrder, PhotoboothSession, EventConfig } from '../types';
import { processPayment } from '../services/paymentService';
import { supabase, HARDCODED_EVENT_ID } from '../supabaseClient';
import { generateUuid } from '../utils/uuid';

interface Step9CheckoutProps {
  session: PhotoboothSession;
  order: PhotoboothOrder;
  eventConfig: EventConfig;
  onPaymentSuccess: (order: PhotoboothOrder) => void;
  onBack: () => void;
  onOpenLegal?: (tab: 'terms' | 'refund' | 'contact' | 'privacy') => void;
}

export const Step9Checkout: React.FC<Step9CheckoutProps> = ({
  session,
  order,
  eventConfig,
  onPaymentSuccess,
  onBack,
  onOpenLegal,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'QRIS' | 'GOPAY' | 'VA'>('QRIS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [supabaseOrderStatus, setSupabaseOrderStatus] = useState<string | null>(null);

  const formattedPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(order.harga);

  // Trigger payment simulation and insert order into Supabase
  const handlePayment = async () => {
    setIsProcessing(true);
    setSupabaseOrderStatus('Menyimpan pesanan ke database...');

    try {
      const result = await processPayment(order, selectedMethod);

      if (result.success) {
        // Insert or upsert session and order records into Supabase
        try {
          const activeSessionId = order.sessionId || session.id;

          // 1. Pastikan session tercatat di tabel sessions Supabase dengan frame_layout_id
          const sessionPayload: any = {
            id: activeSessionId,
            event_id: session.eventId || eventConfig.id || HARDCODED_EVENT_ID,
            status: 'draft',
            filter_applied: session.filterDipilih,
          };

          // Include frame_layout_id if present
          if (session.frame_layout_id) {
            sessionPayload.frame_layout_id = session.frame_layout_id;
          }
          if (session.frameDipilih) {
            sessionPayload.frame_id = session.frameDipilih;
          }

          await supabase.from('sessions').upsert([sessionPayload], { onConflict: 'id' });

          // 2. Pastikan ID order berupa UUID yang valid untuk PostgreSQL
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          const validOrderId = (order.id && uuidRegex.test(order.id)) ? order.id : generateUuid();

          const orderPayload = {
            id: validOrderId,
            session_id: activeSessionId,
            amount: order.harga,
            payment_status: 'success',
            payment_method: selectedMethod,
            paid_at: new Date().toISOString(),
          };

          await supabase
            .from('orders')
            .upsert([orderPayload], { onConflict: 'id' });
        } catch (dbErr: any) {
          console.warn('Database note during checkout:', dbErr.message);
        }

        const settledOrder: PhotoboothOrder = {
          ...order,
          statusPembayaran: 'success',
          paymentMethod: selectedMethod,
          transactionId: result.transactionId,
        };

        onPaymentSuccess(settledOrder);
      }
    } catch (err: any) {
      console.error('Payment error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full p-4 overflow-y-auto">
      {/* Top Header */}
      <div>
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
            Step 9: Pembayaran Kiosk
          </p>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center justify-center gap-1.5">
            <CreditCard className="w-4 h-4 text-amber-400" />
            Selesaikan Pembayaran
          </h2>
          <p className="text-xs text-zinc-400">
            Pilih metode pembayaran QRIS atau Cashless untuk cetak instan
          </p>
        </div>
      </div>

      {/* Main Payment Container */}
      <div className="space-y-3 my-auto">
        {/* Payment Method Selector */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setSelectedMethod('QRIS')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
              selectedMethod === 'QRIS'
                ? 'border-amber-400 bg-amber-500/10 text-amber-300 ring-2 ring-amber-400/20 font-bold'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <QrCode className="w-5 h-5 text-amber-400" />
            <span className="text-xs">QRIS</span>
          </button>

          <button
            onClick={() => setSelectedMethod('GOPAY')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
              selectedMethod === 'GOPAY'
                ? 'border-amber-400 bg-amber-500/10 text-amber-300 ring-2 ring-amber-400/20 font-bold'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <Smartphone className="w-5 h-5 text-amber-400" />
            <span className="text-xs">E-Wallet</span>
          </button>

          <button
            onClick={() => setSelectedMethod('VA')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
              selectedMethod === 'VA'
                ? 'border-amber-400 bg-amber-500/10 text-amber-300 ring-2 ring-amber-400/20 font-bold'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <Building className="w-5 h-5 text-amber-400" />
            <span className="text-xs">Virtual Acc</span>
          </button>
        </div>

        {/* QRIS Code Box */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center text-center shadow-xl">
          <div className="w-44 h-44 rounded-xl bg-white p-2.5 flex items-center justify-center shadow-md">
            {/* High visual quality QRIS barcode mockup */}
            <svg
              className="w-full h-full text-zinc-950"
              viewBox="0 0 100 100"
              fill="currentColor"
            >
              <rect width="100" height="100" fill="white" />
              {/* Corner squares */}
              <rect x="5" y="5" width="25" height="25" fill="#0c0e15" />
              <rect x="9" y="9" width="17" height="17" fill="white" />
              <rect x="13" y="13" width="9" height="9" fill="#0c0e15" />

              <rect x="70" y="5" width="25" height="25" fill="#0c0e15" />
              <rect x="74" y="9" width="17" height="17" fill="white" />
              <rect x="78" y="13" width="9" height="9" fill="#0c0e15" />

              <rect x="5" y="70" width="25" height="25" fill="#0c0e15" />
              <rect x="9" y="74" width="17" height="17" fill="white" />
              <rect x="13" y="78" width="9" height="9" fill="#0c0e15" />

              {/* Data blocks */}
              <rect x="36" y="8" width="6" height="6" fill="#0c0e15" />
              <rect x="46" y="8" width="8" height="6" fill="#0c0e15" />
              <rect x="58" y="8" width="6" height="6" fill="#0c0e15" />

              <rect x="36" y="18" width="8" height="6" fill="#0c0e15" />
              <rect x="50" y="18" width="6" height="8" fill="#0c0e15" />

              <rect x="8" y="36" width="6" height="6" fill="#0c0e15" />
              <rect x="8" y="46" width="8" height="6" fill="#0c0e15" />
              <rect x="8" y="56" width="6" height="6" fill="#0c0e15" />

              <rect x="36" y="36" width="28" height="28" fill="#0c0e15" />
              <rect x="42" y="42" width="16" height="16" fill="white" />
              <rect x="47" y="47" width="6" height="6" fill="#f59e0b" />

              <rect x="70" y="36" width="8" height="6" fill="#0c0e15" />
              <rect x="84" y="44" width="8" height="8" fill="#0c0e15" />
              <rect x="72" y="56" width="18" height="6" fill="#0c0e15" />

              <rect x="36" y="70" width="8" height="6" fill="#0c0e15" />
              <rect x="48" y="76" width="14" height="6" fill="#0c0e15" />
              <rect x="40" y="86" width="8" height="6" fill="#0c0e15" />

              <rect x="70" y="70" width="8" height="12" fill="#0c0e15" />
              <rect x="82" y="76" width="10" height="8" fill="#0c0e15" />
              <rect x="74" y="86" width="18" height="6" fill="#0c0e15" />
            </svg>
          </div>

          <div className="mt-3">
            <span className="text-[11px] font-mono text-zinc-400 block">
              Scan dengan BCA Mobile, GoPay, OVO, ShopeePay, atau DANA
            </span>
            <span className="text-xs font-mono font-bold text-amber-400 mt-1 block">
              Total Tagihan Sesi: {formattedPrice}
            </span>
          </div>
        </div>
      </div>

      {/* Action Button: Simulate Payment */}
      <div className="pt-2 border-t border-zinc-800 space-y-2">
        <button
          id="btn-simulate-payment"
          disabled={isProcessing}
          onClick={handlePayment}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-bold text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memverifikasi Pembayaran...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>Konfirmasi Pembayaran Berhasil (Simulasi)</span>
            </>
          )}
        </button>

        <p className="text-[10px] text-center text-zinc-500 font-mono">
          Kiosk otomatis mendeteksi status settlement dalam 3-5 detik
        </p>

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
    </div>
  );
};
