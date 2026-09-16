/**
 * Service untuk mengelola autentikasi dan password admin photobooth.
 * Mendukung penyimpanan password kustom ke localStorage dengan fallback ke env / default.
 */

const STORAGE_KEY = 'photobooth_admin_password';
const DEFAULT_PASSWORD = 'admin123';

/**
 * Dapatkan password admin default dari environment variable atau fallback bawaan
 */
export function getDefaultAdminPassword(): string {
  const env = (import.meta as any).env || {};
  return env.VITE_ADMIN_PASSWORD || env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

/**
 * Mengambil password admin yang sedang aktif
 */
export function getAdminPassword(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim().length > 0) {
      return saved.trim();
    }
  } catch (e) {
    console.warn('Gagal membaca password dari localStorage:', e);
  }
  return getDefaultAdminPassword();
}

/**
 * Menyimpan password admin baru
 */
export function setAdminPassword(newPassword: string): boolean {
  try {
    const trimmed = newPassword.trim();
    if (!trimmed) return false;
    localStorage.setItem(STORAGE_KEY, trimmed);
    return true;
  } catch (e) {
    console.error('Gagal menyimpan password ke localStorage:', e);
    return false;
  }
}

/**
 * Mereset password admin kembali ke bawaan sistem
 */
export function resetAdminPassword(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (e) {
    console.error('Gagal mereset password di localStorage:', e);
    return false;
  }
}

/**
 * Mengecek apakah password saat ini adalah hasil kustom atau bawaan sistem
 */
export function isCustomAdminPassword(): boolean {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return !!(saved && saved.trim().length > 0);
  } catch (e) {
    return false;
  }
}
