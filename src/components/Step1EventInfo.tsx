import React, { useMemo } from 'react';
import {
  Camera,
  Calendar,
  MapPin,
  Tag,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { EventConfig } from '../types';

interface Step1EventInfoProps {
  eventConfig: EventConfig;
  onStart: () => void;
  onOpenAdmin?: () => void;
  onOpenLegal?: (tab: 'terms' | 'refund' | 'contact' | 'privacy') => void;
}

export const Step1EventInfo: React.FC<Step1EventInfoProps> = ({
  eventConfig,
  onStart,
  onOpenLegal,
}) => {
  const formattedPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(eventConfig.hargaPerFoto ?? 0);

  // Tanggal hari ini otomatis langsung ditampilkan (contoh: "14 Sep 2026")
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

  return (
    <div className="flex-1 flex flex-col justify-between max-w-xl mx-auto w-full p-4 sm:p-6 overflow-y-auto">
      {/* Main Event Card / Hero Information */}
      <div className="my-auto py-4 text-center space-y-4">
        {/* Decorative Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 shadow-inner">
          <Camera className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-mono text-zinc-300 uppercase tracking-wider">
            Selamat Datang di Photobooth
          </span>
        </div>

        {/* Event Title */}
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            {eventConfig.nama || 'SnapMoment Photobooth'}
          </h1>
          {eventConfig.subtitle && (
            <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto line-clamp-2">
              {eventConfig.subtitle}
            </p>
          )}
        </div>

        {/* Event Highlights Bento (3 Kolom Sejajar Mendatar agar pas 1 layar) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-md mx-auto pt-1">
          {/* Tanggal */}
          <div className="p-2 sm:p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col items-center justify-center text-center">
            <Calendar className="w-4 h-4 text-amber-400 mb-1" />
            <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 uppercase">Tanggal</span>
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-200 mt-0.5 truncate max-w-full">
              {displayDate}
            </span>
          </div>

          {/* Lokasi */}
          <div className="p-2 sm:p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col items-center justify-center text-center">
            <MapPin className="w-4 h-4 text-amber-400 mb-1" />
            <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 uppercase">Lokasi</span>
            <span className="text-[11px] sm:text-xs font-semibold text-zinc-200 mt-0.5 truncate max-w-full">
              {eventConfig.lokasi || 'Kiosk'}
            </span>
          </div>

          {/* Biaya */}
          <div className="p-2 sm:p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col items-center justify-center text-center">
            <Tag className="w-4 h-4 text-amber-400 mb-1" />
            <span className="text-[9px] sm:text-[10px] font-mono text-amber-400 uppercase">Harga Sesi</span>
            <span className="text-[11px] sm:text-xs font-bold text-amber-300 mt-0.5 truncate max-w-full">
              {formattedPrice}
            </span>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs text-zinc-400 pt-1">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Kamera Live & Filter Instan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Cetak Langsung & Unduh HD</span>
          </div>
        </div>
      </div>

      {/* Bottom CTA Button */}
      <div className="pt-3 pb-2 border-t border-zinc-800/80 space-y-2.5">
        <button
          id="btn-start-photobooth"
          onClick={onStart}
          className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-bold text-sm sm:text-base shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2.5 transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        >
          <Camera className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          <span>Mulai Photobooth</span>
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
        </button>

        {/* Legal Links for Flip / Payment Gateway Verification */}
        {onOpenLegal && (
          <div className="pt-2 border-t border-zinc-900 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 font-sans">
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
              onClick={() => onOpenLegal('contact')}
              className="hover:text-amber-400 hover:underline transition-colors cursor-pointer"
            >
              Hubungi Kami
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
