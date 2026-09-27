/**
 * WhatsApp Helper
 * Membantu format pesan dan URL WhatsApp untuk alur pembayaran Tunai & QRIS,
 * dengan kustomisasi pesan otomatis sesuai opsi paket (Cetak Fisik vs Digital Saja).
 */

export interface WhatsAppPaymentMessageOptions {
  method: 'cash' | 'qris';
  isPrint: boolean;
  ticketId: string;
  totalPriceFormatted: string;
  eventName: string;
  hasBoomerang?: boolean;
}

/**
 * Membuat format pesan WhatsApp terstruktur rapi untuk dikirimkan user ke Admin
 */
export function generateWhatsAppPaymentMessage(options: WhatsAppPaymentMessageOptions): string {
  const { method, isPrint, ticketId, totalPriceFormatted, eventName, hasBoomerang } = options;

  const softfileLabel = hasBoomerang ? 'Foto HD & Video Boomerang' : 'Foto HD';
  const packageTitle = isPrint
    ? 'Paket Cetak Fisik + Softfile HD'
    : 'Paket Digital Softfile HD';

  if (method === 'cash') {
    // Alur Tunai: User konfirmasi WA ke admin untuk bayar, saat sudah bayar baru dikirim softfile
    if (isPrint) {
      return `Halo Admin ${eventName}, saya ingin konfirmasi pembayaran Tunai di Kasir:

📋 *Nomor Sesi:* ${ticketId}
📦 *Paket:* ${packageTitle}
🖨️ *Layanan Cetak:* Cetak 1 Lembar Photo Strip Fisik
💰 *Total Tagihan:* ${totalPriceFormatted}

Saya akan serahkan uang tunai di kasir. Mohon dibantu cetak foto fisiknya dan kirimkan softfile ${softfileLabel} ke nomor WhatsApp ini ya kak setelah pembayaran lunas. Terima kasih!`;
    } else {
      return `Halo Admin ${eventName}, saya ingin konfirmasi pembayaran Tunai di Kasir:

📋 *Nomor Sesi:* ${ticketId}
📦 *Paket:* ${packageTitle}
💰 *Total Tagihan:* ${totalPriceFormatted}

Saya akan serahkan uang tunai di kasir. Mohon dibantu kirimkan softfile ${softfileLabel} ke nomor WhatsApp ini ya kak setelah pembayaran lunas. Terima kasih!`;
    }
  } else {
    // Alur QRIS: Bayar dulu dan konfirmasi ke WA admin, setelah itu baru dikirim softfile
    if (isPrint) {
      return `Halo Admin ${eventName}, saya sudah scan & bayar via QRIS untuk sesi photobooth:

📋 *Nomor Sesi:* ${ticketId}
📦 *Paket:* ${packageTitle}
🖨️ *Layanan Cetak:* Cetak 1 Lembar Photo Strip Fisik
💰 *Total Pembayaran:* ${totalPriceFormatted}

Berikut bukti transfer/bayar QRIS saya lampirkan. Mohon dibantu cek, cetak foto fisiknya, dan kirimkan softfile ${softfileLabel} ke nomor WhatsApp ini ya kak. Terima kasih!`;
    } else {
      return `Halo Admin ${eventName}, saya sudah scan & bayar via QRIS untuk sesi photobooth:

📋 *Nomor Sesi:* ${ticketId}
📦 *Paket:* ${packageTitle}
💰 *Total Pembayaran:* ${totalPriceFormatted}

Berikut bukti transfer/bayar QRIS saya lampirkan. Mohon dibantu cek dan kirimkan softfile ${softfileLabel} ke nomor WhatsApp ini ya kak. Terima kasih!`;
    }
  }
}

/**
 * Membuat tautan resmi WhatsApp Web / App
 */
export function buildWhatsAppUrl(adminPhone: string, message: string): string {
  let clean = adminPhone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  if (!clean.startsWith('62') && clean.length > 5) {
    clean = '62' + clean;
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}
