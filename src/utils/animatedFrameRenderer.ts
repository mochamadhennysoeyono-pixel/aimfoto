import {
  FilterPreset,
  PhotoboothLayout,
  CustomDecorationItem,
  SlotAdjustmentsMap,
} from '../types';
import {
  loadImage,
  drawCoverImage,
  drawDecorations,
  applyVignetteToRect,
} from './canvasRenderer';

/**
 * In-memory global session cache to store raw canvas frames captured from camera.
 * Key: slotIndex (number) -> HTMLCanvasElement[]
 */
export const sessionBoomerangFramesCache = new Map<number, HTMLCanvasElement[]>();

export function clearBoomerangFramesCache() {
  sessionBoomerangFramesCache.clear();
}

export function storeSlotBoomerangFrames(slotIndex: number, frames: HTMLCanvasElement[]) {
  sessionBoomerangFramesCache.set(slotIndex, frames);
}

export function getSlotBoomerangFrames(slotIndex: number): HTMLCanvasElement[] | undefined {
  return sessionBoomerangFramesCache.get(slotIndex);
}

/**
 * Extracts a sequence of frames from an HTML5 video URL using a hidden video element.
 * Includes safety timeouts and checks for non-finite durations (e.g. MediaRecorder WebM blobs).
 */
export async function extractFramesFromVideoUrl(
  videoUrl: string,
  frameCount: number = 24
): Promise<HTMLCanvasElement[]> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.src = videoUrl;

    const frames: HTMLCanvasElement[] = [];
    let isResolved = false;

    const finish = () => {
      if (!isResolved) {
        isResolved = true;
        resolve(frames);
      }
    };

    // Safety timeout: Never hang longer than 4 seconds
    const safetyTimer = setTimeout(() => {
      finish();
    }, 4000);

    video.onloadedmetadata = async () => {
      let duration = video.duration;
      if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
        duration = 2.4; // Fallback sensible default duration for WebM blobs
      }
      const vW = video.videoWidth || 640;
      const vH = video.videoHeight || 640;
      const interval = duration / frameCount;

      for (let i = 0; i < frameCount; i++) {
        const time = Math.max(0, Math.min(i * interval, duration - 0.04));
        video.currentTime = time;

        await new Promise<void>((res) => {
          let seekedDone = false;
          const onSeek = () => {
            if (!seekedDone) {
              seekedDone = true;
              video.removeEventListener('seeked', onSeek);
              res();
            }
          };
          video.addEventListener('seeked', onSeek);
          setTimeout(onSeek, 150); // Timeout each frame seek after 150ms max
        });

        const c = document.createElement('canvas');
        c.width = vW;
        c.height = vH;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, vW, vH);
          frames.push(c);
        }
      }

      clearTimeout(safetyTimer);
      finish();
    };

    video.onerror = () => {
      console.warn('Gagal memuat video untuk ekstraksi frame:', videoUrl);
      clearTimeout(safetyTimer);
      finish();
    };

    video.load();
  });
}

/**
 * Calculates seamless ping-pong index for time step `t` across `n` frames:
 * 0, 1, 2, ..., n-1, n-2, ..., 1, 0, 1, ...
 */
export function getPingPongIndex(t: number, n: number): number {
  if (n <= 1) return 0;
  const cycle = 2 * (n - 1);
  const pos = t % cycle;
  return pos < n ? pos : cycle - pos;
}

export interface CompositedFrameRenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  layout?: PhotoboothLayout;
  filter: FilterPreset;
  frameImg: HTMLImageElement | null;
  decorations?: CustomDecorationItem[];
  slotAdjustments?: SlotAdjustmentsMap;
  staticPhotos: { [slotIndex: number]: HTMLImageElement };
  slotBoomerangFrames: { [slotIndex: number]: HTMLCanvasElement[] };
  withWatermark?: boolean;
}

/**
 * Prepares and preloads all static images and video frames for animated frame rendering.
 */
