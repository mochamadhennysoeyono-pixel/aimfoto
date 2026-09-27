import { PhotoboothOrder } from '../types';

/**
 * Service pembayaran modular untuk Photobooth Kiosk.
 * 
 * PANDUAN INTEGRASI SUPABASE & PAYMENT GATEWAY:
 * 1. Midtrans Snap:
 *    - Panggil backend API `/api/charge` untuk generate `snap_token` menggunakan Server Key.
 *    - Di frontend, panggil `window.snap.pay(token, { onSuccess: ..., onPending: ... })`.
 * 2. Xendit:
 *    - Panggil backend `/api/xendit-invoice` untuk mendapatkan invoice URL / QRIS string.
 * 3. Supabase Database Sync:
 *    - Simpan order: `await supabase.from('orders').insert(orderData)`.
 *    - Update status pembayaran saat webhook callback diterima.
 */

export interface PaymentProcessResult {
  success: boolean;
  transactionId: string;
  paymentMethod: string;
  waktuSelesai: string;
  message?: string;
}

export async function processPayment(
  order: PhotoboothOrder,
  selectedMethod: string = 'QRIS'
): Promise<PaymentProcessResult> {
  // Simulasi network request ke Payment Gateway
  await new Promise((resolve) => setTimeout(resolve, 1400));

  // Di sini nantinya Anda dapat memanggil Supabase:
  // const { error } = await supabase.from('orders').update({
  //   statusPembayaran: 'settlement',
  //   paymentMethod: selectedMethod,
  //   transactionId: `TRX-${Date.now()}`
  // }).eq('id', order.id);

  const mockTransactionId = `TRX-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}`;

  return {
    success: true,
    transactionId: mockTransactionId,
    paymentMethod: selectedMethod,
    waktuSelesai: new Date().toISOString(),
    message: 'Pembayaran berhasil dikonfirmasi!',
  };
}
