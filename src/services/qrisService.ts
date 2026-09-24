import { supabase } from '../supabaseClient.js';
import QRCode from 'qrcode';

export interface StaticQrisConfig {
  url: string | null;
  merchantName: string;
  notes?: string;
  updatedAt?: string;
}

const STATIC_QRIS_KEY = 'photobooth_static_qris_config';
export const STATIC_QRIS_ROW_ID = '00000000-0000-0000-0000-000000000005';
export const STATIC_QRIS_ROW_NAME = '__STATIC_QRIS_CONFIG__';

const DEFAULT_QRIS_CONFIG: StaticQrisConfig = {
  url: null,
  merchantName: 'AIM SPACE PHOTOBOOTH',
  notes: 'Mendukung BCA, Mandiri, BRI, BNI, GoPay, OVO, DANA, ShopeePay, LinkAja',
};

let cachedQrisConfig: StaticQrisConfig | null = null;

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

export function normalizeQrisUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // If it's a pub-*.r2.dev URL, normalize to same-origin /api/r2/file/ to bypass ISP blocks and CORS
  if (url.includes('.r2.dev/')) {
    const key = url.split('.r2.dev/')[1].replace(/^\/+/, '');
    return `/api/r2/file/${key}`;
  }
  return url;
}

/**
 * Mengambil konfigurasi QRIS Statis dari cache/localStorage/Supabase
 */
export async function fetchStaticQrisConfig(forceRefresh = false): Promise<StaticQrisConfig> {
  if (!forceRefresh && cachedQrisConfig) {
    cachedQrisConfig.url = normalizeQrisUrl(cachedQrisConfig.url);
    return cachedQrisConfig;
  }

  // Baca dari localStorage
  const raw = safeGetItem(STATIC_QRIS_KEY);
  if (raw) {
    try {
      cachedQrisConfig = { ...DEFAULT_QRIS_CONFIG, ...JSON.parse(raw) };
    } catch (_) {}
  }

  // Muat dari Supabase / D1 row khusus
  try {
    const { data, error } = await supabase
      .from('events')
      .select('qr_code')
      .eq('id', STATIC_QRIS_ROW_ID)
      .maybeSingle();

    if (!error && data && data.qr_code) {
      try {
        const parsed = JSON.parse(data.qr_code);
        if (parsed && typeof parsed === 'object') {
          cachedQrisConfig = {
            ...DEFAULT_QRIS_CONFIG,
            ...(cachedQrisConfig || {}),
            ...parsed,
          };
          safeSetItem(STATIC_QRIS_KEY, JSON.stringify(cachedQrisConfig));
        }
      } catch (_) {}
    }
  } catch (err) {
    console.warn('Gagal memuat konfigurasi QRIS dari Supabase/D1:', err);
  }

  if (!cachedQrisConfig) {
    cachedQrisConfig = { ...DEFAULT_QRIS_CONFIG };
  }

  cachedQrisConfig.url = normalizeQrisUrl(cachedQrisConfig.url);
  return cachedQrisConfig;
}

/**
 * Mengambil konfigurasi secara sinkron dari cache lokal
 */
export function getCachedStaticQris(): StaticQrisConfig {
  if (cachedQrisConfig) {
    cachedQrisConfig.url = normalizeQrisUrl(cachedQrisConfig.url);
    return cachedQrisConfig;
  }
  const raw = safeGetItem(STATIC_QRIS_KEY);
  if (raw) {
    try {
      cachedQrisConfig = { ...DEFAULT_QRIS_CONFIG, ...JSON.parse(raw) };
      cachedQrisConfig.url = normalizeQrisUrl(cachedQrisConfig.url);
      return cachedQrisConfig;
    } catch (_) {}
  }
  return DEFAULT_QRIS_CONFIG;
}

/**
 * Menyimpan konfigurasi QRIS statis ke localStorage & Supabase/D1
 */
export async function saveStaticQrisConfig(
  config: Partial<StaticQrisConfig>
): Promise<StaticQrisConfig> {
  const current = await fetchStaticQrisConfig();
  const updated: StaticQrisConfig = {
    ...current,
    ...config,
    url: normalizeQrisUrl(config.url ?? current.url),
    updatedAt: new Date().toISOString(),
  };

  cachedQrisConfig = updated;
  safeSetItem(STATIC_QRIS_KEY, JSON.stringify(updated));

  // Simpan ke D1 / Supabase events row khusus
  try {
    await supabase.from('events').upsert({
      id: STATIC_QRIS_ROW_ID,
      name: STATIC_QRIS_ROW_NAME,
      qr_code: JSON.stringify(updated),
      price: 0,
      is_active: 0,
    });
  } catch (err) {
    console.warn('Gagal menyimpan QRIS ke database:', err);
  }

  // Broadcast event ke seluruh UI
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('photobooth_static_qris_updated', {
        detail: updated,
      })
    );
  }

  return updated;
}