export async function prepareCompositedFrameContext(options: {
  layout?: PhotoboothLayout;
  slotPhotos: { [slotIndex: number]: string };
  capturedPhotos?: string[];
  slotBoomerangs?: { [slotIndex: number]: string };
  slotAdjustments?: SlotAdjustmentsMap;
  filter: FilterPreset;
  frameUrl?: string;
  decorations?: CustomDecorationItem[];
  withWatermark?: boolean;
  width?: number;
  height?: number;
}): Promise<CompositedFrameRenderContext> {
  const width = options.width || options.layout?.canvas_width || 1080;
  const height = options.height || options.layout?.canvas_height || 1350;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // 1. Preload static photos
  const staticPhotos: { [slotIndex: number]: HTMLImageElement } = {};
  if (options.layout?.slots && options.layout.slots.length > 0) {
    for (let sIdx = 0; sIdx < options.layout.slots.length; sIdx++) {
      const slot = options.layout.slots[sIdx];
      const actualSlotIndex = slot.index !== undefined && slot.index !== null ? Number(slot.index) : sIdx;
      const photoSrc =
        (options.slotPhotos && options.slotPhotos[actualSlotIndex]) ||
        (options.slotPhotos && options.slotPhotos[sIdx]) ||
        (options.capturedPhotos && options.capturedPhotos[sIdx]);

      if (photoSrc) {
        try {
          const img = await loadImage(photoSrc);
          staticPhotos[actualSlotIndex] = img;
          staticPhotos[sIdx] = img;
        } catch (err) {
          console.warn(`Gagal memuat foto statis slot ${sIdx}:`, err);
        }
      }
    }
  } else {
    for (const [slotKey, photoSrc] of Object.entries(options.slotPhotos || {})) {
      const slotIdx = Number(slotKey);
      if (photoSrc) {
        try {
          staticPhotos[slotIdx] = await loadImage(photoSrc);
        } catch (err) {
          console.warn(`Gagal memuat foto statis slot ${slotIdx}:`, err);
        }
      }
    }
  }

  // 2. Preload/prepare boomerang frames per slot
  const slotBoomerangFrames: { [slotIndex: number]: HTMLCanvasElement[] } = {};
  if (options.layout?.slots && options.layout.slots.length > 0) {
    for (let sIdx = 0; sIdx < options.layout.slots.length; sIdx++) {
      const slot = options.layout.slots[sIdx];
      const actualSlotIndex = slot.index !== undefined && slot.index !== null ? Number(slot.index) : sIdx;

      // Determine which captured photo is currently placed in this slot
      const assignedPhoto =
        (options.slotPhotos ? options.slotPhotos[actualSlotIndex] : undefined) ||
        (options.slotPhotos ? options.slotPhotos[sIdx] : undefined);

      let targetPhotoIdx = sIdx;
      if (assignedPhoto && options.capturedPhotos && options.capturedPhotos.length > 0) {
        const found = options.capturedPhotos.indexOf(assignedPhoto);
        if (found >= 0) {
          targetPhotoIdx = found;
        }
      }

      // Check in-memory cache for this specific captured shot index
      let cached = sessionBoomerangFramesCache.get(targetPhotoIdx);

      if (cached && cached.length > 0) {
        slotBoomerangFrames[actualSlotIndex] = cached;
        slotBoomerangFrames[sIdx] = cached;
      } else if (options.slotBoomerangs) {
        // Extract from video URL if available in slotBoomerangs map for this shot
        const videoUrl = options.slotBoomerangs[targetPhotoIdx] || options.slotBoomerangs[sIdx];

        if (videoUrl && videoUrl.trim() !== '') {
          try {
            const extracted = await extractFramesFromVideoUrl(videoUrl, 24);
            if (extracted.length > 0) {
              slotBoomerangFrames[actualSlotIndex] = extracted;
              slotBoomerangFrames[sIdx] = extracted;
            }
          } catch (extErr) {
            console.warn(`Gagal ekstraksi frame video slot ${sIdx}:`, extErr);
          }
        }
      }
    }
  }

  // 3. Preload Frame Overlay Image
  let frameImg: HTMLImageElement | null = null;
  if (options.frameUrl) {
    try {
      frameImg = await loadImage(options.frameUrl);
    } catch (e) {
      console.warn('Gagal memuat frame overlay:', e);
    }
  }

  return {
    canvas,
    ctx,
    width,
    height,
    layout: options.layout,
    filter: options.filter,
    frameImg,
    decorations: options.decorations,
    slotAdjustments: options.slotAdjustments,
    staticPhotos,
    slotBoomerangFrames,
    withWatermark: options.withWatermark,
  };
}

