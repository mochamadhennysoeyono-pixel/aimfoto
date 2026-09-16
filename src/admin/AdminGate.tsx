import React, { useState, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  verifyAdminPassword,
  verifyAdminPasswordSync,
  fetchAdminPasswordFromCloud,
  resetAdminPassword,
  DEFAULT_PASSWORD,
} from '../services/adminAuthService';

interface AdminGateProps {
  onAuthenticated: () => void;
  onBackToKiosk: () => void;
}

export const AdminGate: React.FC<AdminGateProps> = ({ onAuthenticated, onBackToKiosk }) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Prefetch password dari Supabase saat komponen dimuat
  useEffect(() => {
    fetchAdminPasswordFromCloud().catch(() => {});
  }, []);

  const handleVerify = async (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed) {
      setErrorMsg('Silakan masukkan password admin terlebih dahulu.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    // Cek synchronous cepat dulu (jika cocok dengan admin123 atau cache)
    if (verifyAdminPasswordSync(trimmed)) {
      sessionStorage.setItem('admin_authenticated', 'true');
      setIsVerifying(false);
      onAuthenticated();
      return;
    }

    // Cek asynchronous ke Cloud Supabase
    try {
      const isValid = await verifyAdminPassword(trimmed);
      if (isValid) {
        sessionStorage.setItem('admin_authenticated', 'true');
        onAuthenticated();
      } else {
        setErrorMsg(
          `Password salah. Gunakan password bawaan "${DEFAULT_PASSWORD}" atau password kustom yang pernah Anda simpan.`
        );
      }
    } catch (err: any) {
      // Fallback
      if (trimmed === DEFAULT_PASSWORD) {
        sessionStorage.setItem('admin_authenticated', 'true');
        onAuthenticated();
      } else {
        setErrorMsg('Gagal memverifikasi password. Coba gunakan: ' + DEFAULT_PASSWORD);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify(passwordInput);
  };

  const handleUseDefaultPassword = () => {
    setPasswordInput(DEFAULT_PASSWORD);
    setErrorMsg(null);
    handleVerify(DEFAULT_PASSWORD);
  };

  const handleResetPassword = async () => {
    setIsVerifying(true);
    setErrorMsg(null);
    await resetAdminPassword();
    setPasswordInput(DEFAULT_PASSWORD);
    setIsVerifying(false);
    setSuccessMsg(`Password berhasil dikembalikan ke bawaan: ${DEFAULT_PASSWORD}`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-zinc-100 flex flex-col items-center justify-center p-4 selection:bg-amber-500 selection:text-zinc-950 font-sans">
      <div className="w-full max-w-md bg-[#0e1118] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl relative">
        {/* Header Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Portal Admin Photobooth</h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
            Akses khusus pengelola kiosk. Masukkan password admin untuk mengelola event, frame layout, dan transaksi.
          </p>
        </div>

        {/* Notifikasi info / sukses */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Password Admin</span>
              </label>

              <button
                type="button"
                onClick={handleUseDefaultPassword}
                className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                title="Isi otomatis dengan password bawaan"
              >
                <Sparkles className="w-3 h-3" />
                <span>Gunakan bawaan ({DEFAULT_PASSWORD})</span>
              </button>
            </div>

            <div className="relative">
              <input
                id="admin-password-input"
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Ketik password admin..."
                autoFocus
                disabled={isVerifying}
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-zinc-950/80 border border-zinc-800 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {errorMsg && (
              <div className="mt-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <p className="leading-relaxed">{errorMsg}</p>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset kata sandi ke bawaan ({DEFAULT_PASSWORD})</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Info Bawaan */}
          <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
              <span>Password Default Bawaan:</span>
            </span>
            <code className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-amber-400 font-mono font-bold">
              {DEFAULT_PASSWORD}
            </code>
          </div>

          <button
            id="btn-admin-login"
            type="submit"
            disabled={isVerifying}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Masuk ke Dashboard</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
          <button
            onClick={onBackToKiosk}
            className="flex items-center gap-1 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Kiosk Tamu</span>
          </button>
          <span className="text-[11px] font-mono text-zinc-600">v1.0 Admin</span>
        </div>
      </div>
    </div>
  );
};
