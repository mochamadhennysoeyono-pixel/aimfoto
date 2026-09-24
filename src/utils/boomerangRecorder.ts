/**
 * Utility for capturing, synthesizing, and exporting Instagram-style Boomerang video loops.
 * Records user motion and loops forward & backward (ping-pong) for a 5-second looping video.
 */
import { downloadBoomerangAsMp4 } from './videoDownloadUtils';

/**
 * Detects motion velocity between consecutive frames and trims leading static/frozen frames
 * so the boomerang video begins with active, immediate movement from frame 0!
 */
export function trimInitialStaticFrames(
  frames: HTMLCanvasElement[],
  maxTrimPercent: number = 0.50, // can trim up to 50% if user was holding still
  minFramesToKeep: number = 10
): HTMLCanvasElement[] {
  if (!frames || frames.length <= minFramesToKeep) return frames;

  try {
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 32;
    sampleCanvas.height = 32;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sampleCtx) return frames;

    const getDownsampled = (c: HTMLCanvasElement): Uint8ClampedArray => {
      sampleCtx.drawImage(c, 0, 0, 32, 32);
      return sampleCtx.getImageData(0, 0, 32, 32).data;
    };

    // Precompute downsampled buffers
    const samples: Uint8ClampedArray[] = frames.map((f) => getDownsampled(f));

    // Calculate frame-to-frame motion velocity
    const velocities: number[] = [0];
    let maxVelocity = 0;

    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1];
      const cur = samples[i];
      let diff = 0;
      for (let p = 0; p < cur.length; p += 4) {
        diff +=
          Math.abs(cur[p] - prev[p]) +
          Math.abs(cur[p + 1] - prev[p + 1]) +
          Math.abs(cur[p + 2] - prev[p + 2]);
      }
      const avgDiff = diff / (32 * 32 * 3);
      velocities.push(avgDiff);
      if (avgDiff > maxVelocity) {
        maxVelocity = avgDiff;
      }
    }

    // Motion threshold: at least 20% of max velocity or 0.9 minimum difference
    const motionThreshold = Math.max(0.9, maxVelocity * 0.20);
    const maxTrimCount = Math.floor(frames.length * maxTrimPercent);

    let startIdx = 0;
    for (let i = 1; i <= maxTrimCount; i++) {
      // Find the first frame where active motion kicks off
      if (velocities[i] >= motionThreshold) {
        startIdx = i;
        break;
      }
    }

    if (startIdx > 0 && frames.length - startIdx >= minFramesToKeep) {
      console.log(`[Boomerang] Trimmed ${startIdx} initial static frames for instant motion from frame 0!`);
      return frames.slice(startIdx);
    }
  } catch (err) {
    console.warn('Trim static frames warning:', err);
  }

  return frames;
}

export interface BoomerangCaptureOptions {
  durationMs?: number; // default: 2400ms (2.4s burst for full natural motion)
  targetFps?: number;  // default: 24 fps
  facingMode?: 'user' | 'environment';
  width?: number;      // default: 720
  height?: number;     // default: 720 (square aspect matching photobooth)
  onProgress?: (progressPercent: number) => void;
  renderOverlay?: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

export interface BoomerangResult {
  videoBlob: Blob | null;
  videoUrl: string; // Object URL or Data URL playable in <video>
  previewDataUrl: string; // First frame for thumbnail
  frameCount: number;
  durationSec: number;
}

/**
 * Capture raw frames from an active HTMLVideoElement over the duration.
 */
export async function captureBoomerangFrames(
  video: HTMLVideoElement,
  options: BoomerangCaptureOptions = {}
): Promise<{ frames: HTMLCanvasElement[]; previewDataUrl: string }> {
  const durationMs = options.durationMs || 2400;
  const targetFps = options.targetFps || 24;
  const facingMode = options.facingMode || 'user';
  const width = options.width || 720;
  const height = options.height || 720;

  const frameIntervalMs = 1000 / targetFps;
  const totalExpectedFrames = Math.round(durationMs / frameIntervalMs);

  const frames: HTMLCanvasElement[] = [];
  const startTime = performance.now();

  // Create temporary offscreen canvas for frame capture
  const getFrameCanvas = (): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    return { canvas: c, ctx };
  };