/**
 * Upload gambar QRIS statis ke Supabase Storage (Bucket 'photos') & konversi base64
 */
export async function uploadQrisImageFile(
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!file) return { success: false, error: 'File tidak ditemukan' };

    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'Format file harus berupa gambar (PNG, JPG, JPEG, WebP)' };
    }

    // Baca ke Data URL terlebih dahulu untuk cadangan offline
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
      reader.readAsDataURL(file);
    });

    let publicUrl: string = dataUrl;

    // Coba upload ke Supabase Storage bucket 'photos'
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `static_qris/qris_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: true,
        });

      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage
          .from('photos')
          .getPublicUrl(fileName);

        if (publicUrlData?.publicUrl) {
          publicUrl = publicUrlData.publicUrl;
        }
      }
    } catch (storageErr) {
      console.warn('Gagal upload ke bucket storage, fallback ke data URL:', storageErr);
    }

    return { success: true, url: publicUrl };
  } catch (err: any) {
    console.error('Error upload file QRIS:', err);
    return { success: false, error: err?.message || 'Gagal memproses file QRIS' };
  }
}

/**
 * Generate kartu gambar QRIS lengkap dengan header & merchant name untuk di-download
 */
export async function downloadQrisImage(
  targetUrl?: string | null,
  merchantName: string = 'AIM SPACE PHOTOBOOTH'
): Promise<void> {
  try {
    let imgSource = targetUrl;

    // Jika belum ada URL QRIS yang di-upload, buat QR default standar nasional
    if (!imgSource) {
      const samplePayload = `00020101021126600014ID.LINKAJA.WWW0118936009110021008747021008747021000303UMI51440014ID.CO.QRIS.WWW0215ID10200210087470303UMI5204581253033605802ID59${merchantName.length < 10 ? '0' + merchantName.length : merchantName.length}${merchantName}6007JAKARTA61051234062070703A016304`;
      imgSource = await QRCode.toDataURL(samplePayload, {
        width: 600,
        margin: 2,
        errorCorrectionLevel: 'H',
      });
    }

    // Buat canvas berbingkai rapi
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    const width = 800;
    const height = 1050;
    canvas.width = width;
    canvas.height = height;

    // Background Putih Bersih
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Border Frame Tipis Abu-abu
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#E4E4E7';
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // Header QRIS Merah Standar
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(20, 20, width - 40, 110);

    // Text Header QRIS
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText('PEMBAYARAN QRIS', width / 2, 72);

    ctx.font = '18px sans-serif';
    ctx.fillText('STANDAR PEMBAYARAN NASIONAL BANK INDONESIA', width / 2, 105);

    // Merchant Name
    ctx.fillStyle = '#18181B';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(merchantName.toUpperCase(), width / 2, 185);

    ctx.fillStyle = '#71717A';
    ctx.font = '18px sans-serif';
    ctx.fillText('NMID / KODE MERCHANT RESMI', width / 2, 218);

    // Load Gambar QRIS
    const img = new Image();
    if (imgSource && imgSource.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Gagal memuat gambar QRIS'));
      img.src = imgSource!;
    });

    // Gambar QR di tengah
    const qrSize = 580;
    const qrX = (width - qrSize) / 2;
    const qrY = 250;
    ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

    // Footer Info E-Wallet
    ctx.fillStyle = '#F4F4F5';
    ctx.fillRect(40, height - 170, width - 80, 120);

    ctx.strokeStyle = '#D4D4D8';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, height - 170, width - 80, 120);

    ctx.fillStyle = '#27272A';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('SATU QR UNTUK SEMUA APLIKASI PEMBAYARAN', width / 2, height - 128);

    ctx.fillStyle = '#52525B';
    ctx.font = '16px sans-serif';
    ctx.fillText('BCA • Mandiri • BRI • BNI • GoPay • OVO • DANA • ShopeePay • LinkAja', width / 2, height - 92);

    // Convert Canvas ke Blob & Download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const cleanName = merchantName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      link.download = `QRIS_${cleanName || 'photobooth'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
    }, 'image/png');
  } catch (err) {
    console.error('Gagal mengunduh QRIS:', err);
    // Fallback: Jika ada URL langsung, buka atau unduh
    if (targetUrl) {
      const link = document.createElement('a');
      link.href = targetUrl;
      link.download = `QRIS_pembayaran.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
