import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Save,
  HelpCircle,
  Zap,
  RotateCcw,
  Copy,
  Check,
  Phone,
  MessageSquare,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  FlipConfig,
  getFlipConfig,
  saveFlipConfig,
  DEFAULT_FLIP_CONFIG,
  testFlipCredentials,
} from '../services/flipService';
import { getAdminWhatsapp, saveAdminWhatsapp } from '../services/adminContactService';

export const AdminPaymentFlip: React.FC = () => {
  const [config, setConfig] = useState<FlipConfig>(getFlipConfig());
  const [adminWhatsapp, setAdminWhatsapp] = useState<string>(getAdminWhatsapp());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // States uji koneksi API Flip
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    valid: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    setConfig(getFlipConfig());
    setAdminWhatsapp(getAdminWhatsapp());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveFlipConfig(config);
    saveAdminWhatsapp(adminWhatsapp);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testFlipCredentials(config.secretKey, config.mode);
      setTestResult({
        tested: true,
        valid: res.valid,
        message: res.message,
      });
    } catch (err: any) {
      setTestResult({
        tested: true,
        valid: false,
        message: err.message || 'Gagal menghubungi server Flip',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const suggestedCallbackUrl = `${window.location.origin}/api/flip-callback`;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <CreditCard className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide">
              Integrasi Pembayaran: Flip for Business
            </h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Hubungkan QRIS, E-Wallet, dan Virtual Account otomatis menggunakan API Flip.
          </p>
        </div>

        <a
          href="https://business.flip.id"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-semibold border border-orange-500/30 transition-colors w-fit"
        >
          <span>Buka Dashboard Flip</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Mode Status Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          config.mode === 'test'
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full animate-pulse ${
              config.mode === 'test' ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
          />
          <div>
            <span className="font-bold text-sm text-white block">
              {config.mode === 'test'
                ? 'Mode Aktif: Sandbox (TEST Mode) Flip'
                : 'Mode Aktif: LIVE (Production) Flip'}
            </span>
            <span className="text-xs text-zinc-400">
              {config.mode === 'test'
                ? 'Gunakan Secret Key Test Mode untuk simulasi transaksi gratis tanpa uang asli.'
                : 'Transaksi akan memotong uang nyata pengunjung ke rekening Anda.'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setConfig((prev) => ({
              ...prev,
              mode: prev.mode === 'test' ? 'live' : 'test',
            }));
            setTestResult(null);
          }}
          className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-white text-xs font-medium transition-colors cursor-pointer"
        >
          Ganti ke Mode {config.mode === 'test' ? 'LIVE' : 'TEST (Sandbox)'}
        </button>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-[#0f111a] border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-orange-400" />
              Kredensial API Flip
            </h2>

            <button
              type="button"
              disabled={isTesting || !config.secretKey}
              onClick={handleTestConnection}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
                  <span>Menguji API...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
                  <span>Uji Validitas API Key</span>
                </>
              )}
            </button>
          </div>

          {/* Hasil Uji Koneksi */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
                testResult.valid
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {testResult.valid ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="space-y-1">
                <span className="font-bold block">
                  {testResult.valid ? 'API Key Valid!' : 'Perhatian Kredensial'}
                </span>
                <p className="leading-relaxed text-[11px] text-zinc-300">
                  {testResult.message}
                </p>
              </div>
            </div>
          )}

          {/* API Secret Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>API Secret Key ({config.mode === 'test' ? 'Test Mode' : 'Live'})</span>
              <span className="text-[11px] font-normal text-zinc-500">
                Didapat dari menu Developer &gt; Kelola API
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={config.secretKey}
                onChange={(e) => {
                  setConfig((prev) => ({ ...prev, secretKey: e.target.value.trim() }));
                  setTestResult(null);
                }}
                placeholder="Contoh: JDJ5JDEzJE..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-zinc-200 font-mono focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              Salin nilai dari kolom <strong>API SECRET KEY</strong> di dashboard Flip Anda.
            </p>
          </div>

          {/* Token Validasi */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Token Validasi (Webhook / Callback Token)</span>
              <span className="text-[11px] font-normal text-zinc-500">Opsional untuk verifikasi</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={config.validationToken}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    validationToken: e.target.value.trim(),
                  }))
                }
                placeholder="Contoh: $2y$13$bcLIH..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-zinc-200 font-mono focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              Salin nilai dari kolom <strong>TOKEN VALIDASI</strong> di dashboard Flip Anda.
            </p>
          </div>

          {/* Panduan URL Callback untuk Dashboard Flip */}
          <div className="pt-3 border-t border-zinc-800/80 space-y-2">
            <span className="text-xs font-semibold text-zinc-300 block">
              URL Callback untuk Dashboard Flip Anda (Menu Kelola API &gt; Callback):
            </span>
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 p-2.5 rounded-xl">
              <code className="text-xs font-mono text-orange-400 flex-1 break-all">
                {suggestedCallbackUrl}
              </code>
              <button
                type="button"
                onClick={() => handleCopy(suggestedCallbackUrl, 'callback')}
                className="p-1.5 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Salin URL Callback"
              >
                {copiedKey === 'callback' ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Masukkan URL di atas ke tombol <strong>Tambah URL</strong> pada bagian <em>Transaksi</em> di dashboard Flip Anda.
            </p>
          </div>
        </div>

        {/* WhatsApp Admin Setting Card */}
        <div className="bg-[#0f111a] border border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            Kontak Admin (Pembayaran Tunai / Cash)
          </h2>
          <p className="text-xs text-zinc-400">
            Nomor WhatsApp admin yang akan dihubungi oleh pengunjung ketika memilih metode <strong>Bayar Tunai</strong> di Step 9 Checkout.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Nomor WhatsApp Admin</span>
              <span className="text-[11px] font-normal text-zinc-500">
                Gunakan kode negara (misal: 628123456789)
              </span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Phone className="w-4 h-4 text-emerald-400" />
              </div>
              <input
                type="text"
                value={adminWhatsapp}
                onChange={(e) => setAdminWhatsapp(e.target.value)}
                placeholder="628xxxxxxxxxx"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-zinc-200 font-mono focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              Saat pengunjung memilih pembayaran tunai, foto otomatis tersimpan di Supabase dan pengunjung akan diarahkan ke WhatsApp dengan pesan: <em>"Halo admin, saya mau bayar untuk photobooth dengan id [ID_SESI]"</em>.
            </p>
          </div>
        </div>

        {/* Action Save Button */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setConfig(DEFAULT_FLIP_CONFIG)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>

          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-zinc-950 font-bold text-xs sm:text-sm shadow-lg shadow-orange-500/20 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Konfigurasi & Kontak Admin</span>
          </button>
        </div>

        {saveSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Pengaturan pembayaran Flip dan kontak WhatsApp Admin berhasil disimpan!
            </span>
          </div>
        )}
      </form>

      {/* Quick Testing Guide */}
      <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Cara Kerja Transaksi & Webhook Flip:
        </h3>
        <ol className="list-decimal list-inside space-y-2 text-xs text-zinc-400 leading-relaxed">
          <li>
            Pastikan mode diatur ke <strong className="text-zinc-200">Sandbox (TEST Mode)</strong> atau <strong className="text-zinc-200">Live</strong>, masukkan Secret Key Flip Anda di atas lalu klik tombol <strong>Uji Validitas API Key</strong> untuk memastikan kredensial aktif.
          </li>
          <li>
            Salin <strong>URL Callback</strong> di atas dan daftarkan ke dashboard Flip (menu <em>Kelola API &gt; Callback</em>).
          </li>
          <li>
            Ketika pembayaran pengunjung sukses di Flip, Flip mengirim webhook ke Supabase. Sesi pembayaran otomatis sukses secara instan dan langsung lanjut ke pencetakan foto fisik.
          </li>
        </ol>
      </div>
    </div>
  );
};
