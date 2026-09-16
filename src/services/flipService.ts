/**
 * Konfigurasi dan Helper Flip for Business (BigFlip API)
 * Dokumentasi Resmi: https://docs.flip.id/
 */

export interface FlipConfig {
  mode: 'test' | 'live';
  secretKey: string; // API Secret Key dari dashboard Flip
  validationToken: string; // Token Validasi dari dashboard Flip
  callbackUrl?: string;
}

const FLIP_CONFIG_KEY = 'flip_payment_config';

export const DEFAULT_FLIP_CONFIG: FlipConfig = {
  mode: 'test',
  secretKey: '',
  validationToken: '',
  callbackUrl: '',
};

export function getFlipConfig(): FlipConfig {
  try {
    const raw = localStorage.getItem(FLIP_CONFIG_KEY);
    if (!raw) return DEFAULT_FLIP_CONFIG;
    return { ...DEFAULT_FLIP_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FLIP_CONFIG;
  }
}

export function saveFlipConfig(config: FlipConfig): void {
  localStorage.setItem(FLIP_CONFIG_KEY, JSON.stringify(config));
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

  // Base64 Auth header format: Basic base64(secretKey + ":")
  const basicAuth = btoa(`${cleanKey}:`);
  const baseUrl = getFlipApiBaseUrl(config.mode);

  try {
    const response = await fetch(`${baseUrl}/pwf/bill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        title: params.title,
        type: 'SINGLE',
        amount: params.amount.toString(),
        step: '3', // Direct to payment selection
        sender_name: params.senderName || 'Pengunjung Photobooth',
        sender_email: params.senderEmail || 'pengunjung@aimspace.my.id',
      }),
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
