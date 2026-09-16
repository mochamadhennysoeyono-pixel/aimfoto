/**
 * Service untuk mengelola autentikasi dan password admin photobooth.
 * Mendukung penyimpanan password kustom ke localStorage dan sinkronisasi Cloud (Supabase)
 * sehingga password tetap sinkron di versi Preview, Development, maupun Published/Production.
 */

import { supabase } from '../supabaseClient';

export const STORAGE_KEY = 'photobooth_admin_password';
export const DEFAULT_PASSWORD = 'admin123';
export const CONFIG_RECORD_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Dapatkan password admin default dari environment variable atau fallback bawaan
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
 * Mengambil password admin yang tersimpan di Cloud (Supabase)
 */
export async function fetchAdminPasswordFromCloud(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('qr_code')
      .eq('id', CONFIG_RECORD_ID)
      .maybeSingle();

    if (error || !data) return null;

    const qr = data.qr_code || '';
    if (qr.startsWith('__P_')) {
      const encoded = qr.slice(4);
      try {
        const decoded = atob(encoded);
        if (decoded && decoded.trim().length > 0) {
          // Cache ke localStorage jika lokal belum punya
          try {
            localStorage.setItem(STORAGE_KEY, decoded.trim());
          } catch (_) {}
          return decoded.trim();
        }
      } catch (_) {
        return null;
      }
    }
  } catch (e) {
    console.warn('Gagal membaca password dari Supabase:', e);
  }
  return null;
}

/**
 * Menyimpan password admin baru (ke LocalStorage dan Cloud Supabase)
 */
export async function setAdminPassword(
  newPassword: string,
  syncToCloud = true
): Promise<boolean> {
  try {
    const trimmed = newPassword.trim();
    if (!trimmed) return false;

    // 1. Simpan ke LocalStorage browser saat ini
    localStorage.setItem(STORAGE_KEY, trimmed);

    // 2. Sinkronkan ke Supabase agar versi Publish / perangkat lain langsung mengenali
    if (syncToCloud) {
      const encoded = btoa(trimmed);
      Promise.resolve(
        supabase.from('events').upsert(
          [
            {
              id: CONFIG_RECORD_ID,
              name: 'ADMIN_CONFIG',
              qr_code: `__P_${encoded}`,
              default_price: 0,
              is_active: false,
            },
          ],
          { onConflict: 'id' }
        )
      )
        .then(({ error }: any) => {
          if (error) {
            console.warn('Catatan: Sinkronisasi password ke Supabase:', error.message);
          }
        })
        .catch(() => {});
    }

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
    // 1. Hapus dari LocalStorage
    localStorage.removeItem(STORAGE_KEY);

    // 2. Hapus / reset dari Supabase
    Promise.resolve(supabase.from('events').delete().eq('id', CONFIG_RECORD_ID))
      .then(() => {})
      .catch(() => {});

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
 * 4. Password yang disinkronkan di Cloud Supabase
 */
export async function verifyAdminPassword(input: string): Promise<boolean> {
  const cleanInput = input.trim();
  if (!cleanInput) return false;

  // 1. Master Fallback: 'admin123' selalu diterima agar admin tidak terkunci
  if (cleanInput === DEFAULT_PASSWORD) return true;

  // 2. Default dari env
  const defaultEnv = getDefaultAdminPassword();
  if (cleanInput === defaultEnv) return true;

  // 3. Password aktif di localStorage
  const localPw = getAdminPassword();
  if (cleanInput === localPw) return true;

  // 4. Periksa apakah ada password kustom di Cloud Supabase (untuk versi publish antar perangkat)
  try {
    const cloudPw = await fetchAdminPasswordFromCloud();
    if (cloudPw && cleanInput === cloudPw) {
      return true;
    }
  } catch (_) {}

  return false;
}

/**
 * Verifikasi synchronous instan (tanpa menunggu koneksi jaringan)
 */
export function verifyAdminPasswordSync(input: string): boolean {
  const cleanInput = input.trim();
  if (!cleanInput) return false;
  if (cleanInput === DEFAULT_PASSWORD) return true;
  if (cleanInput === getDefaultAdminPassword()) return true;
  if (cleanInput === getAdminPassword()) return true;
  return false;
}
