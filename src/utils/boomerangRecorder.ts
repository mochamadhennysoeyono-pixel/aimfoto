/**
 * Utility for capturing, synthesizing, and exporting Instagram-style Boomerang video loops.
 * Records user motion and loops forward & backward (ping-pong) for a 5-second looping video.
 */

export interface BoomerangCaptureOptions {
  durationMs?: number; // default: 2000ms
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
  const durationMs = options.durationMs || 2000;
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

        const previewDataUrl = frames[0] ? frames[0].toDataURL('image/jpeg', 0.85) : '';
        if (options.onProgress) options.onProgress(100);
        resolve({ frames, previewDataUrl });
        return;
      }

      if (now - lastCaptureTime >= frameIntervalMs) {
        lastCaptureTime = now;

        const { canvas, ctx } = getFrameCanvas();
        const vw = video.videoWidth || width;
        const vh = video.videoHeight || height;

        // Crop center square
        const minDim = Math.min(vw, vh);
        const sx = (vw - minDim) / 2;
        const sy = (vh - minDim) / 2;

        ctx.save();
        if (facingMode === 'user') {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, width, height);
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
  targetDurationSecOrLoops: number = 5,
  customFps?: number
): Promise<BoomerangResult> {
  if (!frames || frames.length === 0) {
    throw new Error('Tidak ada frame boomerang yang ditangkap');
  }

  const width = frames[0].width;
  const height = frames[0].height;
  const fps = customFps || 24;

  // Target duration for the video loop: default to 5.0 seconds
  const targetDurationSec = targetDurationSecOrLoops >= 5 ? targetDurationSecOrLoops : 5.0;
  const targetTotalFrames = Math.max(fps, Math.round(targetDurationSec * fps)); // 120 frames at 24fps

  // Build ping-pong frame index sequence up to targetTotalFrames:
  // Forward: 0, 1, ..., N-1
  // Reverse: N-2, N-3, ..., 1
  const pingPongSequence: number[] = [];
  const n = frames.length;

  if (n <= 1) {
    for (let i = 0; i < targetTotalFrames; i++) {
      pingPongSequence.push(0);
    }
  } else {
    let forward = true;
    let currentIdx = 0;
    while (pingPongSequence.length < targetTotalFrames) {
      pingPongSequence.push(currentIdx);
      if (forward) {
        if (currentIdx >= n - 1) {
          forward = false;
          currentIdx = n - 2;
        } else {
          currentIdx++;
        }
      } else {
        if (currentIdx <= 0) {
          forward = true;
          currentIdx = 1;
        } else {
          currentIdx--;
        }
      }
    }
  }

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
      frameCount: pingPongSequence.length,
      durationSec: targetDurationSec,
    };
  }

  // Determine supported mimeType
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
    mimeType = ''; // Let browser pick default
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
      const finalBlob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const videoUrl = URL.createObjectURL(finalBlob);

      resolve({
        videoBlob: finalBlob,
        videoUrl,
        previewDataUrl,
        frameCount: pingPongSequence.length,
        durationSec: pingPongSequence.length / fps,
      });
    };

    recorder.onerror = (err) => {
      console.warn('Boomerang recorder error:', err);
      // Fallback
      resolve({
        videoBlob: null,
        videoUrl: previewDataUrl,
        previewDataUrl,
        frameCount: pingPongSequence.length,
        durationSec: pingPongSequence.length / fps,
      });
    };

    try {
      recorder.start();

      let seqIdx = 0;
      const frameDelay = 1000 / fps;

      const drawNext = () => {
        if (seqIdx >= pingPongSequence.length) {
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop();
            }
          }, 100);
          return;
        }

        const frameIndex = pingPongSequence[seqIdx];
        const srcCanvas = frames[frameIndex];
        if (srcCanvas) {
          ctx.drawImage(srcCanvas, 0, 0, width, height);
        }

        seqIdx++;
        setTimeout(drawNext, frameDelay);
      };

      drawNext();
    } catch (startErr) {
      console.warn('Failed to start MediaRecorder:', startErr);
      resolve({
        videoBlob: null,
        videoUrl: previewDataUrl,
        previewDataUrl,
        frameCount: pingPongSequence.length,
        durationSec: 5,
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

  return compilePingPongVideo(frames, photoUrls[0], 5, 24);
}

/**
 * Trigger immediate download of the Boomerang video file to the user's device.
 */
export function downloadBoomerang(videoUrlOrBlob: string | Blob, filename = 'boomerang.mp4') {
  let url = '';
  let shouldRevoke = false;

  if (typeof videoUrlOrBlob === 'string') {
    url = videoUrlOrBlob;
  } else {
    url = URL.createObjectURL(videoUrlOrBlob);
    shouldRevoke = true;
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (shouldRevoke) {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
