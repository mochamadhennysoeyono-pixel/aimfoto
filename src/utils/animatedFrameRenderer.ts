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
import { trimInitialStaticFrames } from './boomerangRecorder';

/**
 * In-memory global session cache to store raw canvas frames captured from camera.
 * Key: slotIndex (number) -> HTMLCanvasElement[]
 */
export const sessionBoomerangFramesCache = new Map<number, HTMLCanvasElement[]>();

export function clearBoomerangFramesCache() {
  sessionBoomerangFramesCache.clear();
}

export function clearSlotBoomerangFrames(slotIndex?: number) {
  if (slotIndex !== undefined) {
    sessionBoomerangFramesCache.delete(slotIndex);
  } else {
    sessionBoomerangFramesCache.clear();
  }
}

export function storeSlotBoomerangFrames(slotIndex: number, frames: HTMLCanvasElement[]) {
  sessionBoomerangFramesCache.set(slotIndex, frames);
}

export function getSlotBoomerangFrames(slotIndex: number): HTMLCanvasElement[] | undefined {
  return sessionBoomerangFramesCache.get(slotIndex);
}

/**
 * Extracts a sequence of frames from an HTML5 video URL using precise seeked timestamps.
 * Guarantees every single extracted frame is at a distinct timestamp without initial freezing!
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
    video.preload = 'auto';
    video.src = videoUrl;

    const frames: HTMLCanvasElement[] = [];
    let isResolved = false;

    const finish = () => {
      if (!isResolved) {
        isResolved = true;
        // Trim any dead/static initial frames so loop starts moving immediately
        resolve(trimInitialStaticFrames(frames));
      }
    };

    // Safety timeout
    const safetyTimer = setTimeout(() => {
      finish();
    }, 6000);

    video.onloadedmetadata = () => {
      let duration = video.duration;
      if (!isFinite(duration) || isNaN(duration) || duration <= 0) {
        duration = 6.0; // Standard 6.0s duration
      }
      const vW = video.videoWidth || 640;
      const vH = video.videoHeight || 640;

      const captureFrame = () => {
        const c = document.createElement('canvas');
        c.width = vW;
        c.height = vH;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, vW, vH);
          frames.push(c);
        }
      };

      // Extract frames at distinct, evenly-spaced timestamps:
      // t = 0.05s, 0.05 + dt, 0.05 + 2*dt, ...
      const usableDuration = Math.max(0.5, duration - 0.1);
      const step = usableDuration / Math.max(1, frameCount);
      let stepIndex = 0;

      const seekNext = () => {
        if (stepIndex >= frameCount) {
          clearTimeout(safetyTimer);
          finish();
          return;
        }

        const targetTime = Math.min(usableDuration, 0.05 + stepIndex * step);
        video.currentTime = targetTime;
      };

      video.onseeked = () => {
        captureFrame();
        stepIndex++;
        seekNext();
      };

      // Start sequential seek
      seekNext();
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
 * Uses speedMultiplier so the loop action starts briskly from the very first frames.
 */
