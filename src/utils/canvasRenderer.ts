import { FilterPreset, FrameLayoutType, PhotoboothLayout, CustomDecorationItem } from '../types';
import { getFrameLayout } from '../data/frameLayouts';

/**
 * Loads an image from a Data URL or URL string into an HTMLImageElement asynchronously.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Gagal memuat gambar: ${err}`));
    img.src = src;
  });
}

/**
 * Draws an image into a bounding box with object-fit: cover
 */
function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const targetAspect = w / h;
  const imgAspect = img.width / img.height;

  let drawW = w;
  let drawH = h;
  let drawX = x;
  let drawY = y;

  if (imgAspect > targetAspect) {
    drawH = h;
    drawW = h * imgAspect;
    drawX = x + (w - drawW) / 2;
  } else {
    drawW = w;
    drawH = w / imgAspect;
    drawY = y + (h - drawH) / 2;
  }

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

/**
 * Renders user custom decorations (texts and emojis) onto the canvas with proper font styling and 3D/cartoon effects.
 */
function drawDecorations(
  ctx: CanvasRenderingContext2D,
  decorations: CustomDecorationItem[],
  canvasWidth: number,
  canvasHeight: number
) {
  for (const item of decorations) {
    if (!item.content) continue;

    const posX = (item.x / 100) * canvasWidth;
    const posY = (item.y / 100) * canvasHeight;
    const scaleFactor = canvasWidth / 1080;
    const scaledFontSize = Math.max(12, Math.round(item.fontSize * scaleFactor));

    ctx.save();
    ctx.translate(posX, posY);
    if (item.rotation) {
      ctx.rotate((item.rotation * Math.PI) / 180);
    }

    if (item.type === 'emoji') {
      ctx.font = `${scaledFontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.content, 0, 0);
    } else {
      const isBold = item.isBold ? 'bold' : 'normal';
      const isItalic = item.isItalic ? 'italic' : 'normal';

      let fontFamily = '"Plus Jakarta Sans", sans-serif';
      if (item.fontStylePreset === 'cartoon') {
        fontFamily = '"Fredoka", "Rubik Bubbles", cursive, sans-serif';
      } else if (item.fontStylePreset === '3d') {
        fontFamily = '"Bungee", "Righteous", sans-serif';
      } else if (item.fontStylePreset === 'cursive') {
        fontFamily = '"Pacifico", "Caveat", cursive';
      } else if (item.fontStylePreset === 'serif') {
        fontFamily = '"Playfair Display", serif';
      } else if (item.fontStylePreset === 'retro') {
        fontFamily = '"Righteous", "Permanent Marker", cursive';
      } else if (item.fontStylePreset === 'modern') {
        fontFamily = '"Plus Jakarta Sans", sans-serif';
      }

      ctx.font = `${isItalic} ${isBold} ${scaledFontSize}px ${fontFamily}`;
      ctx.textAlign = item.align || 'center';
      ctx.textBaseline = 'middle';

      const lines = item.content.split('\n');
      const lineHeight = scaledFontSize * 1.25;
      const startY = -((lines.length - 1) * lineHeight) / 2;

      lines.forEach((line, lineIdx) => {
        const curY = startY + lineIdx * lineHeight;

        if (item.fontStylePreset === '3d') {
          // 3D pop effect: multiple stacked shadow offsets
          const depth = Math.max(3, Math.round(scaledFontSize * 0.08));
          for (let d = depth; d >= 1; d--) {
            ctx.fillStyle = item.outlineColor || '#000000';
            ctx.fillText(line, d, curY + d);
          }
          // Main text face
          ctx.fillStyle = item.color || '#F59E0B';
          ctx.fillText(line, 0, curY);
        } else if (item.fontStylePreset === 'cartoon') {
          // Cartoon style: thick stroke outline + bright comic fill
          ctx.lineWidth = Math.max(3, Math.round(scaledFontSize * 0.12));
          ctx.strokeStyle = item.outlineColor || '#000000';
          ctx.lineJoin = 'round';
          ctx.strokeText(line, 0, curY);

          ctx.fillStyle = item.color || '#FCD34D';
          ctx.fillText(line, 0, curY);
        } else {
          // Standard style with outline if selected
          if (item.outlineColor && item.outlineColor !== 'transparent') {
            ctx.lineWidth = Math.max(2, Math.round(scaledFontSize * 0.08));
            ctx.strokeStyle = item.outlineColor;
            ctx.lineJoin = 'round';
            ctx.strokeText(line, 0, curY);
          }
          ctx.fillStyle = item.color || '#FFFFFF';
          ctx.fillText(line, 0, curY);
        }

        // Underline effect if enabled
        if (item.isUnderline) {
          const metrics = ctx.measureText(line);
          const textW = metrics.width;
          let lineStartX = 0;
          if (item.align === 'center') {
            lineStartX = -textW / 2;
          } else if (item.align === 'right') {
            lineStartX = -textW;
          }
          const underlineY = curY + scaledFontSize * 0.45;
          ctx.fillStyle = item.color || '#FFFFFF';
          ctx.fillRect(lineStartX, underlineY, textW, Math.max(2, Math.round(scaledFontSize * 0.06)));
        }
      });
    }

    ctx.restore();
  }
}

export interface CompositeOptions {
  photoSrc?: string;
  slotPhotos?: { [slotIndex: number]: string };
  layout?: PhotoboothLayout;
  layoutType?: FrameLayoutType;
  filter: FilterPreset;
  frameUrl?: string;
  withWatermark?: boolean;
  width?: number;
  height?: number;
  decorations?: CustomDecorationItem[];
}

/**
 * Composites single or multi-photo layout with chosen filter and frame overlay onto an offscreen canvas.
 */
export async function renderCompositedPhoto({
  photoSrc,
  slotPhotos,
  layout,
  layoutType,
  filter,
  frameUrl,
  withWatermark = false,
  width: reqWidth,
  height: reqHeight,
  decorations,
}: CompositeOptions): Promise<string> {
  const legacyLayout = layoutType ? getFrameLayout(layoutType) : null;
  const width = reqWidth || layout?.canvas_width || legacyLayout?.canvasWidth || 1080;
  const height = reqHeight || layout?.canvas_height || legacyLayout?.canvasHeight || 1350;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia');

  // 1. Draw base background fill
  ctx.fillStyle = '#11131a';
  ctx.fillRect(0, 0, width, height);

  // 2. Render Photos into Layout Slots
  if (layout && layout.slots && layout.slots.length > 0) {
    // Modern percentage-based layout slots: pixel = (slot.% / 100) * canvas_dimension
    for (const slot of layout.slots) {
      const currentPhotoSrc =
        (slotPhotos && slotPhotos[slot.index]) ||
        (slotPhotos && Object.values(slotPhotos)[slot.index % Object.keys(slotPhotos).length]) ||
        photoSrc;

      if (currentPhotoSrc) {
        try {
          const photoImg = await loadImage(currentPhotoSrc);
          const pixelX = (slot.x / 100) * width;
          const pixelY = (slot.y / 100) * height;
          const pixelW = (slot.width / 100) * width;
          const pixelH = (slot.height / 100) * height;

          ctx.save();
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(pixelX, pixelY, pixelW, pixelH, slot.borderRadius || 6);
          } else {
            ctx.rect(pixelX, pixelY, pixelW, pixelH);
          }
          ctx.clip();

          // Apply Filter
          if (filter.cssFilter && filter.cssFilter !== 'none') {
            ctx.filter = filter.cssFilter;
          }
          drawCoverImage(ctx, photoImg, pixelX, pixelY, pixelW, pixelH);

          // Optional tint
          if (filter.tint) {
            ctx.fillStyle = `rgba(${filter.tint.r}, ${filter.tint.g}, ${filter.tint.b}, ${filter.tint.alpha})`;
            ctx.fillRect(pixelX, pixelY, pixelW, pixelH);
          }
          ctx.restore();
        } catch (slotErr) {
          console.warn(`Gagal memuat foto slot ${slot.index}:`, slotErr);
        }
      }
    }
  } else if (legacyLayout && legacyLayout.slots && legacyLayout.slots.length > 0) {
    // Legacy pixel layout slots
    for (const slot of legacyLayout.slots) {
      const currentPhotoSrc =
        (slotPhotos && slotPhotos[slot.index]) ||
        (slotPhotos && Object.values(slotPhotos)[slot.index % Object.keys(slotPhotos).length]) ||
        photoSrc;

      if (currentPhotoSrc) {
        try {
          const photoImg = await loadImage(currentPhotoSrc);

          ctx.save();
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(slot.x, slot.y, slot.width, slot.height, slot.borderRadius || 8);
          } else {
            ctx.rect(slot.x, slot.y, slot.width, slot.height);
          }
          ctx.clip();

          if (filter.cssFilter && filter.cssFilter !== 'none') {
            ctx.filter = filter.cssFilter;
          }
          drawCoverImage(ctx, photoImg, slot.x, slot.y, slot.width, slot.height);

          if (filter.tint) {
            ctx.fillStyle = `rgba(${filter.tint.r}, ${filter.tint.g}, ${filter.tint.b}, ${filter.tint.alpha})`;
            ctx.fillRect(slot.x, slot.y, slot.width, slot.height);
          }
          ctx.restore();
        } catch (slotErr) {
          console.warn(`Gagal memuat foto legacy slot ${slot.index}:`, slotErr);
        }
      }
    }
  } else if (photoSrc) {
    // Single photo fallback
    const photoImg = await loadImage(photoSrc);
    ctx.save();
    if (filter.cssFilter && filter.cssFilter !== 'none') {
      ctx.filter = filter.cssFilter;
    }
    drawCoverImage(ctx, photoImg, 0, 0, width, height);
    if (filter.tint) {
      ctx.fillStyle = `rgba(${filter.tint.r}, ${filter.tint.g}, ${filter.tint.b}, ${filter.tint.alpha})`;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  // 3. Draw transparent frame overlay
  if (frameUrl) {
    try {
      const frameImg = await loadImage(frameUrl);
      ctx.drawImage(frameImg, 0, 0, width, height);
    } catch (e) {
      console.warn('Gagal memuat frame overlay:', e);
    }
  }

  // 3.5. Draw user custom decorations (texts and emojis)
  if (decorations && decorations.length > 0) {
    drawDecorations(ctx, decorations, width, height);
  }

  // 4. If locked preview (Step 5), draw prominent watermarks
  if (withWatermark) {
    ctx.save();
    
    // Diagonal repeating security watermark lines
    ctx.translate(width / 2, height / 2);
    ctx.rotate((-32 * Math.PI) / 180);
    ctx.translate(-width / 2, -height / 2);

    ctx.font = `700 ${Math.max(16, Math.floor(width / 25))}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const stepY = Math.max(90, Math.floor(height / 12));
    const stepX = Math.max(260, Math.floor(width / 2));
    for (let y = -height; y < height * 2; y += stepY) {
      for (let x = -width; x < width * 2; x += stepX) {
        ctx.fillText('🔒 PREVIEW ONLY • SNAPMOMENT', x, y);
      }
    }
    ctx.restore();

    // Center lock shield badge
    ctx.save();
    const badgeW = Math.min(width - 40, 420);
    const badgeH = 90;
    const badgeX = (width - badgeW) / 2;
    const badgeY = (height - badgeH) / 2;

    ctx.fillStyle = 'rgba(10, 12, 18, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 18);
    } else {
      ctx.rect(badgeX, badgeY, badgeW, badgeH);
    }
    ctx.fill();
    ctx.strokeStyle = '#F59E0B'; // Amber accent
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#F59E0B';
    ctx.font = '800 20px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔒 HASIL TERKUNCI', width / 2, badgeY + 36);

    ctx.fillStyle = '#E5E7EB';
    ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Lakukan checkout untuk cetak & unduh versi HD', width / 2, badgeY + 64);
    ctx.restore();
  }

  // Return base64 JPEG
  return canvas.toDataURL('image/jpeg', withWatermark ? 0.85 : 0.95);
}

/**
 * Triggers a browser download of a data URI as an image file.
 */
export function downloadDataUrl(dataUrl: string, filename = 'photobooth-snap.jpg') {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
