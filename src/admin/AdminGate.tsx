import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { getAdminPassword } from '../services/adminAuthService';

interface AdminGateProps {
  onAuthenticated: () => void;
  onBackToKiosk: () => void;
}

export const AdminGate: React.FC<AdminGateProps> = ({ onAuthenticated, onBackToKiosk }) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const expectedPassword = getAdminPassword();

    if (passwordInput.trim() === expectedPassword) {
      sessionStorage.setItem('admin_authenticated', 'true');
      setErrorMsg(null);
      onAuthenticated();
    } else {
      setErrorMsg('Password salah. Silakan coba lagi.');
    }
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
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            Akses khusus pengelola kiosk. Masukkan password admin untuk mengelola event, frame, dan transaksi.
          </p>
        </div>

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
                placeholder="Ketik password admin..."
                autoFocus
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-zinc-950/80 border border-zinc-800 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errorMsg && (
              <p className="text-xs text-rose-400 mt-1.5 font-medium">{errorMsg}</p>
            )}
          </div>

          <button
            id="btn-admin-login"
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Masuk ke Dashboard</span>
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
