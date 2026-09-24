import JSZip from 'jszip';
import { PhotoboothLayout, LayoutSlot } from '../types';

export interface LayoutRenderOptions {
  theme?: 'dark' | 'light' | 'transparent';
  includeMetadata?: boolean;
}

/**
 * Render layout slots to an offscreen HTMLCanvasElement at exact pixel resolution.
 */
export function renderLayoutToCanvas(
  layout: PhotoboothLayout,
  options: LayoutRenderOptions = {}
): HTMLCanvasElement {
  const width = Math.max(layout.canvas_width || 1200, 100);
  const height = Math.max(layout.canvas_height || 1800, 100);
  const theme = options.theme || 'dark';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Gagal menginisialisasi 2D canvas context.');
  }

  // 1. Draw Background
  if (theme === 'transparent') {
    ctx.clearRect(0, 0, width, height);
  } else if (theme === 'light') {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    // Subtle grid dots
    ctx.fillStyle = '#CBD5E1';
    const dotSpacing = Math.max(40, Math.round(width / 30));
    for (let x = dotSpacing; x < width; x += dotSpacing) {
      for (let y = dotSpacing; y < height; y += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    // Dark Theme (Default Studio Template)
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    // Subtle blueprint grid
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    const gridSpacing = Math.max(50, Math.round(width / 24));
    for (let x = gridSpacing; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = gridSpacing; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  // 2. Draw Outer Canvas Boundary Line
  ctx.strokeStyle = theme === 'light' ? '#94A3B8' : '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // 3. Draw Each Photo Slot
  const slots: LayoutSlot[] = layout.slots || [];
  slots.forEach((slot, index) => {
    const slotIdx = index;
    const pxX = Math.round((slot.x / 100) * width);
    const pxY = Math.round((slot.y / 100) * height);
    const pxW = Math.round((slot.width / 100) * width);
    const pxH = Math.round((slot.height / 100) * height);

    // Minimum visual bounds guard
    if (pxW <= 0 || pxH <= 0) return;

    // Radius calculation
    const radius = Math.min(16, pxW / 10, pxH / 10);

    // Slot Fill
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pxX, pxY, pxW, pxH, radius);

    if (theme === 'transparent') {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)'; // Cyan translucent
      ctx.fill();
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (theme === 'light') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#111827';
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();

    // Subtle slot center crosshair (dashed)
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = theme === 'light' ? 'rgba(2, 132, 199, 0.3)' : 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1.5;
    const centerX = pxX + pxW / 2;
    const centerY = pxY + pxH / 2;

    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(pxX + 10, centerY);
    ctx.lineTo(pxX + pxW - 10, centerY);
    ctx.stroke();

    // Vertical center line
    ctx.beginPath();
    ctx.moveTo(centerX, pxY + 10);
    ctx.lineTo(centerX, pxY + pxH - 10);
    ctx.stroke();
    ctx.restore();

    // Corner registration marks inside slot
    const cornerSize = Math.min(18, pxW / 8, pxH / 8);
    ctx.save();
    ctx.strokeStyle = theme === 'light' ? '#0284C7' : '#38BDF8';
    ctx.lineWidth = 2.5;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(pxX + 8, pxY + 8 + cornerSize);
    ctx.lineTo(pxX + 8, pxY + 8);
    ctx.lineTo(pxX + 8 + cornerSize, pxY + 8);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(pxX + pxW - 8 - cornerSize, pxY + 8);
    ctx.lineTo(pxX + pxW - 8, pxY + 8);
    ctx.lineTo(pxX + pxW - 8, pxY + 8 + cornerSize);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(pxX + 8, pxY + pxH - 8 - cornerSize);
    ctx.lineTo(pxX + 8, pxY + pxH - 8);
    ctx.lineTo(pxX + 8 + cornerSize, pxY + pxH - 8);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(pxX + pxW - 8 - cornerSize, pxY + pxH - 8);
    ctx.lineTo(pxX + pxW - 8, pxY + pxH - 8);
    ctx.lineTo(pxX + pxW - 8, pxY + pxH - 8 - cornerSize);
    ctx.stroke();
    ctx.restore();

    // Slot Labels & Dimensions
    ctx.save();
    const scaleFactor = Math.max(0.6, Math.min(1.8, Math.min(pxW, pxH) / 320));
    const badgeFontSize = Math.round(18 * scaleFactor);
    const textFontSize = Math.round(13 * scaleFactor);

    // Badge: SLOT #N
    const badgeText = `SLOT #${slotIdx + 1}`;
    ctx.font = `bold ${badgeFontSize}px "Plus Jakarta Sans", -apple-system, sans-serif`;
    const badgeMetrics = ctx.measureText(badgeText);
    const badgePadX = 14 * scaleFactor;
    const badgePadY = 8 * scaleFactor;
    const badgeW = badgeMetrics.width + badgePadX * 2;
    const badgeH = badgeFontSize + badgePadY * 2;

    const badgeX = centerX - badgeW / 2;
    const badgeY = centerY - badgeH - 4 * scaleFactor;

    // Pill background
    ctx.fillStyle = theme === 'light' ? '#0284C7' : '#0369A1';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8 * scaleFactor);
    ctx.fill();

    // Pill text
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, centerX, badgeY + badgeH / 2);

    // Dimension text: W × H px
    ctx.font = `bold ${textFontSize}px "Plus Jakarta Sans", monospace`;
    ctx.fillStyle = theme === 'light' ? '#0F172A' : '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const dimY = centerY + 6 * scaleFactor;
    ctx.fillText(`${pxW} × ${pxH} px`, centerX, dimY);

    // Position coordinate: (x, y)
    if (pxH > 140) {
      ctx.font = `${Math.round(11 * scaleFactor)}px monospace`;
      ctx.fillStyle = theme === 'light' ? '#64748B' : '#94A3B8';
      ctx.fillText(`Posisi: (${pxX}, ${pxY}) px • [${slot.width}% × ${slot.height}%]`, centerX, dimY + textFontSize + 4);
    }

    ctx.restore();
  });

  // 4. Metadata Watermark Banner
  if (options.includeMetadata !== false && theme !== 'transparent') {
    ctx.save();
    const bannerH = Math.max(36, Math.round(height * 0.035));
    const isTopFree = !slots.some((s) => (s.y / 100) * height < bannerH + 10);
    const bannerY = isTopFree ? 0 : height - bannerH;

    // Dark bar background
    ctx.fillStyle = theme === 'light' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(3, 7, 18, 0.9)';
    ctx.fillRect(0, bannerY, width, bannerH);

    // Accent line
    ctx.fillStyle = '#F59E0B'; // Amber accent
    ctx.fillRect(0, isTopFree ? bannerH - 2 : bannerY, width, 2);

    // Banner Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(bannerH * 0.4)}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `LAYOUT GUIDE: ${layout.name.toUpperCase()}  |  ${width} × ${height} px  (Rasio ${layout.ratio})  |  ${layout.photo_count} Slot Foto`,
      16,
      bannerY + bannerH / 2
    );

    // Right-aligned branding
    ctx.textAlign = 'right';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText('AIM PHOTOBOOTH TEMPLATE', width - 16, bannerY + bannerH / 2);

    ctx.restore();
  }

  return canvas;
}