export function getPingPongIndex(t: number, n: number, speedMultiplier: number = 2.2): number {
  if (n <= 1) return 0;
  const effectiveT = Math.floor(t * speedMultiplier);
  const cycle = 2 * (n - 1);
  const pos = effectiveT % cycle;
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

      // Determine if this specific slot or photo has an actual Boomerang recording
      const slotClipUrl =
        options.slotBoomerangs
          ? options.slotBoomerangs[targetPhotoIdx] ||
            options.slotBoomerangs[actualSlotIndex] ||
            options.slotBoomerangs[sIdx]
          : undefined;
      const hasSlotClipUrl = Boolean(slotClipUrl && slotClipUrl.trim() !== '');

      // Check strictly in-memory cache for this specific slot's captured shot
      let cached = sessionBoomerangFramesCache.get(targetPhotoIdx);
      if (!cached && sessionBoomerangFramesCache.has(actualSlotIndex)) {
        cached = sessionBoomerangFramesCache.get(actualSlotIndex);
      }

      // DO NOT fallback or share frames from other slots! Each slot must reflect its own content.
      if (cached && cached.length > 0) {
        slotBoomerangFrames[actualSlotIndex] = cached;
        slotBoomerangFrames[sIdx] = cached;
      } else if (hasSlotClipUrl && slotClipUrl) {
        try {
          const extracted = await extractFramesFromVideoUrl(slotClipUrl, 24);
          if (extracted.length > 0) {
            slotBoomerangFrames[actualSlotIndex] = extracted;
            slotBoomerangFrames[sIdx] = extracted;
          }
        } catch (extErr) {
          console.warn(`Gagal ekstraksi frame video slot ${sIdx}:`, extErr);
        }
      } else {
        // STRICTLY a normal static photo: do NOT assign any boomerang frames
        delete slotBoomerangFrames[actualSlotIndex];
        delete slotBoomerangFrames[sIdx];
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

      // Check if this slot has Boomerang frames
      const bFrames = slotBoomerangFrames[actualSlotIndex] || slotBoomerangFrames[sIdx];
      const hasBoomerang = bFrames && bFrames.length > 0;

      // Source image: either the active ping-pong frame or the static photo
      let sourceDrawable: HTMLCanvasElement | HTMLImageElement | null = null;
      if (hasBoomerang) {
        const pingPongIdx = getPingPongIndex(timeStep, bFrames.length, 2.2);
        sourceDrawable = bFrames[pingPongIdx] || bFrames[0];
      } else {
        sourceDrawable =
          staticPhotos[actualSlotIndex] ||
          staticPhotos[sIdx] ||
          null;
      }

      if (sourceDrawable) {
        const adj = slotAdjustments ? (slotAdjustments[actualSlotIndex] || slotAdjustments[sIdx]) : undefined;
        const naturalW = (sourceDrawable as HTMLImageElement).naturalWidth || (sourceDrawable as HTMLCanvasElement).width || 720;
        const naturalH = (sourceDrawable as HTMLImageElement).naturalHeight || (sourceDrawable as HTMLCanvasElement).height || 720;
        const imgAspect = (naturalW && naturalH) ? naturalW / naturalH : 1.0;
        const canvasAspect = width / height;

        const isLandscape = width >= height;
        let baseW = adj?.width !== undefined ? adj.width : slot.width;
        if (!baseW) {
          if (layout.slots.length === 1) baseW = 84;
          else if (layout.slots.length === 2) baseW = isLandscape ? 44 : 76;
          else if (layout.slots.length <= 4) baseW = isLandscape ? 38 : 44;
          else baseW = isLandscape ? 28 : 40;
        }

        const baseH = (baseW * canvasAspect) / imgAspect;
        const zoom = Math.max(0.5, Math.min(2.5, adj?.zoom ?? 1));

        const finalW = baseW * zoom;
        const finalH = baseH * zoom;

        const posX = adj?.x !== undefined ? adj.x : slot.x;
        const posY = adj?.y !== undefined ? adj.y : slot.y;

        const pixelX = (posX / 100) * width;
        const pixelY = (posY / 100) * height;
        const pixelW = (finalW / 100) * width;
        const pixelH = (finalH / 100) * height;

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

        ctx.drawImage(sourceDrawable, pixelX, pixelY, pixelW, pixelH);

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
  totalDurationMs?: number; // default: 6000ms (6 detik)
  fps?: number; // default: 24 fps
  scaleDownWidth?: number; // default: 720 (optimal for quick mobile render & crystal clear video)
  onProgress?: (progressPercent: number) => void;
}): Promise<CompileAnimatedFrameResult> {
  const fps = options.fps || 24;
  const durationMs = options.totalDurationMs || 6000;
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

  // Prioritaskan format MP4 (H.264/AVC1) agar hasil video langsung berformat .mp4
  const preferredMimeTypes = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/webm;codecs=h264',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  let mimeType = '';
  for (const t of preferredMimeTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
      mimeType = t;
      break;
    }
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
      const finalMime = mimeType && mimeType.startsWith('video/mp4') ? 'video/mp4' : (mimeType || 'video/mp4');
      const finalBlob = new Blob(chunks, { type: finalMime });
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

      const startTime = performance.now();
      let lastRenderedFrame = -1;
      let isStopped = false;

      const finishRecording = () => {
        if (isStopped) return;
        isStopped = true;
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      };

      const renderLoop = () => {
        if (isStopped) return;

        const now = performance.now();
        const elapsed = now - startTime;

        if (elapsed >= durationMs) {
          finishRecording();
          return;
        }

        // Hitung frame index berdasarkan elapsed time nyata (sinkron dengan MediaRecorder clock)
        const currentFrameIdx = Math.floor((elapsed / 1000) * fps);

        if (currentFrameIdx !== lastRenderedFrame) {
          lastRenderedFrame = currentFrameIdx;
          drawSingleAnimatedFrame(renderCtx, currentFrameIdx);

          if (options.onProgress) {
            const pct = 30 + Math.min(68, Math.round((elapsed / durationMs) * 65));
            options.onProgress(pct);
          }
        }

        requestAnimationFrame(renderLoop);
      };

      // Gambar frame awal segera
      drawSingleAnimatedFrame(renderCtx, 0);
      lastRenderedFrame = 0;
      requestAnimationFrame(renderLoop);
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
