import React, { useState, useEffect } from 'react';
import {
  Phone,
  MessageSquare,
  Send,
  Save,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Banknote,
  QrCode,
  Sparkles,
  Gift,
  Smartphone,
  Printer,
  Tag,
  ShieldCheck,
} from 'lucide-react';
import { getAdminWhatsapp, saveAdminWhatsapp } from '../services/adminContactService';
import { EventConfig } from '../types';

export const AdminPaymentWhatsapp: React.FC = () => {
  const [adminPhone, setAdminPhone] = useState<string>(getAdminWhatsapp());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Configuration state for flexible rumahan & event
  const [isFreeEvent, setIsFreeEvent] = useState(false);
  const [hargaDigital, setHargaDigital] = useState<number>(10000);
  const [hargaPrint, setHargaPrint] = useState<number>(25000);
  const [paymentMethodsAllowed, setPaymentMethodsAllowed] = useState<'all' | 'cash' | 'digital'>('all');
  const [packagesAllowed, setPackagesAllowed] = useState<'both' | 'digital_only' | 'print_only'>('both');
  const [promoBadge, setPromoBadge] = useState<string>('Promo Spesial Studio Rumahan');
  const [promoDescription, setPromoDescription] = useState<string>(
    'Hasil foto tajam resolusi tinggi 300 DPI, pencahayaan optimal, & cetak instan!'
  );
  const [cashInstruction, setCashInstruction] = useState<string>(
    'Serahkan uang tunai langsung ke kasir atau operator photobooth'
  );

  useEffect(() => {
    setAdminPhone(getAdminWhatsapp());

    try {
      const cached = localStorage.getItem('photobooth_cached_event_config');
      if (cached) {
        const parsed: Partial<EventConfig> = JSON.parse(cached);
        if (parsed) {
          setIsFreeEvent(
            parsed.isFreeEvent === true ||
              (parsed.hargaPerFoto === 0 && (parsed.hargaDigital ?? 0) === 0 && (parsed.hargaPrint ?? 0) === 0)
          );
          if (parsed.hargaDigital !== undefined) setHargaDigital(parsed.hargaDigital);
          if (parsed.hargaPrint !== undefined) setHargaPrint(parsed.hargaPrint);
          else if (parsed.hargaPerFoto) setHargaPrint(parsed.hargaPerFoto);
          if (parsed.paymentMethodsAllowed) setPaymentMethodsAllowed(parsed.paymentMethodsAllowed);
          if (parsed.packagesAllowed) setPackagesAllowed(parsed.packagesAllowed);
          if (parsed.promoBadge) setPromoBadge(parsed.promoBadge);
          if (parsed.promoDescription) setPromoDescription(parsed.promoDescription);
          if (parsed.cashInstruction) setCashInstruction(parsed.cashInstruction);
        }
      }
    } catch (e) {
      console.warn('Error load cached event config in admin:', e);
    }
  }, []);

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Simpan nomor WA
    saveAdminWhatsapp(adminPhone);
    setAdminPhone(getAdminWhatsapp());

    // 2. Simpan konfigurasi tarif & pembayaran ke localStorage
    try {
      let baseConfig: any = {};
      const cached = localStorage.getItem('photobooth_cached_event_config');
      if (cached) {
        baseConfig = JSON.parse(cached);
      }

      const updatedConfig: Partial<EventConfig> = {
        ...baseConfig,
        isFreeEvent,
        hargaDigital: isFreeEvent ? 0 : Number(hargaDigital) || 0,
        hargaPrint: isFreeEvent ? 0 : Number(hargaPrint) || 0,
        hargaPerFoto: isFreeEvent ? 0 : Number(hargaPrint) || 25000,
        paymentMethodsAllowed,
        packagesAllowed,
        promoBadge: promoBadge.trim(),
        promoDescription: promoDescription.trim(),
        cashInstruction: cashInstruction.trim(),
      };

      localStorage.setItem('photobooth_cached_event_config', JSON.stringify(updatedConfig));

      // Beritahu Kiosk secara instan via event
      window.dispatchEvent(
        new CustomEvent('photobooth-event-config-updated', {
          detail: updatedConfig,
        })
      );
    } catch (err) {
      console.warn('Gagal menyimpan config ke localStorage:', err);
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanPhone = adminPhone.replace(/[^0-9]/g, '');
  const formattedWaNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
  const samplePrice = isFreeEvent ? 'GRATIS (Rp 0)' : `Rp ${Number(hargaPrint).toLocaleString('id-ID')}`;
  const sampleMessage = `Halo Admin, saya ingin konfirmasi pembayaran photobooth sesi #SAMPLE-123 sebesar ${samplePrice}.`;
  const testWaUrl = `https://wa.me/${formattedWaNumber}?text=${encodeURIComponent(
    'Halo Admin! Ini adalah pesan uji coba dari sistem Photobooth AIM SPACE Studio.'
  )}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-950 to-[#0b0e14] border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
              <Banknote className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Pengaturan Tarif, Pembayaran & WhatsApp
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {isFreeEvent ? 'Free Event Mode' : 'Flexible Studio Mode'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                Sesuaikan photobooth untuk <strong>usaha rumahan / toko</strong> atau <strong>sewa event (Rp 0)</strong>. Atur harga paket digital vs cetak fisik, serta pilihan metode pembayaran (Tunai ke Kasir dan/atau QRIS Digital).
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kolom Kiri: Pengaturan Tarif & Mode Event */}
          <div className="lg:col-span-7 space-y-5">
            {/* Kartu 1: Mode Event Gratis / Sewa Hajatan */}
            <div className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Mode Event Gratis (Sewa Wedding / Pesta)</h3>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Opsi Rp 0</span>
              </div>

              <label className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-900 transition-colors">
                <input
                  type="checkbox"
                  checked={isFreeEvent}
                  onChange={(e) => setIsFreeEvent(e.target.checked)}
                  className="w-5 h-5 rounded mt-0.5 accent-emerald-500 cursor-pointer"
                />
                <div>
                  <strong className="text-sm text-white block">
                    Aktifkan Mode Sesi Gratis (Rp 0 untuk Semua Tamu)
                  </strong>
                  <span className="text-xs text-zinc-400 leading-relaxed block mt-0.5">
                    Cocok saat photobooth disewa untuk acara pernikahan, ulang tahun, atau kantor. Tamu tidak akan ditagih pembayaran dan langsung bisa cetak/download foto.
                  </span>
                </div>
              </label>
            </div>

            {/* Kartu 2: Opsi Tampilan Paket di Kiosk (Digital vs Cetak Fisik) */}
            <div className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Paket yang Ditampilkan di Kiosk</h3>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Pilihan Paket</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-400 block">
                  Tentukan apakah kiosk menampilkan salah satu paket saja atau keduanya:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Opsi 1: Keduanya */}
                  <button
                    type="button"
                    onClick={() => setPackagesAllowed('both')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      packagesAllowed === 'both'
                        ? 'bg-amber-500/15 border-amber-400 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold block mb-1 flex items-center gap-1.5">
                        <span>📱 & 🖨️ Keduanya</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 block font-normal leading-snug">
                        Pengunjung bebas memilih paket di layar Kiosk
                      </span>
                    </div>
                    {packagesAllowed === 'both' && (
                      <span className="mt-2 text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 inline-block w-fit">
                        Aktif Keduanya
                      </span>
                    )}
                  </button>

                  {/* Opsi 2: Hanya Digital */}
                  <button
                    type="button"
                    onClick={() => setPackagesAllowed('digital_only')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      packagesAllowed === 'digital_only'
                        ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 font-bold shadow-md shadow-cyan-500/10'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold block mb-1 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Hanya Digital</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 block font-normal leading-snug">
                        Tanpa cetak fisik. File HD dikirimkan admin via WhatsApp
                      </span>
                    </div>
                    {packagesAllowed === 'digital_only' && (
                      <span className="mt-2 text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 inline-block w-fit">
                        Hanya Softfile WA
                      </span>
                    )}
                  </button>

                  {/* Opsi 3: Hanya Cetak Fisik */}
                  <button
                    type="button"
                    onClick={() => setPackagesAllowed('print_only')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      packagesAllowed === 'print_only'
                        ? 'bg-amber-500/15 border-amber-400 text-amber-300 font-bold shadow-md shadow-amber-500/10'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold block mb-1 flex items-center gap-1.5">
                        <Printer className="w-3.5 h-3.5 text-amber-400" />
                        <span>Hanya Cetak</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 block font-normal leading-snug">
                        Cetak foto strip fisik (+ softfile dikirim via WhatsApp)
                      </span>
                    </div>
                    {packagesAllowed === 'print_only' && (
                      <span className="mt-2 text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 inline-block w-fit">
                        Hanya Cetak Fisik
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Input Tarif Harga */}
              <div className="pt-2 border-t border-zinc-800/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-zinc-300">Penetapan Tarif Harga (IDR)</span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {isFreeEvent ? 'Gratis Rp 0' : 'Sesuai Pilihan Paket'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Harga Paket Digital */}
                  <div
                    className={`space-y-1.5 p-3.5 rounded-2xl border transition-all ${
                      packagesAllowed === 'print_only'
                        ? 'bg-zinc-950/50 border-zinc-900 opacity-50'
                        : 'bg-zinc-900/80 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Tarif Paket Digital (Rp)</span>
                      </label>
                      {packagesAllowed === 'print_only' && (
                        <span className="text-[9px] font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                          Disembunyikan
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      value={hargaDigital}
                      disabled={isFreeEvent || packagesAllowed === 'print_only'}
                      onChange={(e) => setHargaDigital(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="10000"
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl py-2.5 px-3 text-sm text-white font-mono focus:outline-none focus:border-cyan-400 disabled:opacity-40"
                    />
                    <p className="text-[10px] text-zinc-500">
                      {packagesAllowed === 'print_only'
                        ? 'Paket digital disembunyikan di Kiosk'
                        : 'Download file asli HD via QR & WhatsApp'}
                    </p>
                  </div>

                  {/* Harga Paket Cetak */}
                  <div
                    className={`space-y-1.5 p-3.5 rounded-2xl border transition-all ${
                      packagesAllowed === 'digital_only'
                        ? 'bg-zinc-950/50 border-zinc-900 opacity-50'
                        : 'bg-zinc-900/80 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                        <Printer className="w-3.5 h-3.5" />
                        <span>Tarif Paket Cetak Fisik (Rp)</span>
                      </label>
                      {packagesAllowed === 'digital_only' && (
                        <span className="text-[9px] font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                          Disembunyikan
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      value={hargaPrint}
                      disabled={isFreeEvent || packagesAllowed === 'digital_only'}
                      onChange={(e) => setHargaPrint(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="25000"
                      className="w-full bg-zinc-950 border border-zinc-700/80 rounded-xl py-2.5 px-3 text-sm text-white font-mono focus:outline-none focus:border-amber-400 disabled:opacity-40"
                    />
                    <p className="text-[10px] text-zinc-500">
                      {packagesAllowed === 'digital_only'
                        ? 'Paket cetak disembunyikan di Kiosk'
                        : 'Cetak lembar photo strip + otomatis dapat file HD'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Kartu 3: Pilihan Metode Pembayaran Kiosk */}
            <div className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Metode Pembayaran yang Ditampilkan</h3>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Kiosk Checkout</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethodsAllowed('all')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    paymentMethodsAllowed === 'all'
                      ? 'bg-amber-500/15 border-amber-400 text-amber-300 font-bold'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-xs block mb-1">💵 & 📱 Semua Aktif</span>
                  <span className="text-[10px] text-zinc-400 block font-normal">
                    Pelanggan bisa pilih Tunai atau QRIS
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethodsAllowed('cash')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    paymentMethodsAllowed === 'cash'
                      ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300 font-bold'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-xs block mb-1">💵 Hanya Tunai</span>
                  <span className="text-[10px] text-zinc-400 block font-normal">
                    Bayar langsung ke kasir toko
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethodsAllowed('digital')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    paymentMethodsAllowed === 'digital'
                      ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 font-bold'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-xs block mb-1">📱 Hanya QRIS</span>
                  <span className="text-[10px] text-zinc-400 block font-normal">
                    Scan digital BCA, GoPay, OVO, dll
                  </span>
                </button>
              </div>

              {/* Petunjuk Bayar Tunai Custom */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-zinc-300">
                  Petunjuk untuk Pelanggan yang Membayar Tunai
                </label>
                <input
                  type="text"
                  value={cashInstruction}
                  onChange={(e) => setCashInstruction(e.target.value)}
                  placeholder="Serahkan uang tunai ke kasir atau operator photobooth"
                  className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-xl py-2.5 px-3 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Teks Promo & Nomor WhatsApp */}
          <div className="lg:col-span-5 space-y-5">
            {/* Kartu Promo di Halaman Depan */}
            <div className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Informasi Promo di Halaman Depan</h3>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Judul Badge Promo</label>
                  <input
                    type="text"
                    value={promoBadge}
                    onChange={(e) => setPromoBadge(e.target.value)}
                    placeholder="Promo Spesial Studio Rumahan"
                    className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Deskripsi Promo Singkat</label>
                  <textarea
                    rows={2}
                    value={promoDescription}
                    onChange={(e) => setPromoDescription(e.target.value)}
                    placeholder="Hasil foto tajam resolusi tinggi 300 DPI, pencahayaan optimal, & cetak instan!"
                    className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Kartu WhatsApp Kasir */}
            <div className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Nomor WhatsApp Kasir / Toko</h3>
                </div>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder="081234567890"
                  className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-xl py-2.5 px-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
                <p className="text-[11px] text-zinc-500">
                  Digunakan jika pelanggan ingin mengirim bukti bayar atau butuh bantuan saat di kiosk.
                </p>

                <a
                  href={testWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Uji Hubungi Nomor WA (+{formattedWaNumber})</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Notifikasi & Tombol Simpan Terpadu */}
        {savedSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>
              Semua pengaturan tarif paket, metode pembayaran, dan promo berhasil disimpan & langsung aktif di Kiosk!
            </span>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="w-full sm:w-auto py-3.5 px-8 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4 stroke-[2.5]" />
            <span>Simpan Semua Perubahan</span>
          </button>
        </div>
      </form>
    </div>
  );
};
