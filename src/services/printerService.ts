/**
 * Service pengiriman dokumen foto ke printer fisik Kiosk.
 * 
 * PANDUAN INTEGRASI HARDWARE PRINTER EVENT:
 * 1. Local Network / WebSocket Print Server:
 *    - Kebanyakan kiosk photobooth (seperti DNP DS-RX1, Hiti P525L, atau Citizen)
 *      terhubung ke PC kiosk lokal via USB.
 *    - Server lokal menjalankan Node.js / Python WebSocket server pada `ws://kiosk-local:8080/print`.
 * 2. Cloud Print / MQTT:
 *    - Foto dapat diunggah ke Supabase Storage bucket `prints-queue`,
 *      lalu daemon printer di laptop event mendownload dan mencetak otomatis.
 */

export interface PrintResult {
  success: boolean;
  jobId: string;
  printerName: string;
  statusText: string;
}

export async function sendToPrinter(
  orderId: string,
  _photoDataUrl: string
): Promise<PrintResult> {
  // Simulasi komunikasi ke spooler printer kiosk
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const jobId = `PRINT-${Date.now().toString(36).toUpperCase()}`;

  return {
    success: true,
    jobId,
    printerName: 'Kiosk Dye-Sub 4x6" Photo Printer',
    statusText: 'Antrean cetak berhasil dikirim ke printer kiosk. Silakan ambil foto fisik Anda di loket!',
  };
}
