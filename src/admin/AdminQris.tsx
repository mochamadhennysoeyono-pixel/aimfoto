import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Store,
  FileImage,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchStaticQrisConfig,
  saveStaticQrisConfig,
  uploadQrisImageFile,
  downloadQrisImage,
  normalizeQrisUrl,
  StaticQrisConfig,
} from '../services/qrisService';

export const AdminQris: React.FC = () => {
  const [config, setConfig] = useState<StaticQrisConfig>({
    url: null,
    merchantName: 'AIM SPACE PHOTOBOOTH',
    notes: 'Mendukung BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, ShopeePay, LinkAja',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasImgError, setHasImgError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchStaticQrisConfig();
      setConfig({
        url: data.url || null,
        merchantName: data.merchantName || 'AIM SPACE PHOTOBOOTH',
        notes: data.notes || '',
      });
    } catch (err: any) {
      setErrorMsg('Gagal memuat konfigurasi QRIS');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg(null);
    setHasImgError(false);

    const res = await uploadQrisImageFile(file);
    setIsUploading(false);

    if (res.success && res.url) {
      const normalized = normalizeQrisUrl(res.url) || res.url;
      setConfig((prev) => ({
        ...prev,
        url: normalized,
      }));
    } else {
      setErrorMsg(res.error || 'Gagal mengunggah gambar QRIS');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await saveStaticQrisConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg('Gagal menyimpan konfigurasi QRIS');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveImage = () => {
    if (confirm('Hapus gambar QRIS ini? Pelanggan akan melihat QRIS default.')) {
      setHasImgError(false);
      setConfig((prev) => ({
        ...prev,
        url: null,
      }));
    }
  };

  const handleTestDownload = async () => {
    await downloadQrisImage(config.url, config.merchantName);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        <span className="text-xs">Memuat data QRIS statis...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-16 animate-in fade-in duration-200">
      {/* Header Halaman */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#11141c] border border-zinc-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
            <QrCode className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Upload QRIS Statis
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                Online &amp; Kiosk
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Upload barcode QRIS resmi usaha Anda agar pelanggan dapat scan dan mengunduhnya langsung.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTestDownload}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer transition-colors shadow-sm"
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>Test Download QRIS</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Pengaturan QRIS Statis berhasil disimpan dan disinkronkan ke seluruh aplikasi!</span>
        </div>
      )}

      {/* Main Grid: Upload & Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kolom Kiri: Upload Gambar QRIS & Pratinjau */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#11141c] border border-zinc-800 space-y-4 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileImage className="w-4 h-4 text-amber-400" />
              <span>Gambar Barcode QRIS</span>
            </span>
            {config.url && (
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Terpasang</span>
              </span>
            )}
          </div>

          {/* Area Preview atau Upload Box */}
          {config.url ? (
            <div className="flex flex-col items-center justify-center p-4 bg-zinc-950/80 rounded-2xl border border-zinc-800/80 space-y-3">
              <div className="p-3 bg-white rounded-2xl shadow-xl border border-zinc-300 w-56 h-56 max-w-[240px] flex items-center justify-center relative overflow-hidden">
                {hasImgError ? (
                  <div className="text-center p-3 text-zinc-600 flex flex-col items-center gap-1.5">
                    <AlertCircle className="w-8 h-8 text-rose-500" />
                    <span className="text-[11px] font-semibold text-zinc-700">Gambar Tidak Terbaca</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1 px-2.5 py-1 text-[10px] font-bold bg-amber-500 text-black rounded-lg"
                    >
                      Upload Ulang
                    </button>
                  </div>
                ) : (
                  <img
                    src={config.url}
                    alt="QRIS Statis"
                    className="w-full h-full object-contain rounded-lg"
                    onError={() => setHasImgError(true)}
                  />
                )}
              </div>

              <div className="flex items-center gap-2 w-full pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isUploading ? 'animate-spin' : ''}`} />
                  <span>Ganti Gambar</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 cursor-pointer transition-colors"
                  title="Hapus gambar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 hover:border-amber-400/60 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-zinc-950/40 hover:bg-zinc-900/40 group min-h-[240px]"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                {isUploading ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <Upload className="w-7 h-7 stroke-[2.2]" />
                )}
              </div>
              <span className="text-xs sm:text-sm font-bold text-zinc-200 group-hover:text-amber-400 transition-colors">
                {isUploading ? 'Sedang Mengunggah...' : 'Klik atau Tarik Gambar QRIS ke Sini'}
              </span>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-xs">
                Mendukung file PNG, JPG, JPEG, atau WebP dari aplikasi BCA Merchant, GoPay, OVO, Dana, dll.
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Kolom Kanan: Detail Informasi Merchant & Simpan */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#11141c] border border-zinc-800 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="pb-2 border-b border-zinc-800/80">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-4 h-4 text-amber-400" />
                <span>Identitas Toko &amp; Merchant</span>
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                Nama Merchant / Usaha Photobooth
              </label>
              <input
                type="text"
                value={config.merchantName || ''}
                onChange={(e) => setConfig({ ...config, merchantName: e.target.value })}
                placeholder="Contoh: AIM SPACE PHOTOBOOTH"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs font-semibold focus:outline-none focus:border-amber-400 transition-colors"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Nama ini akan dicetak di bagian atas kartu QRIS saat pelanggan mengunduh file gambar.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                Catatan / Bank &amp; E-Wallet yang Didukung
              </label>
              <textarea
                rows={3}
                value={config.notes || ''}
                onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                placeholder="Contoh: BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, ShopeePay, LinkAja"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-amber-400 transition-colors resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[11px] text-zinc-400 space-y-1.5">
              <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Keuntungan QRIS Statis:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-zinc-400 text-[10.5px]">
                <li>Tidak ada masa kedaluwarsa waktu (tidak hangus).</li>
                <li>Pelanggan dapat langsung transfer nominal tagihan sesi foto.</li>
                <li>Pelanggan di halaman depan dan halaman pembayaran dapat mengunduh gambar ke galeri HP.</li>
              </ul>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isUploading}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Pengaturan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan QRIS Statis</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