/**
 * Generate a Blob from layout canvas
 */
export function generateLayoutBlob(
  layout: PhotoboothLayout,
  options: LayoutRenderOptions = {}
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = renderLayoutToCanvas(layout, options);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Gagal menghasilkan Blob gambar dari kanvas layout.'));
          }
        },
        'image/png',
        1.0
      );
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Trigger file download directly in browser
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Sanitize layout name for safe filename
 */
export function sanitizeLayoutFilename(name: string, width: number, height: number): string {
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${safeName || 'layout'}_${width}x${height}.png`;
}

/**
 * Download a single layout image directly
 */
export async function downloadSingleLayout(
  layout: PhotoboothLayout,
  options: LayoutRenderOptions = {}
): Promise<void> {
  const blob = await generateLayoutBlob(layout, options);
  const filename = sanitizeLayoutFilename(layout.name, layout.canvas_width, layout.canvas_height);
  downloadBlob(blob, filename);
}

/**
 * Download all layouts packaged in a single ZIP file
 */
export async function downloadAllLayoutsAsZip(
  layouts: PhotoboothLayout[],
  onProgress?: (current: number, total: number, layoutName: string) => void
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder('layout_photobooth_templates');

  let readmeContent = `====================================================\n`;
  readmeContent += `AIM PHOTOBOOTH - PANDUAN UKURAN & SPESIFIKASI LAYOUT\n`;
  readmeContent += `Total Layout: ${layouts.length} Layout\n`;
  readmeContent += `Tanggal Dibuat: ${new Date().toLocaleString('id-ID')}\n`;
  readmeContent += `====================================================\n\n`;
  readmeContent += `Gunakan gambar template PNG di dalam folder ini sebagai dasar\n`;
  readmeContent += `desain overlay frame (di Canva, Figma, Photoshop, atau AI).\n`;
  readmeContent += `Pastikan saat ekspor frame PNG, latar belakang slot foto dibuat TRANSPARAN.\n\n`;
  readmeContent += `DAFTAR UKURAN KANVAS & SLOT:\n`;

  const total = layouts.length;

  for (let i = 0; i < total; i++) {
    const layout = layouts[i];
    if (onProgress) {
      onProgress(i + 1, total, layout.name);
    }

    // Generate Guide Image
    const blob = await generateLayoutBlob(layout, { theme: 'dark', includeMetadata: true });
    const filename = `${String(i + 1).padStart(2, '0')}_${sanitizeLayoutFilename(
      layout.name,
      layout.canvas_width,
      layout.canvas_height
    )}`;

    if (folder) {
      folder.file(filename, blob);
    }

    // Append to Readme
    readmeContent += `----------------------------------------------------\n`;
    readmeContent += `[${String(i + 1).padStart(2, '0')}] ${layout.name.toUpperCase()}\n`;
    readmeContent += ` - Ukuran Kanvas : ${layout.canvas_width} × ${layout.canvas_height} px (Rasio: ${layout.ratio})\n`;
    readmeContent += ` - Jumlah Foto   : ${layout.photo_count} Slot Foto\n`;
    readmeContent += ` - File Template : ${filename}\n`;
    readmeContent += ` - Posisi Slot Foto:\n`;

    (layout.slots || []).forEach((slot, sIdx) => {
      const pxX = Math.round((slot.x / 100) * layout.canvas_width);
      const pxY = Math.round((slot.y / 100) * layout.canvas_height);
      const pxW = Math.round((slot.width / 100) * layout.canvas_width);
      const pxH = Math.round((slot.height / 100) * layout.canvas_height);
      readmeContent += `    * Slot #${(slot.index ?? sIdx) + 1}: ${pxW} × ${pxH} px | Posisi (X=${pxX}px, Y=${pxY}px) | Persentase (x=${slot.x}%, y=${slot.y}%, w=${slot.width}%, h=${slot.height}%)\n`;
    });
    readmeContent += `\n`;
  }

  if (folder) {
    folder.file('PANDUAN_UKURAN_LAYOUT.txt', readmeContent);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    // optional zip generation progress
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  downloadBlob(zipBlob, `semua_layout_photobooth_${timestamp}.zip`);
}