  return new Promise((resolve) => {
    let lastCaptureTime = 0;

    const captureInterval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - startTime;

      if (elapsed >= durationMs || frames.length >= totalExpectedFrames) {
        clearInterval(captureInterval);

        // Auto trim any initial motionless frames if user was holding still at countdown 0
        const activeFrames = trimInitialStaticFrames(frames);
        const previewDataUrl = activeFrames[0] ? activeFrames[0].toDataURL('image/jpeg', 0.85) : '';
        if (options.onProgress) options.onProgress(100);
        resolve({ frames: activeFrames, previewDataUrl });
        return;
      }

      if (now - lastCaptureTime >= frameIntervalMs) {
        lastCaptureTime = now;

        const { canvas, ctx } = getFrameCanvas();
        const vw = video.videoWidth || width;
        const vh = video.videoHeight || height;

        // Crop center matching destination aspect ratio (width:height)
        const targetAspect = width / height;
        const videoAspect = vw / vh;
        let cropW = vw;
        let cropH = vh;
        if (videoAspect > targetAspect) {
          cropW = vh * targetAspect;
          cropH = vh;
        } else {
          cropW = vw;
          cropH = vw / targetAspect;
        }
        const sx = (vw - cropW) / 2;
        const sy = (vh - cropH) / 2;

        ctx.save();
        if (facingMode === 'user') {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, width, height);
        ctx.restore();

        // Optional AR filter overlay
        if (options.renderOverlay) {
          options.renderOverlay(ctx, width, height);
        }

        frames.push(canvas);

        if (options.onProgress) {
          const pct = Math.min(95, Math.round((elapsed / durationMs) * 100));
          options.onProgress(pct);
        }
      }
    }, Math.max(16, Math.floor(frameIntervalMs / 2)));
  });
}

/**
 * Synthesize captured frames into a forward-reverse (ping-pong) video loop with 5-second duration.
 */
export async function compilePingPongVideo(
  frames: HTMLCanvasElement[],
  previewDataUrl: string,
  targetDurationSecOrLoops: number = 6,
  customFps?: number
): Promise<BoomerangResult> {
  if (!frames || frames.length === 0) {
    throw new Error('Tidak ada frame boomerang yang ditangkap');
  }

  const width = frames[0].width;
  const height = frames[0].height;
  const fps = customFps || 24;

  // Target duration for the video loop: default to 6.0 seconds
  const targetDurationSec = targetDurationSecOrLoops >= 6 ? targetDurationSecOrLoops : 6.0;
  const targetDurationMs = targetDurationSec * 1000;
  const n = frames.length;

  // Check MediaRecorder support
  const hasMediaRecorder = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';
  const renderCanvas = document.createElement('canvas');
  renderCanvas.width = width;
  renderCanvas.height = height;
  const ctx = renderCanvas.getContext('2d')!;

  if (!hasMediaRecorder || !renderCanvas.captureStream) {
    // Fallback: Return first frame thumbnail as placeholder
    return {
      videoBlob: null,
      videoUrl: previewDataUrl,
      previewDataUrl,
      frameCount: Math.round(targetDurationSec * fps),
      durationSec: targetDurationSec,
    };
  }

  // Determine supported mimeType - prioritize MP4 (H.264/AVC1)
  const candidateTypes = [
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
  for (const t of candidateTypes) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
      mimeType = t;
      break;
    }
  }

  const stream = renderCanvas.captureStream(fps);
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

      resolve({
        videoBlob: finalBlob,
        videoUrl,
        previewDataUrl,
        frameCount: Math.round(targetDurationSec * fps),
        durationSec: targetDurationSec,
      });
    };

    recorder.onerror = (err) => {
      console.warn('Boomerang recorder error:', err);
      // Fallback
      resolve({
        videoBlob: null,
        videoUrl: previewDataUrl,
        previewDataUrl,
        frameCount: Math.round(targetDurationSec * fps),
        durationSec: targetDurationSec,
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

        if (elapsed >= targetDurationMs) {
          finishRecording();
          return;
        }

        // Frame index sinkron dengan MediaRecorder clock
        const currentFrameIdx = Math.floor((elapsed / 1000) * fps);

        if (currentFrameIdx !== lastRenderedFrame) {
          lastRenderedFrame = currentFrameIdx;

          // Ping-pong langsung dari frame 0 secara kontinu dari awal (0s) sampai akhir (6s)
          let frameIndex = 0;
          if (n > 1) {
            const speedMultiplier = 2.2; // Gerak sangat lincah, aktif & snappy Instagram Boomerang
            const effectiveStep = Math.floor(currentFrameIdx * speedMultiplier);
            const cycle = 2 * (n - 1);
            const pos = effectiveStep % cycle;
            frameIndex = pos < n ? pos : cycle - pos;
          }

          const srcCanvas = frames[frameIndex] || frames[0];
          if (srcCanvas) {
            ctx.drawImage(srcCanvas, 0, 0, width, height);
          }
        }

        requestAnimationFrame(renderLoop);
      };

      // Draw initial frame segera di detik ke-0
      const initialFrame = frames[0];
      if (initialFrame) {
        ctx.drawImage(initialFrame, 0, 0, width, height);
      }
      lastRenderedFrame = 0;
      requestAnimationFrame(renderLoop);
    } catch (startErr) {
      console.warn('Failed to start MediaRecorder:', startErr);
      resolve({
        videoBlob: null,
        videoUrl: previewDataUrl,
        previewDataUrl,
        frameCount: Math.round(targetDurationSec * fps),
        durationSec: targetDurationSec,
      });
    }
  });
}

