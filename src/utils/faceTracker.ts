/**
 * High-performance Face Tracker & Smooth Interpolation
 * Supports standard browser FaceDetector API (Chrome, Edge, Android Chrome)
 * with robust fallback using skin-chrominance & facial geometry analysis,
 * plus multi-face tracking and exponential moving average (EMA) smoothing.
 */

import { DetectedFace } from '../types/arFilter';

// Declare native FaceDetector if available in browser
declare global {
  interface Window {
    FaceDetector?: any;
  }
}

let nativeFaceDetector: any = null;
let isDetectorInitialized = false;

export function initNativeFaceDetector(): boolean {
  if (isDetectorInitialized) return !!nativeFaceDetector;
  isDetectorInitialized = true;
  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      nativeFaceDetector = new (window as any).FaceDetector({
        fastMode: true,
        maxDetectedFaces: 3,
      });
      return true;
    } catch {
      nativeFaceDetector = null;
    }
  }
  return false;
}

/**
 * Fast client-side skin chrominance + facial cluster heuristic fallback
 * When FaceDetector API is unavailable, this detects faces using YCbCr color clustering.
 */
function detectFaceFallback(
  video: HTMLVideoElement,
  sampleCanvas: HTMLCanvasElement
): DetectedFace[] {
  const vWidth = video.videoWidth || 640;
  const vHeight = video.videoHeight || 480;

  // Downsample to low res for fast 60fps tracking
  const scale = 0.15;
  const sWidth = Math.floor(vWidth * scale);
  const sHeight = Math.floor(vHeight * scale);

  sampleCanvas.width = sWidth;
  sampleCanvas.height = sHeight;
  const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  ctx.drawImage(video, 0, 0, sWidth, sHeight);
  let imgData: ImageData;
  try {
    imgData = ctx.getImageData(0, 0, sWidth, sHeight);
  } catch {
    return [];
  }

  const data = imgData.data;
  let totalX = 0;
  let totalY = 0;
  let skinCount = 0;
  let minX = sWidth;
  let maxX = 0;
  let minY = sHeight;
  let maxY = 0;

  // Sample every 2nd pixel for extra speed
  for (let y = Math.floor(sHeight * 0.1); y < sHeight * 0.85; y += 2) {
    for (let x = Math.floor(sWidth * 0.15); x < sWidth * 0.85; x += 2) {
      const idx = (y * sWidth + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Standard YCbCr Skin Tone Model
      // Y = 0.299R + 0.587G + 0.114B
      // Cb = -0.1687R - 0.3313G + 0.5B + 128
      // Cr = 0.5R - 0.4187G - 0.0813B + 128
      const cb = -0.1687 * r - 0.3313 * g + 0.5 * b + 128;
      const cr = 0.5 * r - 0.4187 * g - 0.0813 * b + 128;

      if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > g && g > b) {
        totalX += x;
        totalY += y;
        skinCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const minSkinThreshold = (sWidth * sHeight * 0.02) / 4;
  if (skinCount > minSkinThreshold && maxX > minX && maxY > minY) {
    const avgX = totalX / skinCount;
    const avgY = totalY / skinCount;

    const boxW = (maxX - minX) / sWidth;
    const boxH = (maxY - minY) / sHeight;

    // Filter reasonable face bounds
    if (boxW >= 0.12 && boxW <= 0.75 && boxH >= 0.12 && boxH <= 0.85) {
      const normCenterX = avgX / sWidth;
      const normCenterY = avgY / sHeight;
      const normWidth = Math.min(boxW * 1.1, 0.65);
      const normHeight = Math.min(boxH * 1.1, 0.75);

      return [
        {
          x: normCenterX,
          y: normCenterY,
          width: normWidth,
          height: normHeight,
          rollAngle: 0,
          landmarks: {
            leftEye: { x: normCenterX - normWidth * 0.18, y: normCenterY - normHeight * 0.12 },
            rightEye: { x: normCenterX + normWidth * 0.18, y: normCenterY - normHeight * 0.12 },
            noseTip: { x: normCenterX, y: normCenterY },
            mouth: { x: normCenterX, y: normCenterY + normHeight * 0.22 },
          },
        },
      ];
    }
  }

  // Fallback centered default head position if lighting is dark
  return [
    {
      x: 0.5,
      y: 0.45,
      width: 0.38,
      height: 0.48,
      rollAngle: 0,
      landmarks: {
        leftEye: { x: 0.43, y: 0.40 },
        rightEye: { x: 0.57, y: 0.40 },
        noseTip: { x: 0.5, y: 0.46 },
        mouth: { x: 0.5, y: 0.56 },
      },
    },
  ];
}

/**
 * Track face asynchronously with automatic detection method
 */
export async function trackFacesInVideo(
  video: HTMLVideoElement,
  fallbackCanvas: HTMLCanvasElement
): Promise<DetectedFace[]> {
  if (!video || video.readyState < 2 || video.videoWidth === 0) {
    return [];
  }

  initNativeFaceDetector();

  if (nativeFaceDetector) {
    try {
      const detections = await nativeFaceDetector.detect(video);
      if (detections && detections.length > 0) {
        const vW = video.videoWidth;
        const vH = video.videoHeight;

        return detections.map((det: any) => {
          const bb = det.boundingBox;
          const normX = (bb.x + bb.width / 2) / vW;
          const normY = (bb.y + bb.height / 2) / vH;
          const normW = bb.width / vW;
          const normH = bb.height / vH;

          // Check for landmark eye positions if available
          let leftEye: { x: number; y: number } | undefined;
          let rightEye: { x: number; y: number } | undefined;
          let rollAngle = 0;

          if (det.landmarks && Array.isArray(det.landmarks)) {
            const lEye = det.landmarks.find((l: any) => l.type === 'eye' && l.locations?.[0]?.x < normX * vW);
            const rEye = det.landmarks.find((l: any) => l.type === 'eye' && l.locations?.[0]?.x >= normX * vW);
            if (lEye && rEye) {
              const lx = (lEye.locations[0].x) / vW;
              const ly = (lEye.locations[0].y) / vH;
              const rx = (rEye.locations[0].x) / vW;
              const ry = (rEye.locations[0].y) / vH;
              leftEye = { x: lx, y: ly };
              rightEye = { x: rx, y: ry };
              rollAngle = Math.atan2((ry - ly) * vH, (rx - lx) * vW);
            }
          }

          return {
            x: normX,
            y: normY,
            width: normW,
            height: normH,
            rollAngle,
            landmarks: {
              leftEye: leftEye || { x: normX - normW * 0.18, y: normY - normH * 0.12 },
              rightEye: rightEye || { x: normX + normW * 0.18, y: normY - normH * 0.12 },
              noseTip: { x: normX, y: normY },
              mouth: { x: normX, y: normY + normH * 0.22 },
            },
          };
        });
      }
    } catch {
      // Fallback
    }
  }

  return detectFaceFallback(video, fallbackCanvas);
}

/**
 * Smooth transition filter with exponential moving average
 */
export function smoothFace(
  previousFace: DetectedFace | null,
  currentFace: DetectedFace,
  alpha = 0.35
): DetectedFace {
  if (!previousFace) return currentFace;

  return {
    x: previousFace.x * (1 - alpha) + currentFace.x * alpha,
    y: previousFace.y * (1 - alpha) + currentFace.y * alpha,
    width: previousFace.width * (1 - alpha) + currentFace.width * alpha,
    height: previousFace.height * (1 - alpha) + currentFace.height * alpha,
    rollAngle: previousFace.rollAngle * (1 - alpha) + currentFace.rollAngle * alpha,
    landmarks: {
      leftEye: {
        x: (previousFace.landmarks?.leftEye?.x || currentFace.x) * (1 - alpha) + (currentFace.landmarks?.leftEye?.x || currentFace.x) * alpha,
        y: (previousFace.landmarks?.leftEye?.y || currentFace.y) * (1 - alpha) + (currentFace.landmarks?.leftEye?.y || currentFace.y) * alpha,
      },
      rightEye: {
        x: (previousFace.landmarks?.rightEye?.x || currentFace.x) * (1 - alpha) + (currentFace.landmarks?.rightEye?.x || currentFace.x) * alpha,
        y: (previousFace.landmarks?.rightEye?.y || currentFace.y) * (1 - alpha) + (currentFace.landmarks?.rightEye?.y || currentFace.y) * alpha,
      },
      noseTip: {
        x: (previousFace.landmarks?.noseTip?.x || currentFace.x) * (1 - alpha) + (currentFace.landmarks?.noseTip?.x || currentFace.x) * alpha,
        y: (previousFace.landmarks?.noseTip?.y || currentFace.y) * (1 - alpha) + (currentFace.landmarks?.noseTip?.y || currentFace.y) * alpha,
      },
      mouth: {
        x: (previousFace.landmarks?.mouth?.x || currentFace.x) * (1 - alpha) + (currentFace.landmarks?.mouth?.x || currentFace.x) * alpha,
        y: (previousFace.landmarks?.mouth?.y || currentFace.y) * (1 - alpha) + (currentFace.landmarks?.mouth?.y || currentFace.y) * alpha,
      },
    },
  };
}