/**
 * Draws one single animation frame (at time step t) of the entire photobooth frame!
 */
export function drawSingleAnimatedFrame(
  renderCtx: CompositedFrameRenderContext,
  timeStep: number
) {
  const {
    ctx,
    width,
    height,
    layout,
    filter,
    frameImg,
    decorations,
    slotAdjustments,
    staticPhotos,
    slotBoomerangFrames,
    withWatermark,
  } = renderCtx;

  // 1. Draw base canvas background
  ctx.fillStyle = '#11131a';
  ctx.fillRect(0, 0, width, height);

  // 2. Render each slot
  if (layout && layout.slots && layout.slots.length > 0) {
    for (let sIdx = 0; sIdx < layout.slots.length; sIdx++) {
      const slot = layout.slots[sIdx];
      const actualSlotIndex = slot.index !== undefined && slot.index !== null ? Number(slot.index) : sIdx;

      // Coordinate calculation: percentage vs absolute pixels
      const isPercent = slot.width <= 100 && slot.height <= 100;
      const baseCanvasW = layout.canvas_width || width;
      const baseCanvasH = layout.canvas_height || height;

      const pixelX = isPercent ? (slot.x / 100) * width : (slot.x / baseCanvasW) * width;
      const pixelY = isPercent ? (slot.y / 100) * height : (slot.y / baseCanvasH) * height;
      const pixelW = isPercent ? (slot.width / 100) * width : (slot.width / baseCanvasW) * width;
      const pixelH = isPercent ? (slot.height / 100) * height : (slot.height / baseCanvasH) * height;

      // Check if this slot has Boomerang frames
      const bFrames = slotBoomerangFrames[actualSlotIndex] || slotBoomerangFrames[sIdx];
      const hasBoomerang = bFrames && bFrames.length > 0;

      // Source image: either the active ping-pong frame or the static photo
      let sourceDrawable: HTMLCanvasElement | HTMLImageElement | null = null;
      if (hasBoomerang) {
        const pingPongIdx = getPingPongIndex(timeStep, bFrames.length);
        sourceDrawable = bFrames[pingPongIdx];
      } else {
        sourceDrawable =
          staticPhotos[actualSlotIndex] ||
          staticPhotos[sIdx] ||
          null;
      }

      if (sourceDrawable) {
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(pixelX, pixelY, pixelW, pixelH, slot.borderRadius || 6);
        } else {
          ctx.rect(pixelX, pixelY, pixelW, pixelH);
        }
        ctx.clip();

        // Apply CSS Filter
        if (filter.cssFilter && filter.cssFilter !== 'none') {
          ctx.filter = filter.cssFilter;
        }

        const adj = slotAdjustments ? (slotAdjustments[actualSlotIndex] || slotAdjustments[sIdx]) : undefined;
        drawCoverImage(ctx, sourceDrawable, pixelX, pixelY, pixelW, pixelH, adj);

        // Filter Tint
        if (filter.tint) {
          ctx.fillStyle = `rgba(${filter.tint.r}, ${filter.tint.g}, ${filter.tint.b}, ${filter.tint.alpha})`;
          ctx.fillRect(pixelX, pixelY, pixelW, pixelH);
        }

        // Vignette
        if (filter.vignette) {
          applyVignetteToRect(ctx, pixelX, pixelY, pixelW, pixelH, filter.vignette);
        }

        ctx.restore();
      }
    }
  }

  // 3. Draw Transparent Frame Overlay
  if (frameImg) {
    ctx.drawImage(frameImg, 0, 0, width, height);
  }

  // 4. Draw Custom Decorations (Stickers & Text)
  if (decorations && decorations.length > 0) {
    drawDecorations(ctx, decorations, width, height);
  }

  // 5. Watermark (if requested)
  if (withWatermark) {
    ctx.save();
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
  }
}

export interface CompileAnimatedFrameResult {
  videoBlob: Blob | null;
  videoUrl: string;
  previewDataUrl: string;
  durationSec: number;
}

