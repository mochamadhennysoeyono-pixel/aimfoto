/**
 * Konfigurasi dan Helper Flip for Business (BigFlip API)
 * Dokumentasi Resmi: https://docs.flip.id/
 */

import { supabase } from '../supabaseClient.js';

export interface FlipConfig {
  mode: 'test' | 'live';
  secretKey: string; // API Secret Key dari dashboard Flip
  validationToken: string; // Token Validasi dari dashboard Flip
  callbackUrl?: string;
}

const FLIP_CONFIG_KEY = 'flip_payment_config';
const FLIP_CONFIG_ROW_ID = '00000000-0000-0000-0000-000000000002';

export const DEFAULT_FLIP_CONFIG: FlipConfig = {
  mode: 'test',
  secretKey: '',
  validationToken: '',
  callbackUrl: '',
};

let cachedCloudFlipConfig: FlipConfig | null = null;

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

export function getFlipConfig(): FlipConfig {
  const env = (import.meta as any).env || {};
  const envKey = env.VITE_FLIP_SECRET_KEY || env.FLIP_SECRET_KEY || '';
  const envMode = env.VITE_FLIP_MODE === 'live' ? 'live' : 'test';

  try {
    const raw = safeGetItem(FLIP_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_FLIP_CONFIG,
        secretKey: parsed.secretKey || envKey,
        mode: parsed.mode || (envKey ? envMode : 'test'),
        validationToken: parsed.validationToken || '',
        callbackUrl: parsed.callbackUrl || '',
      };
    }
  } catch (_) {}

  if (cachedCloudFlipConfig) {
    return {
      ...DEFAULT_FLIP_CONFIG,
      ...cachedCloudFlipConfig,
      secretKey: cachedCloudFlipConfig.secretKey || envKey,
    };
  }

  return {
    ...DEFAULT_FLIP_CONFIG,
    secretKey: envKey,
    mode: envKey ? envMode : 'test',
  };
}

/**
 * Mengambil konfigurasi Flip dari Cloud Supabase agar sinkron di semua kiosk & perangkat
 */
export async function fetchFlipConfigFromCloud(): Promise<FlipConfig | null> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('qr_code')
      .eq('id', FLIP_CONFIG_ROW_ID)
      .maybeSingle();

    if (!error && data && data.qr_code) {
      try {
        const parsed = JSON.parse(data.qr_code);
        if (parsed && typeof parsed === 'object') {
          cachedCloudFlipConfig = {
            mode: parsed.mode === 'live' ? 'live' : 'test',
            secretKey: (parsed.secretKey || '').trim(),
            validationToken: (parsed.validationToken || '').trim(),
            callbackUrl: (parsed.callbackUrl || '').trim(),
          };
          safeSetItem(FLIP_CONFIG_KEY, JSON.stringify(cachedCloudFlipConfig));
          return cachedCloudFlipConfig;
        }
      } catch (_) {}
    }
  } catch (err) {
    console.warn('Gagal memuat konfigurasi Flip dari Supabase:', err);
  }
  return null;
}

// Inisialisasi pengambilan konfigurasi cloud di latar belakang
fetchFlipConfigFromCloud().catch(() => {});

/**
 * Menyimpan konfigurasi Flip ke localStorage dan Cloud Supabase
 */
export async function saveFlipConfig(config: FlipConfig): Promise<void> {
  safeSetItem(FLIP_CONFIG_KEY, JSON.stringify(config));
  cachedCloudFlipConfig = config;

  try {
    await supabase.from('events').upsert({
      id: FLIP_CONFIG_ROW_ID,
      name: '__FLIP_CONFIG__',
      qr_code: JSON.stringify(config),
      default_price: 0,
      is_active: false,
    });
  } catch (err) {
    console.warn('Peringatan: Gagal sinkronisasi konfigurasi Flip ke Supabase:', err);
  }
}

export interface FlipBillResponse {
  link_id: number | string;
  link_url: string;
  title: string;
  type: string;
  amount: number;
  status: 'ACTIVE' | 'INACTIVE' | 'SUCCESSFUL';
  payment_url?: string;
  bill_payment?: {
    receiver_bank_account?: {
      account_number: string;
      bank_code: string;
    };
  };
}

/**
 * Endpoint URL Flip:
 * - Test Mode: https://bigflip.id/big_sandbox_api/v2
 * - Live Mode: https://bigflip.id/api/v2
 */
export function getFlipApiBaseUrl(mode: 'test' | 'live'): string {
  return mode === 'live'
    ? 'https://bigflip.id/api/v2'
    : 'https://bigflip.id/big_sandbox_api/v2';
}

/**
 * Tes Validitas Kredensial Flip API
 */