/**
 * Synthesize an animated ping-pong Boomerang loop video from an array of static photo URLs.
 * Guarantees that every session has a downloadable Boomerang video even if live video recording was skipped.
 */
export async function generateBoomerangFromPhotos(
  photoUrls: string[],
  size = 720
): Promise<BoomerangResult> {
  if (!photoUrls || photoUrls.length === 0) {
    throw new Error('Tidak ada foto untuk membuat Boomerang');
  }

  // Load all images
  const loadedImages: HTMLImageElement[] = await Promise.all(
    photoUrls.map((url) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img); // resolve anyway to avoid breaking
        img.src = url;
      });
    })
  );

  const validImages = loadedImages.filter((img) => img.width > 0 && img.height > 0);
  if (validImages.length === 0) {
    throw new Error('Gagal memuat gambar foto');
  }

  const frames: HTMLCanvasElement[] = [];
  const totalFrames = 24; // ~1-1.5 second loop

  for (let f = 0; f < totalFrames; f++) {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d')!;

    // Background dark
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    if (validImages.length > 1) {
      // Multiple photos: cycle through photos with smooth dynamic punch
      const photoIndex = Math.floor((f / totalFrames) * validImages.length) % validImages.length;
      const img = validImages[photoIndex];

      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      // Slight rhythmic pulse
      const pulse = 1.0 + Math.sin((f / totalFrames) * Math.PI * 2) * 0.04;
      const drawSize = size * pulse;
      const offset = (size - drawSize) / 2;

      ctx.drawImage(img, sx, sy, minDim, minDim, offset, offset, drawSize, drawSize);
    } else {
      // Single photo: zoom in-out pulse (Ken Burns dynamic bounce)
      const img = validImages[0];
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      const progress = f / totalFrames;
      const zoom = 1.0 + Math.sin(progress * Math.PI) * 0.12;
      const drawSize = size * zoom;
      const offset = (size - drawSize) / 2;

      ctx.drawImage(img, sx, sy, minDim, minDim, offset, offset, drawSize, drawSize);
    }

    // Subtle branding badge overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(16, size - 44, 180, 28, 14);
    ctx.fill();

    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('⚡ BOOMERANG LOOP', 28, size - 26);

    frames.push(c);
  }

  return compilePingPongVideo(frames, photoUrls[0], 6, 24);
}

/**
 * Trigger immediate download of the Boomerang video file to the user's device in MP4 format.
 */
export function downloadBoomerang(videoUrlOrBlob: string | Blob, filename = 'boomerang.mp4') {
  downloadBoomerangAsMp4(videoUrlOrBlob, filename).catch((err) => {
    console.warn('downloadBoomerang error:', err);
  });
}