/**
 * Compiles the entire photobooth frame into a high-definition looping MP4/WebM video.
 * Slots with Boomerang animate continuously in ping-pong motion,
 * while slots without Boomerang remain as still photos inside the exact same frame!
 */
export async function compileCompositedAnimatedFrameVideo(options: {
  layout?: PhotoboothLayout;
  slotPhotos: { [slotIndex: number]: string };
  capturedPhotos?: string[];
  slotBoomerangs?: { [slotIndex: number]: string };
  slotAdjustments?: SlotAdjustmentsMap;
  filter: FilterPreset;
  frameUrl?: string;
  decorations?: CustomDecorationItem[];
  withWatermark?: boolean;
  totalDurationMs?: number; // default: 5000ms (5 detik)
  fps?: number; // default: 24 fps
  scaleDownWidth?: number; // default: 720 (optimal for quick mobile render & crystal clear video)
  onProgress?: (progressPercent: number) => void;
}): Promise<CompileAnimatedFrameResult> {
  const fps = options.fps || 24;
  const durationMs = options.totalDurationMs || 5000;
  const totalFrames = Math.round((durationMs / 1000) * fps);

  const baseW = options.layout?.canvas_width || 1080;
  const baseH = options.layout?.canvas_height || 1350;
  const targetW = options.scaleDownWidth || 720;
  const targetH = Math.round((baseH / baseW) * targetW);

  if (options.onProgress) options.onProgress(10);

  const renderCtx = await prepareCompositedFrameContext({
    layout: options.layout,
    slotPhotos: options.slotPhotos,
    capturedPhotos: options.capturedPhotos,
    slotBoomerangs: options.slotBoomerangs,
    slotAdjustments: options.slotAdjustments,
    filter: options.filter,
    frameUrl: options.frameUrl,
    decorations: options.decorations,
    withWatermark: options.withWatermark,
    width: targetW,
    height: targetH,
  });

  if (options.onProgress) options.onProgress(30);

  // First frame preview thumbnail
  drawSingleAnimatedFrame(renderCtx, 0);
  const previewDataUrl = renderCtx.canvas.toDataURL('image/jpeg', 0.88);

  const hasMediaRecorder = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';
  if (!hasMediaRecorder || !renderCtx.canvas.captureStream) {
    return {
      videoBlob: null,
      videoUrl: previewDataUrl,
      previewDataUrl,
      durationSec: durationMs / 1000,
    };
  }

  // Determine supported mimeType (VP9 / VP8 / MP4)
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/mp4';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = '';
  }

  const stream = renderCtx.canvas.captureStream(fps);
  const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
  const recorder = new MediaRecorder(stream, recorderOptions);

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise((resolve) => {
    recorder.onstop = () => {
      const finalBlob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const videoUrl = URL.createObjectURL(finalBlob);

      if (options.onProgress) options.onProgress(100);
      resolve({
        videoBlob: finalBlob,
        videoUrl,
        previewDataUrl,
        durationSec: durationMs / 1000,
      });
    };

    recorder.onerror = (err) => {
      console.warn('Animated Frame MediaRecorder error:', err);
      resolve({
        videoBlob: null,
        videoUrl: previewDataUrl,
        previewDataUrl,
        durationSec: durationMs / 1000,
      });
    };

    try {
      recorder.start();

      let frameIdx = 0;
      const frameInterval = 1000 / fps;

      const renderNext = () => {
        if (frameIdx >= totalFrames) {
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop();
            }
          }, 120);
          return;
        }

        drawSingleAnimatedFrame(renderCtx, frameIdx);

        if (options.onProgress) {
          const pct = 30 + Math.round((frameIdx / totalFrames) * 65);
          options.onProgress(pct);
        }

        frameIdx++;
        setTimeout(renderNext, frameInterval);
      };

      renderNext();
    } catch (startErr) {
      console.warn('Failed to start MediaRecorder for animated frame:', startErr);
      resolve({
        videoBlob: null,
        videoUrl: previewDataUrl,
        previewDataUrl,
        durationSec: durationMs / 1000,
      });
    }
  });
}
