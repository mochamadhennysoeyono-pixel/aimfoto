import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
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

  // Brute-force protection: kunci 30 detik setelah 5 kali gagal
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Rahasia: 5 klik pada icon gembok untuk membuka opsi darurat (hanya diketahui pemilik)
  const [lockClickCount, setLockClickCount] = useState(0);
  const [showSecretReset, setShowSecretReset] = useState(false);
  const lockClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Prefetch password dari Supabase saat gerbang admin dimuat
  useEffect(() => {
    fetchAdminPasswordFromCloud().catch(() => {});
  }, []);

  // Timer countdown jika terkena lockout
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleSecretLockClick = () => {
    const next = lockClickCount + 1;
    setLockClickCount(next);

    if (lockClickTimeoutRef.current) clearTimeout(lockClickTimeoutRef.current);
    lockClickTimeoutRef.current = setTimeout(() => {
      setLockClickCount(0);
    }, 2000);

    if (next >= 5) {
      setLockClickCount(0);
      setShowSecretReset(true);
    }
  };

  const handleVerify = async (candidate: string) => {
    if (lockoutSeconds > 0) return;

    const trimmed = candidate.trim();
    if (!trimmed) {
      setErrorMsg('Silakan masukkan password admin.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    // Cek synchronous cepat
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
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        if (nextFailed >= 5) {
          setLockoutSeconds(30);
          setErrorMsg('Terlalu banyak percobaan gagal. Akses diblokir selama 30 detik.');
        } else {
          setErrorMsg('Password salah. Silakan coba lagi.');
        }
      }
    } catch (_) {
      if (trimmed === DEFAULT_PASSWORD) {
        sessionStorage.setItem('admin_authenticated', 'true');
        onAuthenticated();
      } else {
        setErrorMsg('Password salah. Silakan coba lagi.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify(passwordInput);
  };

  const handleSecretResetAction = async () => {
    setIsVerifying(true);
    setErrorMsg(null);
    await resetAdminPassword();
    setIsVerifying(false);
    setShowSecretReset(false);
    setFailedAttempts(0);
    setLockoutSeconds(0);
    setSuccessMsg('Password admin berhasil direset ke bawaan pabrik.');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-zinc-100 flex flex-col items-center justify-center p-4 selection:bg-amber-500 selection:text-zinc-950 font-sans">
      <div className="w-full max-w-md bg-[#0e1118] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl relative">
        {/* Header Icon (Secret gesture 5x klik untuk reset darurat jika pemilik lupa) */}
        <div className="flex flex-col items-center text-center mb-6">
          <button
            type="button"
            onClick={handleSecretLockClick}
            className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3 shadow-inner cursor-default select-none focus:outline-none"
            title="Admin Portal"
          >
            <Lock className="w-7 h-7" />
          </button>
          <h1 className="text-xl font-bold text-white tracking-tight">Portal Admin Photobooth</h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
            Hanya untuk staf pengelola kiosk.
          </p>
        </div>

        {/* Notifikasi info / sukses */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Opsi Darurat Tersembunyi (Hanya muncul jika logo gembok diklik 5x berturut-turut) */}
        {showSecretReset && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-amber-400 font-semibold">
              <span>Mode Pemulihan Darurat</span>
              <button
                type="button"
                onClick={() => setShowSecretReset(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Jika Anda lupa password, klik tombol di bawah untuk mengembalikan password ke nilai bawaan pabrik.
            </p>
            <button
              type="button"
              onClick={handleSecretResetAction}
              className="w-full py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Password Sekarang</span>
            </button>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Password Admin</span>
            </label>

            <div className="relative">
              <input
                id="admin-password-input"
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Masukkan kata sandi..."
                autoFocus
                disabled={isVerifying || lockoutSeconds > 0}
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
                <p className="leading-relaxed flex-1">{errorMsg}</p>
              </div>
            )}
          </div>

          <button
            id="btn-admin-login"
            type="submit"
            disabled={isVerifying || lockoutSeconds > 0}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                <span>Memverifikasi...</span>
              </>
            ) : lockoutSeconds > 0 ? (
              <span>Tunggu {lockoutSeconds} detik...</span>
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
