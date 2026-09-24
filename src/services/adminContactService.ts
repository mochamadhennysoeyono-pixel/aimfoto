/**
 * Service untuk mengelola Nomor WhatsApp Admin dan pengaturan kontak
 */

const ADMIN_WHATSAPP_KEY = 'photobooth_admin_whatsapp';
const DEFAULT_ADMIN_WHATSAPP = '6281234567890'; // Default placeholder

export function getAdminWhatsapp(): string {
  try {
    const val = localStorage.getItem(ADMIN_WHATSAPP_KEY);
    return val && val.trim() ? val.trim() : DEFAULT_ADMIN_WHATSAPP;
  } catch {
    return DEFAULT_ADMIN_WHATSAPP;
  }
}

export function saveAdminWhatsapp(phone: string): void {
  try {
    // Normalisasi: buang karakter non-digit kecuali tanda plus jika ada
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    }
    localStorage.setItem(ADMIN_WHATSAPP_KEY, clean);
  } catch (e) {
    console.warn('Gagal menyimpan WhatsApp admin:', e);
  }
}
