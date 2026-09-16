/**
 * Service untuk mengelola autentikasi dan password admin photobooth.
 * Mendukung sinkronisasi Cloud Supabase agar password tersimpan dan dapat dipakai
 * di versi publish, device lain, maupun dev preview tanpa kendala.
 */

import { supabase } from '../supabaseClient.js';

export const STORAGE_KEY = 'photobooth_admin_password';
export const DEFAULT_PASSWORD = 'admin123';

// Daftar master password darurat yang selalu diizinkan sebagai recovery
export const MASTER_PASSWORDS = [
  'admin123',
  'admin',
  'aimspace',
  'AIMSPACE',
  'aim-space',
  '123456',
];

// ID khusus di Supabase untuk menyimpan konfigurasi sistem tanpa mengganggu tabel events
const SYSTEM_CONFIG_ROW_ID = '00000000-0000-0000-0000-000000000001';
const PW_PREFIX = '__admin_pw:';

// Cache in-memory
let cachedCloudPassword: string | null = null;

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (_) {}
  return null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch (_) {}
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch (_) {}
}

/**
 * Mengambil password admin default dari environment variable atau bawaan sistem
 */
export function getDefaultAdminPassword(): string {
  const env = (import.meta as any).env || {};
  return env.VITE_ADMIN_PASSWORD || env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

/**
 * Mengambil password admin yang tersimpan di localStorage browser
 */
export function getAdminPassword(): string {
  const saved = safeGetItem(STORAGE_KEY);
  if (saved && saved.trim().length > 0) {
    return saved.trim();
  }

  if (cachedCloudPassword && cachedCloudPassword.trim().length > 0) {
    return cachedCloudPassword.trim();
  }

  return getDefaultAdminPassword();
}

/**
 * Mengambil password admin dari Cloud Supabase (agar sinkron antara dev dan publish)
 */
export async function fetchAdminPasswordFromCloud(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('qr_code')
      .eq('id', SYSTEM_CONFIG_ROW_ID)
      .maybeSingle();

    if (!error && data && data.qr_code && data.qr_code.startsWith(PW_PREFIX)) {
      const extracted = decodeURIComponent(data.qr_code.replace(PW_PREFIX, '')).trim();
      if (extracted) {
        cachedCloudPassword = extracted;
        safeSetItem(STORAGE_KEY, extracted);
        return extracted;
      }
    }
  } catch (err) {
    console.warn('Gagal mengambil password dari Supabase cloud:', err);
  }
  return null;
}

// Inisialisasi pengambilan password cloud di latar belakang saat aplikasi dimuat
fetchAdminPasswordFromCloud().catch(() => {});

/**
 * Menyimpan password admin baru ke LocalStorage dan menyinkronkan ke Cloud Supabase
 */
export async function setAdminPassword(newPassword: string): Promise<boolean> {
  try {
    const trimmed = newPassword.trim();
    if (!trimmed) return false;

    // 1. Simpan ke localStorage lokal
    safeSetItem(STORAGE_KEY, trimmed);
    cachedCloudPassword = trimmed;

    // 2. Simpan ke Cloud Supabase agar berlaku juga di versi publish / semua kiosk
    try {
      await supabase.from('events').upsert({
        id: SYSTEM_CONFIG_ROW_ID,
        name: '__SYSTEM_CONFIG__',
        qr_code: PW_PREFIX + encodeURIComponent(trimmed),
        default_price: 0,
        is_active: false,
      });
    } catch (cloudErr) {
      console.warn('Peringatan: Gagal sinkronisasi password ke Supabase:', cloudErr);
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
    safeRemoveItem(STORAGE_KEY);
    cachedCloudPassword = null;

    try {
      await supabase.from('events').upsert({
        id: SYSTEM_CONFIG_ROW_ID,
        name: '__SYSTEM_CONFIG__',
        qr_code: PW_PREFIX + encodeURIComponent(DEFAULT_PASSWORD),
        default_price: 0,
        is_active: false,
      });
    } catch (cloudErr) {
      console.warn('Gagal reset password di Supabase:', cloudErr);
    }

    return true;
  } catch (e) {
    console.error('Gagal mereset password:', e);
    return false;
  }
}

/**
 * Mengecek apakah password saat ini adalah hasil kustom atau bawaan sistem
 */
export function isCustomAdminPassword(): boolean {
  try {
    const current = getAdminPassword();
    return (
      current !== DEFAULT_PASSWORD &&
      !MASTER_PASSWORDS.includes(current) &&
      current !== getDefaultAdminPassword()
    );
  } catch (e) {
    return false;
  }
}

/**
 * Verifikasi synchronous cepat
 */
export function verifyAdminPasswordSync(input: string): boolean {
  const cleanInput = input.trim();
  if (!cleanInput) return false;

  // 1. Selalu izinkan master recovery passwords
  if (MASTER_PASSWORDS.includes(cleanInput)) return true;
  if (cleanInput === getDefaultAdminPassword()) return true;

  // 2. Cek password aktif di localStorage / memory
  const localPw = getAdminPassword();
  if (localPw && cleanInput === localPw) return true;

  // 3. Cek cache password cloud
  if (cachedCloudPassword && cleanInput === cachedCloudPassword.trim()) return true;

  return false;
}

/**
 * Verifikasi apakah input password benar (cek synchronous lalu cek ke Cloud Supabase)
 */
export async function verifyAdminPassword(input: string): Promise<boolean> {
  const cleanInput = input.trim();
  if (!cleanInput) return false;

  // Cek lokal & master instan
  if (verifyAdminPasswordSync(cleanInput)) return true;

  // Cek langsung ke Cloud Supabase (misalnya password diubah dari device/tab lain)
  try {
    const cloudPw = await fetchAdminPasswordFromCloud();
    if (cloudPw && cleanInput === cloudPw.trim()) {
      return true;
    }
  } catch (err) {
    console.warn('Verifikasi online gagal, lanjut fallback lokal:', err);
  }

  return false;
}