export async function testFlipCredentials(key: string, mode: 'test' | 'live'): Promise<{
  valid: boolean;
  message: string;
}> {
  if (!key || !key.trim()) {
    return { valid: false, message: 'Secret Key belum diisi.' };
  }
  const cleanKey = key.trim();
  const basicAuth = btoa(`${cleanKey}:`);
  const baseUrl = getFlipApiBaseUrl(mode);

  try {
    const res = await fetch(`${baseUrl}/general/banks`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    });

    if (res.status === 200) {
      return { valid: true, message: 'Koneksi ke API Flip berhasil! Kredensial valid.' };
    } else if (res.status === 401) {
      return {
        valid: false,
        message:
          'Kredensial tidak valid (401 Unauthorized). Pastikan Anda menyalin API Secret Key (bukan Token Validasi) dan periksa apakah Secret Key tersebut untuk mode Sandbox atau Live.',
      };
    } else {
      const errText = await res.text();
      return { valid: false, message: `Flip API Error (${res.status}): ${errText}` };
    }
  } catch (err: any) {
    return {
      valid: false,
      message: `Gagal menghubungi server Flip: ${err.message || 'Cek koneksi internet'}`,
    };
  }
}

/**
 * Membuat Tagihan Pembayaran Flip (Create Bill).
 * Mendukung QRIS, Bank Transfer / Virtual Account, & E-Wallet.
 */
export async function createFlipBill(params: {
  orderId: string;
  title: string;
  amount: number;
  senderName?: string;
  senderEmail?: string;
  redirectUrl?: string;
}): Promise<{
  success: boolean;
  bill?: FlipBillResponse;
  paymentUrl?: string;
  isSimulated?: boolean;
  error?: string;
  httpStatus?: number;
}> {
  const config = getFlipConfig();
  const cleanKey = (config.secretKey || '').trim();

  // Jika belum mengisi Secret Key resmi dari dashboard Flip
  if (!cleanKey) {
    return {
      success: false,
      isSimulated: true,
      error: 'Secret Key Flip belum diisi di Admin Portal.',
    };
  }

  // Ketentuan Flip: minimum pembayaran adalah Rp 10.000
  if (params.amount > 0 && params.amount < 10000) {
    return {
      success: false,
      error: `API Flip for Business menetapkan nominal pembayaran minimum sebesar Rp 10.000 (saat ini nominal order: Rp ${params.amount.toLocaleString('id-ID')}). Silakan perbarui harga event menjadi minimal Rp 10.000 di menu Admin > Events.`,
    };
  }

  // Base64 Auth header format sesuai dokumentasi resmi Flip:
  // AUTH_STRING: Base64Encode("YourApiSecretKey" + ":")
  const basicAuth = btoa(`${cleanKey}:`);
  const baseUrl = getFlipApiBaseUrl(config.mode);

  try {
    const payload: Record<string, string> = {
      title: params.title || 'Photobooth Session',
      type: 'SINGLE',
      amount: params.amount.toString(),
      step: '3', // Direct to payment selection (QRIS, VA, E-Wallet)
      sender_name: params.senderName || 'Pengunjung Photobooth',
      sender_email: params.senderEmail || 'pengunjung@aimspace.my.id',
    };

    if (typeof window !== 'undefined') {
      payload.redirect_url = params.redirectUrl || window.location.href;
    }

    const response = await fetch(`${baseUrl}/pwf/bill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('Flip API Error response:', response.status, errText);
      return {
        success: false,
        httpStatus: response.status,
        error:
          response.status === 401
            ? 'API Secret Key Flip tidak valid atau tidak cocok dengan mode yang dipilih (Sandbox vs Live).'
            : `Gagal membuat tagihan di Flip (${response.status}): ${errText}`,
      };
    }

    const data: FlipBillResponse = await response.json();
    const actualPaymentUrl = data.link_url || data.payment_url;

    return {
      success: true,
      bill: data,
      paymentUrl: actualPaymentUrl,
      isSimulated: false,
    };
  } catch (err: any) {
    console.warn('Flip API request network failed:', err.message);
    return {
      success: false,
      error: `Koneksi ke Flip terhambat: ${err.message}`,
    };
  }
}

/**
 * Cek status tagihan Flip via API
 */
export async function checkFlipBillStatus(billId: string | number): Promise<{
  success: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'SUCCESSFUL' | 'UNKNOWN';
  raw?: any;
}> {
  const config = getFlipConfig();
  const cleanKey = (config.secretKey || '').trim();
  if (!cleanKey) {
    return { success: false, status: 'UNKNOWN' };
  }

  const basicAuth = btoa(`${cleanKey}:`);
  const baseUrl = getFlipApiBaseUrl(config.mode);

  try {
    const response = await fetch(`${baseUrl}/pwf/bill/${billId}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
    });

    if (!response.ok) return { success: false, status: 'UNKNOWN' };
    const data = await response.json();
    return {
      success: true,
      status: data.status || 'UNKNOWN',
      raw: data,
    };
  } catch (err) {
    return { success: false, status: 'UNKNOWN' };
  }
}
