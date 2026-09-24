import React, { useMemo } from 'react';
import {
  Camera,
  Calendar,
  MapPin,
  Tag,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  Smartphone,
  Printer,
  Check,
  Banknote,
  QrCode,
  Gift,
} from 'lucide-react';
import { EventConfig } from '../types';

interface Step1EventInfoProps {
  eventConfig: EventConfig;
  onStart: () => void;
  onOpenAdmin?: () => void;
  onOpenLegal?: (tab: 'terms' | 'refund' | 'contact' | 'privacy') => void;
  selectedPackage?: 'digital' | 'print';
  onSelectPackage?: (pkg: 'digital' | 'print') => void;
}

export const Step1EventInfo: React.FC<Step1EventInfoProps> = ({
  eventConfig,
  onStart,
  onOpenAdmin,
  onOpenLegal,
  selectedPackage = 'print',
  onSelectPackage,
}) => {
  const packagesAllowed = eventConfig.packagesAllowed || 'both';

  // Pastikan selectedPackage otomatis sinkron dengan paket tunggal jika mode single-package
  React.useEffect(() => {
    if (packagesAllowed === 'digital_only' && selectedPackage !== 'digital') {
      onSelectPackage?.('digital');
    } else if (packagesAllowed === 'print_only' && selectedPackage !== 'print') {
      onSelectPackage?.('print');
    }
  }, [packagesAllowed, selectedPackage, onSelectPackage]);

  // Cek apakah event ini gratis (0rb)
  const isFreeEvent =
    eventConfig.isFreeEvent === true ||
    (eventConfig.hargaPerFoto === 0 &&
      (eventConfig.hargaDigital ?? 0) === 0 &&
      (eventConfig.hargaPrint ?? 0) === 0);

  const priceDigital = eventConfig.hargaDigital ?? (isFreeEvent ? 0 : 10000);
  const pricePrint =
    eventConfig.hargaPrint ??
    (isFreeEvent ? 0 : eventConfig.hargaPerFoto > 0 ? eventConfig.hargaPerFoto : 25000);

  const formatRupiah = (val: number) => {
    if (val === 0 || isFreeEvent) return 'GRATIS (Rp 0)';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Tanggal hari ini otomatis langsung ditampilkan
  const todayFormatted = useMemo(() => {
    try {
      return new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Hari Ini';
    }
  }, []);

  const displayDate =
    eventConfig.tanggal &&
    eventConfig.tanggal.trim() !== '' &&
    eventConfig.tanggal.toLowerCase() !== 'hari ini'
      ? eventConfig.tanggal
      : todayFormatted;

  const paymentAllowed = eventConfig.paymentMethodsAllowed || 'all';

  return (
    <div className="flex-1 flex flex-col justify-between max-w-xl mx-auto w-full p-4 sm:p-5 overflow-y-auto space-y-4">
      {/* Top Section: Header & Info Event */}
      <div className="space-y-3.5">
        {/* Banner Promo / Status Event */}
        {isFreeEvent ? (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-500/20 border border-emerald-500/40 text-center shadow-lg shadow-emerald-500/10 animate-in fade-in">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider mb-1">
              <Gift className="w-3 h-3" />
              <span>Special Free Access Event</span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              {eventConfig.promoBadge || '🎉 100% GRATIS UNTUK SELURUH TAMU EVENT'}
            </h3>
            <p className="text-[11px] text-emerald-200/90 mt-0.5">
              Bebas berfoto, gunakan frame eksklusif, dan cetak tanpa dipungut biaya apapun!
            </p>
          </div>
        ) : (
          <div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 text-center shadow-md">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-[10px] font-extrabold uppercase tracking-wider mb-1">
              <Sparkles className="w-3 h-3" />
              <span>{eventConfig.promoBadge || 'Promo Spesial Studio'}</span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-zinc-200">
              {eventConfig.promoDescription ||
                'Hasil foto tajam resolusi tinggi 300 DPI, pencahayaan optimal, & cetak instan!'}
            </p>
          </div>
        )}

        {/* Event Title & Subtitle */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            {eventConfig.nama || 'AIM SPACE Studio'}
          </h1>
          {eventConfig.subtitle && (
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
              {eventConfig.subtitle}
            </p>
          )}
        </div>

        {/* Bento Ringkas: Tanggal & Lokasi */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 max-w-md mx-auto">
          <div className="p-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-mono text-zinc-500 uppercase block">Tanggal</span>
              <span className="text-xs font-semibold text-zinc-200 truncate block">
                {displayDate}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-mono text-zinc-500 uppercase block">Lokasi</span>
              <span className="text-xs font-semibold text-zinc-200 truncate block">
                {eventConfig.lokasi || 'AIM SPACE Studio'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Katalog Paket Digital vs Cetak */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {packagesAllowed === 'digital_only'
                ? 'Paket Digital Photobooth'
                : packagesAllowed === 'print_only'
                ? 'Paket Cetak Photobooth'
                : 'Pilihan Paket Photobooth'}
            </span>
          </div>
          <span className="text-[10px] text-zinc-400">
            {isFreeEvent
              ? 'Gratis Disponsori Event'
              : packagesAllowed === 'both'
              ? 'Pilih salah satu paket di bawah'
              : 'Paket Resmi Kiosk Aktif'}
          </span>
        </div>

        {/* Dynamic Package Cards: Single (Digital Only / Print Only) or Both */}
        {packagesAllowed === 'digital_only' ? (
          /* SINGLE CARD: Digital Only */
          <div
            onClick={() => onSelectPackage && onSelectPackage('digital')}
            className="relative p-4 rounded-2xl bg-zinc-900 border border-cyan-400 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-400/50 flex flex-col justify-between"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Paket Digital Softfile HD</h4>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    File foto digital HD dikirimkan langsung oleh admin via WhatsApp.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-cyan-400 text-zinc-950 text-[10px] font-extrabold flex items-center gap-1 shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
                Paket Aktif
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2 py-2 border-y border-zinc-800/80 text-[11px] text-zinc-300">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>File Asli HD 300 DPI</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Kirim via WhatsApp Admin</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Filter Warna & Stiker</span>
              </div>
            </div>

            <div className="pt-1 flex items-baseline justify-between">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Tarif Digital</span>
              <span className="text-base font-extrabold text-cyan-300 font-mono">
                {formatRupiah(priceDigital)}
              </span>
            </div>
          </div>
        ) : packagesAllowed === 'print_only' ? (
          /* SINGLE CARD: Print Only */
          <div
            onClick={() => onSelectPackage && onSelectPackage('print')}
            className="relative p-4 rounded-2xl bg-zinc-900 border border-amber-400 shadow-xl shadow-amber-500/10 ring-1 ring-amber-400/50 flex flex-col justify-between"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/25 text-amber-400 flex items-center justify-center">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Paket Cetak Fisik + Softfile HD</h4>
                  <p className="text-[11px] text-zinc-400 leading-snug">
                    Cetak foto strip asli tebal & bonus softfile HD dikirim admin via WhatsApp.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-400 text-zinc-950 text-[10px] font-extrabold flex items-center gap-1 shrink-0">
                <Check className="w-3 h-3 stroke-[3]" />
                Paket Aktif
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2 py-2 border-y border-zinc-800/80 text-[11px] text-zinc-300">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>1x Lembar Photo Strip Glossy</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Softfile Dikirim Admin via WA</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Koleksi Frame & Stiker</span>
              </div>
            </div>

            <div className="pt-1 flex items-baseline justify-between">
              <span className="text-[10px] font-mono text-zinc-500 uppercase">Tarif Cetak Fisik</span>
              <span className="text-base font-extrabold text-amber-300 font-mono">
                {formatRupiah(pricePrint)}
              </span>
            </div>
          </div>
        ) : (
          /* BOTH PACKAGES: Grid 2 cards for user selection */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Paket 1: Digital Softfile */}
            <div
              onClick={() => onSelectPackage && onSelectPackage('digital')}
              className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedPackage === 'digital'
                  ? 'bg-zinc-900 border-cyan-400 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/50'
                  : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  {selectedPackage === 'digital' && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-400 text-zinc-950 text-[10px] font-bold flex items-center gap-1">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                      Dipilih
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-bold text-white mb-0.5">Paket Digital Softfile</h4>
                <p className="text-[11px] text-zinc-400 leading-snug mb-2">
                  Praktis tanpa cetak fisik. File HD dikirim langsung oleh admin via WhatsApp.
                </p>

                <ul className="space-y-1 text-[11px] text-zinc-300">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>File Asli HD 300 DPI Tanpa Watermark</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>Softfile Dikirim Admin via WhatsApp</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>Bebas Pasang Filter Potret & Stiker</span>
                  </li>
                </ul>
              </div>

              <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-baseline justify-between">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Tarif Digital</span>
                <span className="text-sm font-extrabold text-cyan-300 font-mono">
                  {formatRupiah(priceDigital)}
                </span>
              </div>
            </div>

            {/* Paket 2: Cetak Fisik + Digital (Rekomendasi) */}
            <div
              onClick={() => onSelectPackage && onSelectPackage('print')}
              className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedPackage === 'print'
                  ? 'bg-zinc-900 border-amber-400 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/50'
                  : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {/* Badge Rekomendasi */}
              <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 text-zinc-950 text-[9px] font-black uppercase tracking-wider shadow">
                Paling Populer ⭐
              </div>

              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center">
                    <Printer className="w-4 h-4" />
                  </div>
                  {selectedPackage === 'print' && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-zinc-950 text-[10px] font-bold flex items-center gap-1">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                      Dipilih
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-bold text-white mb-0.5">Paket Cetak Fisik + Softfile</h4>
                <p className="text-[11px] text-zinc-400 leading-snug mb-2">
                  Pengalaman komplit: cetak foto strip asli & softfile HD dikirim via WhatsApp!
                </p>

                <ul className="space-y-1 text-[11px] text-zinc-300">
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>1x Lembar Cetak Photo Strip Tebal Glossy</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-amber-400 shrink-0" />
                    <span><strong>Bonus</strong> Softfile HD Dikirim via WA</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Pilihan Frame Event & Kustom Stiker</span>
                  </li>
                </ul>
              </div>

              <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-baseline justify-between">
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Tarif Cetak</span>
                <span className="text-sm font-extrabold text-amber-300 font-mono">
                  {formatRupiah(pricePrint)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Informasi Metode Pembayaran Tersedia */}
        <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <span className="text-[11px] text-zinc-400 font-medium">Metode Pembayaran Tersedia:</span>
          <div className="flex flex-wrap items-center gap-2">
            {isFreeEvent ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                <Gift className="w-3 h-3" />
                <span>Gratis 0 Rupiah (Disponsori Event)</span>
              </span>
            ) : (
              <>
                {(paymentAllowed === 'all' || paymentAllowed === 'cash') && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-[11px] font-medium">
                    <Banknote className="w-3 h-3 text-emerald-400" />
                    <span>Tunai di Kasir / Toko</span>
                  </span>
                )}
                {(paymentAllowed === 'all' || paymentAllowed === 'digital') && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-[11px] font-medium">
                    <QrCode className="w-3 h-3 text-amber-400" />
                    <span>QRIS (BCA, GoPay, OVO, dll)</span>
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Panduan 3 Langkah Cepat */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="p-2 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <span className="text-[10px] font-mono text-amber-400 block mb-0.5">1. Pilih Frame</span>
            <span className="text-[10px] text-zinc-400">Pilih tema & layout strip</span>
          </div>
          <div className="p-2 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <span className="text-[10px] font-mono text-amber-400 block mb-0.5">2. Ambil Foto</span>
            <span className="text-[10px] text-zinc-400">Pose dengan hitung mundur</span>
          </div>
          <div className="p-2 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <span className="text-[10px] font-mono text-amber-400 block mb-0.5">3. Terima Foto</span>
            <span className="text-[10px] text-zinc-400">Cetak di kasir & kirim via WA</span>
          </div>
        </div>
      </div>

      {/* Bottom CTA Button & Legal */}
      <div className="pt-2 pb-1 border-t border-zinc-800/80 space-y-2">
        <button
          id="btn-start-photobooth"
          onClick={onStart}
          className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-sm sm:text-base shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2.5 transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        >
          <Camera className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          <span>
            {isFreeEvent
              ? 'Mulai Sesi Foto Gratis Sekarang'
              : `Mulai Photobooth (${selectedPackage === 'digital' ? 'Paket Digital' : 'Paket Cetak'})`}
          </span>
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
        </button>

        {/* Legal Links for Flip / Payment Gateway Verification */}
        <div className="pt-1 border-t border-zinc-900 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 font-sans">
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
                Kebijakan Pengembalian (Refund)
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
                Hubungi Kami
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
