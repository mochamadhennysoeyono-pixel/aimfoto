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
  Code2,
  Cloud,
} from 'lucide-react';
import { PhotoboothOrder, PhotoboothSession, EventConfig } from '../types';
import { processPayment } from '../services/paymentService';
import { supabase, HARDCODED_EVENT_ID } from '../supabaseClient';
import { generateUuid } from '../utils/uuid';

interface Step6CheckoutProps {
  session: PhotoboothSession;
  order: PhotoboothOrder;
  eventConfig: EventConfig;
  onPaymentSuccess: (order: PhotoboothOrder) => void;
  onBack: () => void;
}

export const Step6Checkout: React.FC<Step6CheckoutProps> = ({
  session,
  order,
  eventConfig,
  onPaymentSuccess,
  onBack,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'QRIS' | 'GOPAY' | 'VA'>('QRIS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeveloperNotes, setShowDeveloperNotes] = useState(false);
  const [supabaseOrderStatus, setSupabaseOrderStatus] = useState<string | null>(null);

  const formattedPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(order.harga);

  // Trigger payment simulation and insert order into Supabase
  const handlePayment = async () => {
    setIsProcessing(true);
    setSupabaseOrderStatus('Menyimpan pesanan ke Supabase...');

    try {
      const result = await processPayment(order, selectedMethod);

      if (result.success) {
        // Insert order record into Supabase 'orders' table
        try {
          const activeSessionId = order.sessionId || session.id;

          // 1. Pastikan session tercatat di tabel sessions Supabase agar foreign key tidak error
          const { data: sessionInDb } = await supabase
            .from('sessions')
            .select('id')
            .eq('id', activeSessionId)
            .maybeSingle();

          if (!sessionInDb) {
            await supabase.from('sessions').upsert([{
              id: activeSessionId,
              event_id: session.eventId || eventConfig.id || HARDCODED_EVENT_ID,
              status: 'draft',
              filter_applied: session.filterDipilih,
              frame_id: session.frameDipilih,
            }], { onConflict: 'id' });
          }

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

          const { data, error } = await supabase
            .from('orders')
            .upsert([orderPayload], { onConflict: 'id' })
            .select();

          if (error) {
            console.warn('Supabase orders insert notice:', error.message);
            setSupabaseOrderStatus(`Supabase note: ${error.message}`);
          } else {
            console.log('Order berhasil disimpan di Supabase:', data);
            setSupabaseOrderStatus('Order tersimpan di Supabase');
          }

          // 3. Update status sesi terkait di tabel sessions Supabase menjadi 'paid'
          await supabase
            .from('sessions')
            .update({
              status: 'paid',
              filter_applied: session.filterDipilih,
              frame_id: session.frameDipilih,
            })
            .eq('id', activeSessionId);
        } catch (dbErr: any) {
          console.warn('Error saving order to Supabase:', dbErr);
        }

        const updatedOrder: PhotoboothOrder = {
          ...order,
          statusPembayaran: 'settlement',
          paymentMethod: result.paymentMethod,
          transactionId: result.transactionId,
        };
        onPaymentSuccess(updatedOrder);
      }
    } catch (err) {
      console.error('Pembayaran gagal:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md mx-auto w-full p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <button
          onClick={onBack}
          disabled={isProcessing}
          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-40"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <h2 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
            <CreditCard className="w-4 h-4 text-amber-400" />
            Checkout & Pembayaran
          </h2>
          <p className="text-[10px] font-mono text-zinc-400">
            ORDER #{order.id.slice(0, 8)} • {eventConfig.nama}
          </p>
          <p className="text-[9px] font-mono text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
            <Cloud className="w-2.5 h-2.5" />
            <span>{supabaseOrderStatus || 'Supabase orders connected'}</span>
          </p>
        </div>

        <button
          onClick={() => setShowDeveloperNotes(!showDeveloperNotes)}
          className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-amber-400 hover:text-amber-300"
          title="Catatan Integrasi Midtrans & Supabase"
        >
          <Code2 className="w-4 h-4" />
        </button>
      </div>

      {/* Developer Integration Guide Banner (toggleable) */}
      {showDeveloperNotes && (
        <div className="mb-3 p-3.5 rounded-xl bg-zinc-900/95 border border-amber-500/40 text-[11px] text-zinc-300 space-y-2 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" />
              Integrasi Payment Gateway & Supabase
            </span>
            <button
              onClick={() => setShowDeveloperNotes(false)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          </div>
          <p className="text-zinc-300 leading-relaxed">
            Fungsi placeholder <code className="text-amber-300 font-mono">processPayment()</code> berada di <code className="text-amber-300 font-mono">src/services/paymentService.ts</code>.
          </p>
          <div className="bg-black/60 p-2 rounded-lg font-mono text-[10px] text-zinc-400 space-y-1">
            <p className="text-emerald-400">// Contoh payload ke Supabase & Midtrans:</p>
            <p>1. supabase.from('orders').insert({'{ id, session_id, harga, status }'})</p>
            <p>2. snap.pay(token, {'{ onSuccess: (res) => handleSuccess() }'})</p>
          </div>
        </div>
      )}

      {/* Order Summary Card */}
      <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 space-y-3 mb-3">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-800">
          <span className="text-zinc-400 font-medium">Ringkasan Pesanan</span>
          <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
            1 Paket Cetak + HD
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium text-white">1x Cetak Foto Fisik Kiosk</p>
                <p className="text-[10px] text-zinc-500">Kertas glossy 4R cetak instan di booth</p>
              </div>
            </div>
            <span className="font-mono text-zinc-300">Termasuk</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium text-white">1x File Digital Resolusi Penuh</p>
                <p className="text-[10px] text-zinc-500">Download langsung ke memori HP</p>
              </div>
            </div>
            <span className="font-mono text-zinc-300">Termasuk</span>
          </div>
        </div>

        <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300">Total Pembayaran</span>
          <span className="text-lg font-bold text-amber-400 font-mono">
            {formattedPrice}
          </span>
        </div>
      </div>

      {/* Payment Gateway Options & QRIS Mock Display */}
      <div className="space-y-2.5 my-auto">
        <p className="text-xs font-semibold text-zinc-300 px-1">Pilih Metode Pembayaran:</p>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setSelectedMethod('QRIS')}
            className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
              selectedMethod === 'QRIS'
                ? 'border-amber-400 bg-amber-400/10 text-amber-400 font-bold'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <QrCode className="w-5 h-5 mb-1" />
            <span className="text-xs">QRIS</span>
            <span className="text-[9px] text-zinc-500">Semua E-Wallet</span>
          </button>

          <button
            onClick={() => setSelectedMethod('GOPAY')}
            className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
              selectedMethod === 'GOPAY'
                ? 'border-amber-400 bg-amber-400/10 text-amber-400 font-bold'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <Smartphone className="w-5 h-5 mb-1" />
            <span className="text-xs">GoPay / Shopee</span>
            <span className="text-[9px] text-zinc-500">App Langsung</span>
          </button>

          <button
            onClick={() => setSelectedMethod('VA')}
            className={`p-2.5 rounded-xl border flex flex-col items-center text-center transition-all cursor-pointer ${
              selectedMethod === 'VA'
                ? 'border-amber-400 bg-amber-400/10 text-amber-400 font-bold'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <Building className="w-5 h-5 mb-1" />
            <span className="text-xs">Virtual Account</span>
            <span className="text-[9px] text-zinc-500">BCA / Mandiri / BRI</span>
          </button>
        </div>

        {/* Dynamic Payment Details Area */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/90 flex flex-col items-center text-center">
          {selectedMethod === 'QRIS' && (
            <div className="flex flex-col items-center space-y-2">
              <div className="p-2.5 bg-white rounded-xl shadow-lg">
                {/* SVG Mock QR Code */}
                <svg
                  className="w-36 h-36"
                  viewBox="0 0 100 100"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Outer QR corners */}
                  <rect width="100" height="100" fill="white" />
                  {/* Top-left marker */}
                  <rect x="10" y="10" width="28" height="28" fill="#111827" rx="3" />
                  <rect x="14" y="14" width="20" height="20" fill="white" rx="2" />
                  <rect x="18" y="18" width="12" height="12" fill="#111827" rx="1" />
                  {/* Top-right marker */}
                  <rect x="62" y="10" width="28" height="28" fill="#111827" rx="3" />
                  <rect x="66" y="14" width="20" height="20" fill="white" rx="2" />
                  <rect x="70" y="18" width="12" height="12" fill="#111827" rx="1" />
                  {/* Bottom-left marker */}
                  <rect x="10" y="62" width="28" height="28" fill="#111827" rx="3" />
                  <rect x="14" y="66" width="20" height="20" fill="white" rx="2" />
                  <rect x="18" y="70" width="12" height="12" fill="#111827" rx="1" />
                  {/* QR Pattern dots */}
                  <rect x="42" y="14" width="6" height="6" fill="#111827" />
                  <rect x="50" y="22" width="6" height="6" fill="#111827" />
                  <rect x="42" y="30" width="6" height="6" fill="#111827" />
                  <rect x="14" y="44" width="6" height="6" fill="#111827" />
                  <rect x="22" y="52" width="6" height="6" fill="#111827" />
                  <rect x="44" y="44" width="12" height="12" fill="#111827" />
                  <rect x="62" y="44" width="6" height="6" fill="#111827" />
                  <rect x="76" y="44" width="10" height="6" fill="#111827" />
                  <rect x="44" y="64" width="8" height="8" fill="#111827" />
                  <rect x="62" y="64" width="6" height="6" fill="#111827" />
                  <rect x="74" y="72" width="12" height="12" fill="#111827" />
                  <rect x="56" y="80" width="8" height="8" fill="#111827" />
                  {/* Center tiny logo */}
                  <rect x="44" y="44" width="12" height="12" rx="2" fill="#F59E0B" />
                </svg>
              </div>
              <p className="text-[11px] font-mono text-zinc-400">
                Scan via BCA, Mandiri, GoPay, OVO, Dana, ShopeePay
              </p>
            </div>
          )}

          {selectedMethod === 'GOPAY' && (
            <div className="py-4 space-y-1">
              <p className="text-xs font-semibold text-white">Deeplink E-Wallet Otomatis</p>
              <p className="text-[11px] text-zinc-400">
                Aplikasi GoPay / ShopeePay Anda akan terbuka otomatis saat checkout.
              </p>
            </div>
          )}

          {selectedMethod === 'VA' && (
            <div className="py-3 space-y-1.5">
              <p className="text-xs font-semibold text-white">Nomor Virtual Account</p>
              <p className="text-sm font-mono font-bold text-amber-400 tracking-wider bg-zinc-900 px-3 py-1 rounded-lg border border-zinc-800">
                8808 2901 3849 2011
              </p>
              <p className="text-[10px] text-zinc-500">Dicek otomatis dalam 3 detik</p>
            </div>
          )}
        </div>
      </div>

      {/* Simulator Payment Action */}
      <div className="pt-3 pb-2 space-y-2">
        <button
          id="btn-simulate-payment"
          onClick={handlePayment}
          disabled={isProcessing}
          className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Memproses Pembayaran...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Simulasikan Pembayaran Berhasil</span>
            </>
          )}
        </button>

        <p className="text-[10px] text-center text-zinc-500 flex items-center justify-center gap-1">
          <Lock className="w-3 h-3 text-zinc-400" />
          Gateway siap disambungkan ke Midtrans Snap / Xendit API
        </p>
      </div>
    </div>
  );
};
