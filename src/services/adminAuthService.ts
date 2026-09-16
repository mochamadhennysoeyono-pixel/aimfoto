/**
 * Service untuk mengelola autentikasi dan password admin photobooth.
 * Menggunakan localStorage dengan fallback ke env variable dan default master password ('admin123').
 */

export const STORAGE_KEY = 'photobooth_admin_password';
export const DEFAULT_PASSWORD = 'admin123';

/**
 * Dapatkan password admin default dari environment variable atau fallback bawaan ('admin123')
 */
export function getDefaultAdminPassword(): string {
  const env = (import.meta as any).env || {};
  return env.VITE_ADMIN_PASSWORD || env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

/**
 * Mengambil password admin yang tersimpan di localStorage browser
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
 * Menyimpan password admin baru ke LocalStorage
 */
export async function setAdminPassword(newPassword: string): Promise<boolean> {
  try {
    const trimmed = newPassword.trim();
    if (!trimmed) return false;
    localStorage.setItem(STORAGE_KEY, trimmed);
    return true;
  } catch (e) {
    console.error('Gagal menyimpan password:', e);
    return false;
  }
}

/**
 * Mereset password admin kembali ke bawaan sistem (admin123)
 */
export async function resetAdminPassword(): Promise<boolean> {
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
    return !!(saved && saved.trim().length > 0 && saved.trim() !== DEFAULT_PASSWORD);
  } catch (e) {
    return false;
  }
}

/**
 * Verifikasi apakah input password benar.
 * Menguji terhadap:
 * 1. Password bawaan default 'admin123' (selalu valid sebagai master recovery)
 * 2. Password dari environment variable
 * 3. Password yang disimpan di localStorage
 */
export async function verifyAdminPassword(input: string): Promise<boolean> {
  return verifyAdminPasswordSync(input);
}

/**
 * Verifikasi synchronous instan
 */
export function verifyAdminPasswordSync(input: string): boolean {
  const cleanInput = input.trim();
  if (!cleanInput) return false;
  if (cleanInput === DEFAULT_PASSWORD) return true;
  if (cleanInput === getDefaultAdminPassword()) return true;
  if (cleanInput === getAdminPassword()) return true;
  return false;
}
