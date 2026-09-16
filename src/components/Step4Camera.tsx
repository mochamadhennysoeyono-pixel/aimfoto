import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  FlipHorizontal,
  ChevronRight,
  Upload,
  ArrowLeft,
  Check,
  Clock,
  Sparkle,
} from 'lucide-react';
import { PhotoboothLayout } from '../types';
import { ARFilterId, DetectedFace } from '../types/arFilter';
import { ARFilterSelector } from './ARFilterSelector';
import { trackFacesInVideo, smoothFace } from '../utils/faceTracker';
import { renderARFilterOnCanvas } from '../utils/arFilterRenderer';
import { playCameraClickSound, playCountdownBeep } from '../utils/audioEffects';

interface Step4CameraProps {
  layout: PhotoboothLayout;
  onPhotosCaptured: (photos: string[]) => void;
  onBack: () => void;
}

export const Step4Camera: React.FC<Step4CameraProps> = ({
  layout,
  onPhotosCaptured,
  onBack,
}) => {
  const targetPhotoCount = layout.photo_count || layout.slots?.length || 4;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveOverlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const sampleFallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [activeRetakeIndex, setActiveRetakeIndex] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timerDuration, setTimerDuration] = useState<number>(3); // 3 seconds default
  const [isFlashing, setIsFlashing] = useState(false);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Live AR Filter States
  const [selectedARFilter, setSelectedARFilter] = useState<ARFilterId>('none');
  const [faceDetected, setFaceDetected] = useState(false);
  const smoothedFaceRef = useRef<DetectedFace | null>(null);

  // Initialize camera stream
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
      }

      setCameraError(null);
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((playErr: any) => {
            if (playErr?.name !== 'AbortError') {
              console.warn('Camera play error on metadata:', playErr);
            }
          });
        };
        videoRef.current.play().catch((playErr: any) => {
          if (playErr?.name !== 'AbortError') {
            console.warn('Camera direct play error:', playErr);
          }
        });
        setHasCameraAccess(true);
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setHasCameraAccess(false);
      setCameraError(
        'Kamera tidak dapat diakses atau diblokir oleh peramban. Anda dapat mengunggah file foto atau gunakan sampel foto di bawah.'
      );
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
    };
  }, [startCamera]);

  // Flip camera
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Dedicated offscreen sampling canvas for fallback tracker
  useEffect(() => {
    if (!sampleFallbackCanvasRef.current && typeof document !== 'undefined') {
      sampleFallbackCanvasRef.current = document.createElement('canvas');
    }
  }, []);

  // Continuous Real-Time AR Face Tracking & Overlay Loop
  useEffect(() => {
    let isMounted = true;

    const renderLoop = async () => {
      const video = videoRef.current;
      const overlayCanvas = liveOverlayCanvasRef.current;

      if (video && overlayCanvas && video.readyState >= 2 && video.videoWidth > 0) {
        const vW = video.videoWidth;
        const vH = video.videoHeight;

        // Keep overlay canvas resolution matched with actual video stream
        if (overlayCanvas.width !== vW || overlayCanvas.height !== vH) {
          overlayCanvas.width = vW;
          overlayCanvas.height = vH;
        }

        const ctx = overlayCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, vW, vH);

          if (selectedARFilter !== 'none') {
            const fallbackCanvas = sampleFallbackCanvasRef.current || document.createElement('canvas');
            const faces = await trackFacesInVideo(video, fallbackCanvas);

            if (faces && faces.length > 0) {
              const currentFace = faces[0];
              const smoothed = smoothFace(smoothedFaceRef.current, currentFace, 0.4);
              smoothedFaceRef.current = smoothed;

              if (isMounted) {
                setFaceDetected(true);
              }

              // Render active AR Filter decoration onto the overlay
              // The video itself is mirrored in CSS if facingMode === 'user'
              // So on overlay canvas: if we mirror the canvas horizontally, coordinates match CSS video mirror
              renderARFilterOnCanvas(
                ctx,
                vW,
                vH,
                smoothed,
                selectedARFilter,
                false // Coordinate mirror handled by CSS scale-x-[-1] on parent or canvas
              );
            } else {
              if (isMounted) setFaceDetected(false);
            }
          } else {
            if (isMounted) setFaceDetected(false);
          }
        }
      }

      if (isMounted) {
        animFrameIdRef.current = requestAnimationFrame(renderLoop);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isMounted = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [selectedARFilter, facingMode]);

  // Trigger snapshot with AR filter baked directly into photo output
  const takeSnapshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Flash screen effect
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    // Camera shutter audio
    if (soundEnabled) playCameraClickSound();

    const vW = video.videoWidth || 1280;
    const vH = video.videoHeight || 960;
    canvas.width = vW;
    canvas.height = vH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw camera video feed
    // Mirror image if user facing
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 2. Burn active AR Filter directly into the captured image
    if (selectedARFilter !== 'none' && smoothedFaceRef.current) {
      renderARFilterOnCanvas(
        ctx,
        canvas.width,
        canvas.height,
        smoothedFaceRef.current,
        selectedARFilter,
        false
      );
    }

    // Reset matrix
    if (facingMode === 'user') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

    setCapturedPhotos((prev) => {
      if (activeRetakeIndex !== null && activeRetakeIndex >= 0 && activeRetakeIndex < prev.length) {
        const updated = [...prev];
        updated[activeRetakeIndex] = dataUrl;
        setActiveRetakeIndex(null);
        return updated;
      } else {
        return [...prev, dataUrl];
      }
    });
  }, [facingMode, soundEnabled, activeRetakeIndex, selectedARFilter]);

  // Countdown timer trigger
  const handleTriggerCapture = () => {
    if (countdown !== null) return;

    if (timerDuration === 0) {
      takeSnapshot();
      return;
    }

    let current = timerDuration;
    setCountdown(current);
    if (soundEnabled) playCountdownBeep();

    const interval = setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCountdown(current);
        if (soundEnabled) playCountdownBeep();
      } else {
        clearInterval(interval);
        setCountdown(null);
        takeSnapshot();
      }
    }, 1000);
  };

  // Retake a specific photo
  const handleRetakeSpecific = (index: number) => {
    setActiveRetakeIndex(index);
  };

  // Reset all captured photos
  const handleResetAll = () => {
    setCapturedPhotos([]);
    setActiveRetakeIndex(null);
  };

  // Handle fallback file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (!file) continue;

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setCapturedPhotos((prev) => {
            if (activeRetakeIndex !== null) {
              const updated = [...prev];
              updated[activeRetakeIndex] = result;
              setActiveRetakeIndex(null);
              return updated;
            }
            if (prev.length < targetPhotoCount) {
              return [...prev, result];
            }
            return prev;
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate crisp demo photos if user is testing in iframe without webcam
  const handleUseDemoPhotos = () => {
    const demoPhotos: string[] = [];
    const colors = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16'];

    for (let i = 0; i < targetPhotoCount; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const bg = colors[i % colors.length];
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 1200, 1600);

        // Gradient overlay
        const grad = ctx.createLinearGradient(0, 0, 1200, 1600);
        grad.addColorStop(0, 'rgba(255,255,255,0.25)');
        grad.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1200, 1600);

        // Pose Avatar Silhouette
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(600, 650, 220, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(600, 1250, 380, 300, 0, 0, Math.PI * 2);
        ctx.fill();

        // If filter is active, stamp filter onto demo photo too
        if (selectedARFilter !== 'none') {
          renderARFilterOnCanvas(
            ctx,
            1200,
            1600,
            {
              x: 0.5,
              y: 0.41,
              width: 0.38,
              height: 0.48,
              rollAngle: 0,
            },
            selectedARFilter,
            false
          );
        }

        // Number Badge
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 84px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Foto #${i + 1}`, 600, 680);

        demoPhotos.push(canvas.toDataURL('image/jpeg', 0.95));
      }
    }
    setCapturedPhotos(demoPhotos);
  };

  const isComplete = capturedPhotos.length >= targetPhotoCount;
  const currentCaptureNumber =
    activeRetakeIndex !== null
      ? activeRetakeIndex + 1
      : Math.min(capturedPhotos.length + 1, targetPhotoCount);

  const handleProceed = () => {
    if (isComplete) {
      onPhotosCaptured(capturedPhotos.slice(0, targetPhotoCount));
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between max-w-lg mx-auto w-full p-3 sm:p-4 min-h-0 overflow-y-auto">
      {/* Offscreen Canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Header & Progress */}
      <div className="shrink-0">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ganti Layout</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
              {capturedPhotos.length} / {targetPhotoCount} Foto Diambil
            </span>
          </div>
        </div>

        {/* Progress Dots / Bar */}
        <div className="w-full bg-zinc-800/80 h-1.5 rounded-full my-2 overflow-hidden">
          <div
            className="bg-amber-400 h-full transition-all duration-300 rounded-full"
            style={{ width: `${(capturedPhotos.length / targetPhotoCount) * 100}%` }}
          />
        </div>

        {/* Active Shot Status Notice */}
        <div className="text-center py-0.5">
          <p className="text-[11px] font-mono text-zinc-400">
            {activeRetakeIndex !== null ? (
              <span className="text-amber-300 font-bold">
                Mengambil ulang Foto #{activeRetakeIndex + 1}
              </span>
            ) : isComplete ? (
              <span className="text-emerald-400 font-bold flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                Semua {targetPhotoCount} foto berhasil diambil!
              </span>
            ) : (
              <span>
                Siap untuk <strong className="text-white">Foto #{currentCaptureNumber}</strong> dari {targetPhotoCount}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Live Viewfinder & Countdown Area: Kotak 1:1 (aspect-square) di semua tempat */}
      <div className="relative w-full aspect-square bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl my-2 flex items-center justify-center shrink-0 select-none">
        {/* Flash overlay */}
        {isFlashing && <div className="absolute inset-0 bg-white z-30 animate-out fade-out" />}

        {/* Live Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover pointer-events-none ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* Live AR Filter Canvas Overlay (perfectly synchronizes over video) */}
        <canvas
          ref={liveOverlayCanvasRef}
          className={`absolute inset-0 w-full h-full pointer-events-none object-cover ${
            facingMode === 'user' ? 'scale-x-[-1]' : ''
          }`}
        />

        {/* Countdown Large Badge */}
        {countdown !== null && (
          <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center font-extrabold text-5xl shadow-2xl animate-bounce">
              {countdown}
            </div>
          </div>
        )}

        {/* Framing Grid Overlay */}
        <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-15 border border-white/20">
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-r border-b border-white" />
          <div className="border-b border-white" />
          <div className="border-r border-white" />
          <div className="border-r border-white" />
          <div />
        </div>

        {/* Top Controls Overlay inside Viewfinder */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
          {/* Timer button */}
          <button
            onClick={() => setTimerDuration((prev) => (prev === 3 ? 5 : prev === 5 ? 0 : 3))}
            className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-mono flex items-center gap-1 cursor-pointer hover:bg-black/80"
          >
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{timerDuration === 0 ? 'Tanpa Timer' : `${timerDuration}s Timer`}</span>
          </button>

          <div className="flex items-center gap-1.5">
            {/* Sound toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white hover:text-amber-300 transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
            </button>

            {/* Flip camera */}
            <button
              onClick={toggleFacingMode}
              className="p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white hover:text-amber-300 transition-colors cursor-pointer"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Floating Shutter Overlay Button inside Viewfinder */}
        {!isComplete && !cameraError && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-0 right-0 flex flex-col items-center justify-center gap-1 z-10 pointer-events-none"
          >
            <button
              id="btn-take-photo-overlay"
              disabled={countdown !== null}
              onClick={handleTriggerCapture}
              className="pointer-events-auto w-14 h-14 rounded-full border-4 border-white/90 p-1 flex items-center justify-center transition-transform active:scale-90 hover:scale-105 shadow-2xl shadow-black/90 cursor-pointer disabled:opacity-50 hover:border-amber-400"
            >
              <div className="w-full h-full rounded-full bg-amber-500 hover:bg-amber-400 flex items-center justify-center text-zinc-950 transition-colors">
                <Camera className="w-5 h-5" />
              </div>
            </button>
            <span className="text-[10px] font-mono font-medium text-white/90 bg-black/60 backdrop-blur-sm px-2.5 py-0.5 rounded-full tracking-wide">
              Ambil Foto
            </span>
          </div>
        )}

        {/* Camera Error / Permission Banner */}
        {cameraError && (
          <div className="absolute inset-0 bg-zinc-950/95 p-6 flex flex-col items-center justify-center text-center gap-3 z-20">
            <Camera className="w-10 h-10 text-amber-400" />
            <p className="text-xs text-zinc-300 max-w-xs">{cameraError}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                onClick={handleUseDemoPhotos}
                className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold shadow cursor-pointer hover:bg-amber-400"
              >
                Gunakan Sampel Foto Demo ({targetPhotoCount}x)
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-white text-xs font-semibold cursor-pointer hover:bg-zinc-700 flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Foto</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AR Live Face Filter Carousel Selector */}
      <div className="my-1.5 shrink-0">
        <ARFilterSelector
          selectedFilter={selectedARFilter}
          onSelectFilter={setSelectedARFilter}
          faceDetected={faceDetected}
        />
      </div>

      {/* Captured Photos Thumbnail Tray */}
      <div className="my-1 shrink-0">
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
          <span>Hasil Jepretan ({capturedPhotos.length}/{targetPhotoCount}):</span>
          {capturedPhotos.length > 0 && (
            <button
              onClick={handleResetAll}
              className="text-zinc-500 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Foto Ulang Semua</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {Array.from({ length: targetPhotoCount }).map((_, idx) => {
            const photo = capturedPhotos[idx];
            const isTarget = activeRetakeIndex === idx || (activeRetakeIndex === null && capturedPhotos.length === idx);

            return (
              <div
                key={idx}
                onClick={() => photo && handleRetakeSpecific(idx)}
                className={`relative aspect-square rounded-xl overflow-hidden border flex items-center justify-center transition-all ${
                  photo
                    ? 'border-zinc-700 bg-zinc-900 cursor-pointer hover:border-amber-400 group'
                    : isTarget
                    ? 'border-amber-500 bg-amber-500/10 border-dashed animate-pulse'
                    : 'border-zinc-800/80 bg-zinc-950 border-dashed'
                }`}
              >
                {photo ? (
                  <>
                    <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[9px] font-mono text-amber-300 transition-opacity">
                      <RotateCcw className="w-3.5 h-3.5 mb-0.5" />
                      <span>Retake</span>
                    </div>
                  </>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-600">
                    #{idx + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Hidden File Input for fallback */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Bottom Main Action Button when all photos are complete */}
      {isComplete && (
        <div className="pt-2 pb-1 border-t border-zinc-800 flex flex-col gap-2 shrink-0">
          <button
            id="btn-proceed-to-filters"
            onClick={handleProceed}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Lanjut ke Filter Warna ({targetPhotoCount} Foto Siap)</span>
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
};
