import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  getAdminPassword,
  setAdminPassword,
  resetAdminPassword,
  isCustomAdminPassword,
  getDefaultAdminPassword,
} from '../services/adminAuthService';

export const AdminSetup: React.FC = () => {
  // State password saat ini (password lama yang sedang aktif)
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(true);
  const [copiedCurrent, setCopiedCurrent] = useState<boolean>(false);

  // Form password baru
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Feedback notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset confirmation modal
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);

  // Test password field
  const [testPasswordInput, setTestPasswordInput] = useState<string>('');
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);

  // Load current password on mount
  useEffect(() => {
    refreshPasswordState();
  }, []);

  const refreshPasswordState = () => {
    const pw = getAdminPassword();
    setCurrentPassword(pw);
    setIsCustom(isCustomAdminPassword());
  };

  const handleCopyCurrent = async () => {
    try {
      await navigator.clipboard.writeText(currentPassword);
      setCopiedCurrent(true);
      setTimeout(() => setCopiedCurrent(false), 2000);
    } catch (err) {
      console.warn('Gagal menyalin password:', err);
    }
  };

  const handleSaveNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedNew) {
      setErrorMsg('Password baru tidak boleh kosong!');
      return;
    }

    if (trimmedNew.length < 4) {
      setErrorMsg('Password baru minimal harus 4 karakter!');
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      setErrorMsg('Konfirmasi password tidak cocok dengan password baru!');
      return;
    }

    if (trimmedNew === currentPassword) {
      setErrorMsg('Password baru tidak boleh sama dengan password yang sedang aktif!');
      return;
    }

    const ok = setAdminPassword(trimmedNew);
    if (ok) {
      refreshPasswordState();
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg('Password admin berhasil diubah! Password baru sekarang langsung aktif.');
      setTestResult(null);
      setTestPasswordInput('');
      setTimeout(() => setSuccessMsg(null), 5000);
    } else {
      setErrorMsg('Terjadi kesalahan saat menyimpan password ke penyimpanan lokal.');
    }
  };

  const handleResetToDefault = () => {
    const ok = resetAdminPassword();
    if (ok) {
      refreshPasswordState();
      setShowResetConfirmModal(false);
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg(`Password admin berhasil dikembalikan ke default bawaan sistem (${getDefaultAdminPassword()}).`);
      setTestResult(null);
      setTestPasswordInput('');
      setTimeout(() => setSuccessMsg(null), 5000);
    } else {
      setErrorMsg('Gagal mengembalikan password ke default.');
    }
  };

  const handleTestPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPasswordInput) {
      setTestResult(null);
      return;
    }
    if (testPasswordInput === currentPassword) {
      setTestResult('success');
    } else {
      setTestResult('fail');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <KeyRound className="w-4 h-4" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Setup & Keamanan Admin
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-zinc-400">
          Kelola password otentikasi untuk membuka dan mengelola Portal Admin Photobooth.
        </p>
      </div>

      {/* Success Notice Banner */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-center gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <p className="flex-1 font-medium">{successMsg}</p>
        </div>
      )}

      {/* Error Notice Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center gap-3 animate-in fade-in duration-200">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <p className="flex-1 font-medium">{errorMsg}</p>
        </div>
      )}

      {/* GRID CONTAINER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: Password Lama / Saat Ini yang Dipakai */}
        <div className="bg-[#0e1118] border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold text-sm">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Password Lama (Sedang Dipakai)</span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                  isCustom
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
              >
                {isCustom ? 'Password Kustom' : 'Default Sistem'}
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Berikut adalah kata sandi yang saat ini berlaku untuk mengakses login portal admin di{' '}
              <code className="text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded text-[11px]">/admin</code>:
            </p>

            {/* Display Box Password Lama */}
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
              <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">
                Kata Sandi Aktif
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-base sm:text-lg font-bold text-amber-400 tracking-wider select-all overflow-x-auto py-1">
                  {showCurrentPassword ? currentPassword : '••••••••••••'}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                    title={showCurrentPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyCurrent}
                    className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 border border-zinc-800 transition-colors"
                    title="Salin password ke clipboard"
                  >
                    {copiedCurrent ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] text-zinc-400">
              <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
              <span>
                Simpan atau catat password ini agar Anda tidak terkunci dari dashboard admin saat sesi browser ditutup.
              </span>
            </div>
          </div>

          {/* Reset to Default Button */}
          {isCustom && (
            <div className="pt-3 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kembalikan ke Password Default ({getDefaultAdminPassword()})</span>
              </button>
            </div>
          )}
        </div>

        {/* CARD 2: Form Ubah Password Admin */}
        <div className="bg-[#0e1118] border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-zinc-300 font-semibold text-sm">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Ubah Password Admin</span>
          </div>

          <p className="text-xs text-zinc-400">
            Masukkan kata sandi baru untuk menggantikan password lama di sebelah kiri.
          </p>

          <form onSubmit={handleSaveNewPassword} className="space-y-4">
            {/* Input Password Baru */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Password Baru <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Ketik password baru (min. 4 karakter)..."
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-zinc-950/80 border border-zinc-800 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Input Konfirmasi Password Baru */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Ulangi Password Baru <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Ketik ulang password baru..."
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-zinc-950/80 border border-zinc-800 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password match feedback indicator */}
            {newPassword.length > 0 && confirmPassword.length > 0 && (
              <div className="text-[11px] flex items-center gap-1.5 font-medium">
                {newPassword === confirmPassword ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Konfirmasi password cocok
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Konfirmasi password belum cocok
                  </span>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Simpan Password Baru</span>
            </button>
          </form>
        </div>
      </div>

      {/* CARD 3: Penguji & Panduan Otentikasi */}
      <div className="bg-[#0e1118] border border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-zinc-300 font-semibold text-sm">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Uji Coba Password Login</span>
        </div>
        <p className="text-xs text-zinc-400">
          Anda dapat mengetes password yang sedang aktif langsung di sini sebelum keluar dari dashboard admin:
        </p>

        <form onSubmit={handleTestPassword} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={testPasswordInput}
            onChange={(e) => {
              setTestPasswordInput(e.target.value);
              setTestResult(null);
            }}
            placeholder="Masukkan password untuk diuji..."
            className="w-full sm:flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs sm:text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
          />
          <button
            type="submit"
            className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold shrink-0 transition-colors cursor-pointer"
          >
            Tes Password
          </button>
        </form>

        {testResult === 'success' && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Password cocok! Anda dapat menggunakan kata sandi ini untuk login di halaman gerbang admin.</span>
          </div>
        )}

        {testResult === 'fail' && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Password tidak cocok dengan password yang sedang aktif. Silakan periksa kembali kata sandi di atas.</span>
          </div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset ke Password Default?</h3>
                <p className="text-xs text-zinc-400">Password kustom akan dihapus dari penyimpanan</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              Kata sandi admin akan dikembalikan ke nilai bawaan pabrik:{' '}
              <code className="text-amber-400 font-bold font-mono">{getDefaultAdminPassword()}</code>.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-lg shadow-rose-600/30"
              >
                Ya, Reset Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
