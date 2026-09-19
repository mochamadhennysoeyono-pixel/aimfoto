/**
 * Utilitas Pencetakan Foto Photobooth (10x15 cm / 4R Borderless)
 * Membuka lembar cetak khusus di tab browser baru agar bebas dari batasan iframe sandbox
 * dan langsung memicu dialog printer asli browser (Chrome, Edge, Safari, Firefox).
 */

export interface PrintResult {
  success: boolean;
  blobUrl: string;
  orderShort: string;
}

/**
 * Menghasilkan kode HTML mandiri untuk halaman cetak 10x15cm (4R)
 */
export function generatePrintHtml(imageUrl: string, options?: { title?: string; orderShort?: string }): string {
  const docTitle = options?.title || `Cetak Foto 10x15cm (4R) - Photobooth`;
  const orderShort = options?.orderShort || 'PHOTO';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle}</title>
  <style>
    /* Styling Normal Layar (Screen) */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background: #09090b;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Floating Toolbar untuk Operator Photobooth */
    .top-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(18, 18, 24, 0.95);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
    }
    .toolbar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge-4r {
      background: #f59e0b;
      color: #000;
      font-weight: 800;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .toolbar-title {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
    }
    .toolbar-subtitle {
      font-size: 11px;
      color: #a1a1aa;
    }
    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-print {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #000;
      border: none;
      padding: 10px 22px;
      font-size: 13px;
      font-weight: 800;
      border-radius: 10px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35);
      transition: all 0.15s ease;
    }
    .btn-print:hover {
      transform: translateY(-1px);
      filter: brightness(1.1);
    }
    .btn-print:active {
      transform: translateY(1px);
    }
    .btn-secondary {
      background: #27272a;
      color: #e4e4e7;
      border: 1px solid #3f3f46;
      padding: 9px 16px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 10px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .btn-secondary:hover {
      background: #3f3f46;
      color: #fff;
    }

    /* Banner Petunjuk */
    .notice-bar {
      background: rgba(245, 158, 11, 0.1);
      border-bottom: 1px solid rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      padding: 8px 20px;
      font-size: 12px;
      text-align: center;
    }

    /* Container Pratinjau Kertas 10x15cm di Layar */
    .preview-stage {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 30px 20px;
    }
    .photo-sheet {
      background: #ffffff;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      max-width: 90vw;
      max-height: 80vh;
      overflow: hidden;
    }
    .photo-sheet img {
      display: block;
      max-width: 100%;
      max-height: 80vh;
      object-fit: contain;
    }

    /* PENGATURAN KHUSUS CETAK (PRINT CSS / 10x15cm 4R) */
    @page {
      size: 100mm 150mm;
      margin: 0;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .preview-stage {
        padding: 0 !important;
        margin: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .photo-sheet {
        box-shadow: none !important;
        border-radius: 0 !important;
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
      }
      .photo-sheet img {
        width: 100% !important;
        height: 100% !important;
        max-height: 100% !important;
        object-fit: contain !important;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: high-quality;
      }
    }
  </style>
</head>
<body>
  <!-- Floating Toolbar Khusus Layar (Hilang saat dicetak) -->
  <div class="top-toolbar no-print">
    <div class="toolbar-brand">
      <span class="badge-4r">10x15 cm • 4R</span>
      <div>
        <div class="toolbar-title">Lembar Cetak Photobooth #${orderShort}</div>
        <div class="toolbar-subtitle">Borderless • Siap kirim ke Printer Fisik</div>
      </div>
    </div>
    <div class="toolbar-actions">
      <a href="${imageUrl}" download="photobooth-${orderShort}.jpg" class="btn-secondary">
        ⬇️ Unduh File .JPG
      </a>
      <button type="button" class="btn-print" onclick="doPrintNow()">
        🖨️ Cetak Foto Sekarang (Ctrl+P)
      </button>
      <button type="button" class="btn-secondary" onclick="window.close()">
        ✕ Tutup
      </button>
    </div>
  </div>

  <div class="notice-bar no-print">
    💡 <strong>Info:</strong> Dialog cetak browser akan otomatis terbuka. Jika dialog belum muncul atau terhalang, klik tombol <strong>"🖨️ Cetak Foto Sekarang"</strong> di kanan atas atau tekan <strong>Ctrl + P</strong> (Windows) / <strong>Cmd + P</strong> (Mac).
  </div>

  <!-- Pratinjau Foto Asli -->
  <div class="preview-stage">
    <div class="photo-sheet">
      <img id="printTarget" src="${imageUrl}" alt="Foto Photobooth #${orderShort}" />
    </div>
  </div>

  <script>
    function updatePageOrientation() {
      var img = document.getElementById('printTarget');
      if (!img) return;
      var isLandscape = img.naturalWidth > img.naturalHeight;
      var pageRule = '@page { size: ' + (isLandscape ? '150mm 100mm' : '100mm 150mm') + '; margin: 0; }';
      var style = document.createElement('style');
      style.innerHTML = pageRule;
      document.head.appendChild(style);
    }

    function doPrintNow() {
      updatePageOrientation();
      window.focus();
      try {
        window.print();
      } catch (err) {
        console.warn('Gagal memanggil window.print():', err);
      }
    }

    var img = document.getElementById('printTarget');
    function initPrint() {
      updatePageOrientation();
      // Berikan delay sejenak agar browser selesai merender visual foto sebelum dialog print muncul
      setTimeout(function() {
        doPrintNow();
      }, 350);
    }

    if (img) {
      if (img.complete && img.naturalWidth > 0) {
        initPrint();
      } else {
        img.onload = initPrint;
        img.onerror = function() {
          console.warn('Foto gagal dimuat');
        };
      }
    }
  </script>
</body>
</html>`;
}

/**
 * Membuka tab cetak browser baru dengan format 10x15cm (4R)
 */
export function openPrintTab(imageUrl: string, options?: { title?: string; orderShort?: string }): PrintResult {
  const orderShort = options?.orderShort || 'PHOTO';
  const html = generatePrintHtml(imageUrl, options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  // Coba buka jendela/tab baru langsung dari event click
  let openedWindow: Window | null = null;
  try {
    openedWindow = window.open(blobUrl, '_blank');
  } catch (e) {
    console.warn('window.open failed:', e);
  }

  const success = Boolean(openedWindow && !openedWindow.closed && typeof openedWindow.closed !== 'undefined');

  return {
    success,
    blobUrl,
    orderShort,
  };
}

/**
 * Utilitas untuk mengunduh foto langsung ke komputer
 */
export async function downloadPhotoFile(url: string, filename: string) {
  try {
    if (url.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  } catch (err) {
    console.warn('Fallback download via window.open:', err);
    window.open(url, '_blank');
  }
}
