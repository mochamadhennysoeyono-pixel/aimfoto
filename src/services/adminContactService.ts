import { supabase } from '../supabaseClient';

/**
 * Service untuk mengelola Nomor WhatsApp Admin dan pengaturan kontak
 * Tersimpan permanen di Cloudflare D1 / Supabase sehingga tersinkronisasi di semua perangkat (HP A, HP B, dll.)
 */

export const ADMIN_WHATSAPP_ROW_ID = '00000000-0000-0000-0000-000000000007';
export const ADMIN_WHATSAPP_ROW_NAME = '__ADMIN_WHATSAPP_CONFIG__';
const ADMIN_WHATSAPP_KEY = 'photobooth_admin_whatsapp';
export const DEFAULT_ADMIN_WHATSAPP = '6282228031995'; // Nomor default aktual admin

let cachedAdminWhatsapp: string | null = null;

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

/**
 * Normalisasi nomor WhatsApp menjadi format internasional standar (cth: 6282228031995)
 */
export function normalizeWhatsappNumber(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  return clean || DEFAULT_ADMIN_WHATSAPP;
}

/**
 * Mengambil Nomor WhatsApp Admin secara sinkron dari cache lokal / in-memory.
 */
export function getAdminWhatsapp(): string {
  if (cachedAdminWhatsapp && cachedAdminWhatsapp.trim()) {
    return cachedAdminWhatsapp.trim();
  }
  const val = safeGetItem(ADMIN_WHATSAPP_KEY);
  if (val && val.trim()) {
    cachedAdminWhatsapp = val.trim();
    return cachedAdminWhatsapp;
  }
  return DEFAULT_ADMIN_WHATSAPP;
}

/**
 * Mengambil Nomor WhatsApp Admin dari Cloudflare D1 / Supabase Database
 * dan memperbarui cache in-memory serta localStorage perangkat.
 */
export async function fetchAdminWhatsapp(): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('qr_code')
      .eq('id', ADMIN_WHATSAPP_ROW_ID)
      .maybeSingle();

    if (!error && data && data.qr_code) {
      try {
        const parsed = JSON.parse(data.qr_code);
        if (parsed && parsed.phone) {
          const clean = normalizeWhatsappNumber(parsed.phone);
          cachedAdminWhatsapp = clean;
          safeSetItem(ADMIN_WHATSAPP_KEY, clean);
          return clean;
        }
      } catch (_) {
        // Jika raw string
        const clean = normalizeWhatsappNumber(data.qr_code);
        cachedAdminWhatsapp = clean;
        safeSetItem(ADMIN_WHATSAPP_KEY, clean);
        return clean;
      }
    }
  } catch (err) {
    console.warn('Gagal memuat Nomor WhatsApp Admin dari Cloud Database:', err);
  }

  return getAdminWhatsapp();
}

/**
 * Menyimpan Nomor WhatsApp Admin ke Cloudflare D1 / Supabase Database
 * sekaligus memperbarui cache lokal di browser.
 */
export async function saveAdminWhatsapp(phone: string): Promise<string> {
  const clean = normalizeWhatsappNumber(phone);

  // Update in-memory & localStorage
  cachedAdminWhatsapp = clean;
  safeSetItem(ADMIN_WHATSAPP_KEY, clean);

  // Simpan ke database cloud
  try {
    const payload = {
      id: ADMIN_WHATSAPP_ROW_ID,
      name: ADMIN_WHATSAPP_ROW_NAME,
      is_active: false,
      price: 0,
      default_price: 0,
      qr_code: JSON.stringify({
        phone: clean,
        updatedAt: new Date().toISOString(),
      }),
    };

    await supabase.from('events').upsert(payload, { onConflict: 'id' });
    console.log('Berhasil menyimpan Nomor WhatsApp Admin ke Cloud Database:', clean);
  } catch (err) {
    console.warn('Gagal menyimpan WhatsApp admin ke database cloud:', err);
  }

  // Notifikasi perubahan antar-komponen
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('photobooth-admin-whatsapp-updated', {
        detail: { phone: clean },
      })
    );
  }

  return clean;
}
