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
  Zap,
  Play,
  Film,
  X,
  Loader2,
  Layers,
  Video,
} from 'lucide-react';
import { PhotoboothLayout } from '../types';
import {
  playCameraClickSound,
  playCountdownBeep,
  playBoomerangWhoosh,
  playSuccessChime,
} from '../utils/audioEffects';
import {
  captureBoomerangFrames,
  compilePingPongVideo,
  downloadBoomerang,
  generateBoomerangFromPhotos,
} from '../utils/boomerangRecorder';
import { storeSlotBoomerangFrames, clearSlotBoomerangFrames } from '../utils/animatedFrameRenderer';

interface Step4CameraProps {
  layout: PhotoboothLayout;
  onPhotosCaptured: (
    photos: string[],
    boomerangClips?: string[],
    slotBoomerangConfig?: Record<number, boolean>
  ) => void;
  onBack: () => void;
  initialBoomerangEnabled?: boolean;
}

export const Step4Camera: React.FC<Step4CameraProps> = ({
  layout,
  onPhotosCaptured,
  onBack,
  initialBoomerangEnabled = false,
}) => {
  const targetPhotoCount = layout.photo_count || layout.slots?.length || 4;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photos & Boomerangs state
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [capturedBoomerangs, setCapturedBoomerangs] = useState<(string | null)[]>([]);

  // Per-slot Boomerang configuration: map slotIndex -> boolean (true = photo+boomerang, false = foto saja)
  const [slotBoomerangConfig, setSlotBoomerangConfig] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    for (let i = 0; i < targetPhotoCount; i++) {
      initial[i] = initialBoomerangEnabled !== undefined ? initialBoomerangEnabled : true;
    }
    return initial;
  });

  const toggleSlotBoomerang = (slotIdx: number) => {
    setSlotBoomerangConfig((prev) => ({
      ...prev,
      [slotIdx]: !prev[slotIdx],
    }));
  };

  // Active slot tracking & 2-stage mode
  const [isBoomerangMode, setIsBoomerangMode] = useState<boolean>(initialBoomerangEnabled);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);
  const [currentSubStage, setCurrentSubStage] = useState<'photo' | 'boomerang'>('photo');

  // Retake targeting
  const [activeRetakeIndex, setActiveRetakeIndex] = useState<number | null>(null);
  const [retakeSubStage, setRetakeSubStage] = useState<'photo' | 'boomerang' | 'both' | null>(null);

  // Countdown & Recording states
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timerDuration, setTimerDuration] = useState<number>(3); // 3s default
  const [isFlashing, setIsFlashing] = useState(false);
  const [isRecordingBoomerang, setIsRecordingBoomerang] = useState(false);
  const [boomerangProgress, setBoomerangProgress] = useState(0);
  const [isCompilingBoomerang, setIsCompilingBoomerang] = useState(false);

  // Camera device state
  const [hasCameraAccess, setHasCameraAccess] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Preview Modal for individual Boomerang
  const [previewModalSlot, setPreviewModalSlot] = useState<number | null>(null);
  const [slotOptionsModal, setSlotOptionsModal] = useState<number | null>(null);

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
        'Kamera tidak dapat diakses atau diblokir oleh peramban. Anda dapat mengunggah file foto atau gunakan sampel foto demo di bawah.'
      );
    }
  }, [facingMode]);

  useEffect(() => {
    clearSlotBoomerangFrames();
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

  // Target Slot being processed
  const currentTargetSlot = activeRetakeIndex !== null ? activeRetakeIndex : activeSlotIndex;

  // Determine if session is 100% complete
  const isPhotosComplete =
    capturedPhotos.length >= targetPhotoCount &&
    capturedPhotos.slice(0, targetPhotoCount).every(Boolean);

  const isBoomerangComplete = Array.from({ length: targetPhotoCount }).every((_, i) => {
    const wantsBoomerang = slotBoomerangConfig[i] ?? false;
    return !wantsBoomerang || !!capturedBoomerangs[i];
  });

  const isAllComplete = isPhotosComplete && isBoomerangComplete && activeRetakeIndex === null;

  // Trigger snapshot (Photo stage)
  const takeSnapshot = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    // Flash screen effect
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    if (soundEnabled) playCameraClickSound();

    const vW = video.videoWidth || 1280;
    const vH = video.videoHeight || 960;
    const minDim = Math.min(vW, vH);
    const sx = (vW - minDim) / 2;
    const sy = (vH - minDim) / 2;

    canvas.width = minDim;
    canvas.height = minDim;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, minDim, minDim);

    if (facingMode === 'user') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    return dataUrl;
  }, [facingMode, soundEnabled]);

  // Record Boomerang clip (Boomerang stage)
  const recordBoomerangForSlot = async (slotIdx: number) => {
    const video = videoRef.current;
    if (!video) return;

    setIsRecordingBoomerang(true);
    setBoomerangProgress(0);
    if (soundEnabled) playBoomerangWhoosh();

    try {
      const { frames, previewDataUrl } = await captureBoomerangFrames(video, {
        durationMs: 1300, // 1.3 detik burst Instagram Boomerang responsif & lincah
        targetFps: 24,
        facingMode,
        width: 720,
        height: 720,
        onProgress: (pct) => setBoomerangProgress(pct),
      });

      // Cache frames for live animated frame video rendering!
      storeSlotBoomerangFrames(slotIdx, frames);

      setIsRecordingBoomerang(false);
      setIsCompilingBoomerang(true);

      const result = await compilePingPongVideo(frames, previewDataUrl, 6, 24);

      setCapturedBoomerangs((prev) => {
        const next = [...prev];
        next[slotIdx] = result.videoUrl;
        return next;
      });

      if (soundEnabled) playSuccessChime();

      // Handle advancement after Boomerang
      if (activeRetakeIndex !== null) {
        setActiveRetakeIndex(null);
        setRetakeSubStage(null);
      } else {
        const nextIdx = slotIdx + 1;
        if (nextIdx < targetPhotoCount) {
          setActiveSlotIndex(nextIdx);
          setCurrentSubStage('photo');
        } else {
          setActiveSlotIndex(targetPhotoCount);
        }
      }
    } catch (err) {
      console.warn('Gagal rekam boomerang:', err);
    } finally {
      setIsRecordingBoomerang(false);
      setIsCompilingBoomerang(false);
      setBoomerangProgress(0);
    }
  };

  // Main Shutter / Action handler
  const handleShutterClick = () => {
    if (countdown !== null || isRecordingBoomerang || isCompilingBoomerang) return;

    // Sub-stage 1: FOTO
    if (currentSubStage === 'photo') {
      const executePhoto = () => {
        const photoData = takeSnapshot();
        if (!photoData) return;

        setCapturedPhotos((prev) => {
          const next = [...prev];
          next[currentTargetSlot] = photoData;
          return next;
        });

        // Check whether Boomerang is enabled for this specific slot
        const isCurrentSlotBoomerang = slotBoomerangConfig[currentTargetSlot] ?? false;

        if (isCurrentSlotBoomerang) {
          // If retake was only for photo, finish retake
          if (activeRetakeIndex !== null && retakeSubStage === 'photo') {
            setActiveRetakeIndex(null);
            setRetakeSubStage(null);
          } else {
            // Auto transition to Boomerang stage for this slot!
            setCurrentSubStage('boomerang');
            // Berikan jeda 800ms setelah jepret foto agar pengguna melihat peralihan ke mode Boomerang
            setTimeout(() => {
              startBoomerangCountdown(currentTargetSlot);
            }, 800);
          }
        } else {
          // Normal photo-only mode: ensure slot has no boomerang recorded
          clearSlotBoomerangFrames(currentTargetSlot);
          setCapturedBoomerangs((prev) => {
            const next = [...prev];
            next[currentTargetSlot] = null;
            return next;
          });

          if (activeRetakeIndex !== null) {
            setActiveRetakeIndex(null);
            setRetakeSubStage(null);
          } else {
            const nextIdx = currentTargetSlot + 1;
            if (nextIdx < targetPhotoCount) {
              setActiveSlotIndex(nextIdx);
              setCurrentSubStage('photo');
            } else {
              setActiveSlotIndex(targetPhotoCount);
            }
          }
        }
      };

      if (timerDuration === 0) {
        executePhoto();
      } else {
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
            executePhoto();
          }
        }, 1000);
      }
    } else {
      // Sub-stage 2: BOOMERANG
      startBoomerangCountdown(currentTargetSlot);
    }
  };

  // Countdown helper specifically for Boomerang - countdown 3 detik standar photobooth agar pengguna siap bergerak
  const startBoomerangCountdown = (slotIdx: number) => {
    let current = 3; // 3 detik persiapan jelas: 3, 2, 1
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
        recordBoomerangForSlot(slotIdx);
      }
    }, 1000);
  };

  // Handle Retake menu selection
  const handleSelectRetakeAction = (slotIdx: number, action: 'photo' | 'boomerang' | 'both') => {
    setSlotOptionsModal(null);
    setActiveRetakeIndex(slotIdx);
    setRetakeSubStage(action);

    if (action === 'boomerang') {
      setCurrentSubStage('boomerang');
    } else {
      setCurrentSubStage('photo');
    }
  };

  // Revert a slot from Boomerang to normal static photo
  const handleRemoveBoomerangFromSlot = (slotIdx: number) => {
    setSlotOptionsModal(null);
    clearSlotBoomerangFrames(slotIdx);
    setSlotBoomerangConfig((prev) => ({ ...prev, [slotIdx]: false }));
    setCapturedBoomerangs((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  };

  // Turn on Boomerang for a slot that was previously photo-only
  const handleAddBoomerangToSlot = (slotIdx: number) => {
    setSlotOptionsModal(null);
    clearSlotBoomerangFrames(slotIdx);
    setSlotBoomerangConfig((prev) => ({ ...prev, [slotIdx]: true }));
    handleSelectRetakeAction(slotIdx, 'boomerang');
  };

  // Reset all
  const handleResetAll = () => {
    clearSlotBoomerangFrames();
    setCapturedPhotos([]);
    setCapturedBoomerangs([]);
    setActiveSlotIndex(0);
    setCurrentSubStage('photo');
    setActiveRetakeIndex(null);
    setRetakeSubStage(null);
  };

  // File upload fallback
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

  // Demo Generator (includes animated demo boomerangs)
  const handleUseDemoPhotos = async () => {
    const demoPhotos: string[] = [];
    const demoBoomerangs: string[] = [];
    const colors = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16'];

    for (let i = 0; i < targetPhotoCount; i++) {
      // 1. Static demo photo
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const bg = colors[i % colors.length];
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, 1200, 1600);

        const grad = ctx.createLinearGradient(0, 0, 1200, 1600);
        grad.addColorStop(0, 'rgba(255,255,255,0.25)');
        grad.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1200, 1600);

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(600, 650, 220, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(600, 1250, 380, 300, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#111827';
        ctx.font = 'bold 84px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Foto Cetak #${i + 1}`, 600, 680);

        const pUrl = canvas.toDataURL('image/jpeg', 0.95);
        demoPhotos.push(pUrl);

        // 2. Animated demo boomerang video loop (respects per-slot Boomerang configuration)
        const isSlotBoomerang = slotBoomerangConfig[i] ?? false;
        if (isSlotBoomerang) {
          const bFrames: HTMLCanvasElement[] = [];
          for (let f = 0; f < 15; f++) {
            const bCanvas = document.createElement('canvas');
            bCanvas.width = 600;
            bCanvas.height = 600;
            const bCtx = bCanvas.getContext('2d')!;

            bCtx.fillStyle = bg;
            bCtx.fillRect(0, 0, 600, 600);

            // Moving ball/heart
            const pulse = 1 + Math.sin((f / 15) * Math.PI) * 0.3;
            bCtx.fillStyle = '#ffffff';
            bCtx.beginPath();
            bCtx.arc(300, 300, 90 * pulse, 0, Math.PI * 2);
            bCtx.fill();

            bCtx.fillStyle = '#111827';
            bCtx.font = 'bold 36px sans-serif';
            bCtx.textAlign = 'center';
            bCtx.fillText(`⚡ Boomerang #${i + 1}`, 300, 312);

            bFrames.push(bCanvas);
          }

          // Cache frames for live animated frame video rendering!
          storeSlotBoomerangFrames(i, bFrames);

          try {
            const bRes = await compilePingPongVideo(bFrames, pUrl, 6, 24);
            demoBoomerangs.push(bRes.videoUrl);
          } catch (e) {
            demoBoomerangs.push(pUrl);
          }
        } else {
          // Foto biasa tanpa boomerang
          demoBoomerangs.push('');
        }
      }
    }

    setCapturedPhotos(demoPhotos);
    setCapturedBoomerangs(demoBoomerangs);
    setActiveSlotIndex(targetPhotoCount);
    setCurrentSubStage('photo');
  };

  // Proceed to next step
  const handleProceed = async () => {
    if (isAllComplete || capturedPhotos.length >= targetPhotoCount) {
      const boomerangsList: string[] = [];
      for (let i = 0; i < targetPhotoCount; i++) {
        boomerangsList[i] = capturedBoomerangs[i] || '';
      }
      onPhotosCaptured(
        capturedPhotos.slice(0, targetPhotoCount),
        boomerangsList,
        slotBoomerangConfig
      );
    }
  };

  return (
    <div className={`flex-1 flex flex-col justify-between max-w-lg mx-auto w-full p-3 sm:p-4 min-h-0 overflow-y-auto ${
      capturedPhotos.length >= targetPhotoCount ? 'pb-44 sm:pb-32' : 'pb-16 sm:pb-8'
    }`}>
      {/* Offscreen Canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Header & Toggle Mode */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ganti Layout</span>
          </button>

          {/* Boomerang Toggle Switch */}
          <button
            type="button"
            onClick={() => {
              const nextState = !isBoomerangMode;
              setIsBoomerangMode(nextState);
              // Update all unshot slots to follow this toggle
              setSlotBoomerangConfig((prev) => {
                const updated = { ...prev };
                for (let i = 0; i < targetPhotoCount; i++) {
                  if (!capturedPhotos[i]) {
                    updated[i] = nextState;
                  }
                }
                return updated;
              });
            }}
            className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
              isBoomerangMode
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-pink-500/20'
                : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${isBoomerangMode ? 'fill-white' : ''}`} />
            <span>Boomerang: {isBoomerangMode ? 'Aktif (Foto + Video)' : 'Nonaktif (Foto Saja)'}</span>
          </button>
        </div>

        {/* Progress Tracker */}
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-zinc-400">
            Slot <strong className="text-white">#{Math.min(currentTargetSlot + 1, targetPhotoCount)}</strong> dari {targetPhotoCount}
          </span>
          <span className="text-amber-400 font-bold">
            {capturedPhotos.length}/{targetPhotoCount} Foto
            {capturedBoomerangs.filter(Boolean).length > 0 && ` • ${capturedBoomerangs.filter(Boolean).length} Boomerang`}
          </span>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-zinc-800/80 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isBoomerangMode ? 'bg-gradient-to-r from-amber-400 to-pink-500' : 'bg-amber-400'
            }`}
            style={{
              width: `${(capturedPhotos.length / targetPhotoCount) * 100}%`,
            }}
          />
        </div>

        {/* Per-Slot Boomerang Selector Pills */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[10px] text-zinc-400">
            <span>Atur Mode Per-Slot (Bisa Campur Foto & Boomerang):</span>
            <span className="text-zinc-500">Klik slot untuk ubah</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {Array.from({ length: targetPhotoCount }).map((_, idx) => {
              const isCurrent = currentTargetSlot === idx;
              const isSlotBoomerang = slotBoomerangConfig[idx] ?? false;
              const hasPhoto = !!capturedPhotos[idx];
              const hasBoomerang = !!capturedBoomerangs[idx];

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleSlotBoomerang(idx)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    isCurrent
                      ? 'ring-2 ring-amber-400/90 shadow-md scale-105'
                      : 'opacity-90 hover:opacity-100'
                  } ${
                    isSlotBoomerang
                      ? 'bg-pink-500/15 border-pink-500/40 text-pink-300 hover:bg-pink-500/25'
                      : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                  }`}
                  title={`Klik untuk ubah mode Slot #${idx + 1}`}
                >
                  <span>Slot #{idx + 1}</span>
                  {isSlotBoomerang ? (
                    <span className="flex items-center gap-0.5 text-pink-400">
                      <Zap className="w-3 h-3 fill-pink-400" />
                      <span>{hasBoomerang ? 'Loop ✓' : 'Boomerang'}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-zinc-400">
                      <Camera className="w-3 h-3" />
                      <span>{hasPhoto ? 'Foto ✓' : 'Foto Saja'}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Target Slot Mode Bar */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400">Target Saat Ini:</span>
            <span className="text-xs font-bold text-white">
              Slot #{Math.min(currentTargetSlot + 1, targetPhotoCount)}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
                slotBoomerangConfig[currentTargetSlot]
                  ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {slotBoomerangConfig[currentTargetSlot] ? (
                <>
                  <Zap className="w-3 h-3 fill-current" />
                  <span>Foto + Boomerang</span>
                </>
              ) : (
                <>
                  <Camera className="w-3 h-3" />
                  <span>Foto Biasa Saja</span>
                </>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={() => toggleSlotBoomerang(currentTargetSlot)}
            className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors cursor-pointer"
          >
            {slotBoomerangConfig[currentTargetSlot] ? 'Ganti ke Foto Saja' : 'Aktifkan Boomerang ⚡'}
          </button>
        </div>

        {/* Active Stage Banner */}
        <div className="text-center py-0.5">
          {isAllComplete ? (
            <span className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 py-1 px-3 rounded-full">
              <Check className="w-4 h-4 stroke-[3]" />
              Semua {targetPhotoCount} Slot Selesai Diambil!
            </span>
          ) : currentSubStage === 'photo' ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {activeRetakeIndex !== null
                  ? `Foto Ulang: Slot #${currentTargetSlot + 1} (Foto Frame Cetak)`
                  : slotBoomerangConfig[currentTargetSlot]
                  ? `Sesi 1 dari 2: Foto Frame Cetak #${currentTargetSlot + 1}`
                  : `Foto Frame Cetak #${currentTargetSlot + 1}`}
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/30 text-pink-300 text-xs font-semibold animate-pulse">
              <Zap className="w-3.5 h-3.5 text-pink-400" />
              <span>
                {activeRetakeIndex !== null
                  ? `Rekam Ulang: Boomerang Slot #${currentTargetSlot + 1}`
                  : `Sesi 2 dari 2: ⚡ Rekam Boomerang Soft File #${currentTargetSlot + 1}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Live Viewfinder Area (1:1 Square) */}
      <div
        className={`relative w-full aspect-square bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl my-2 flex items-center justify-center shrink-0 select-none transition-all duration-300 ${
          isRecordingBoomerang
            ? 'ring-4 ring-rose-500 ring-offset-2 ring-offset-black animate-pulse'
            : currentSubStage === 'boomerang'
            ? 'border-2 border-pink-500/60 shadow-pink-500/10'
            : 'border border-zinc-800'
        }`}
      >
        {/* Flash screen overlay */}
        {isFlashing && <div className="absolute inset-0 bg-white z-40 animate-out fade-out" />}

        {/* Live Camera Video Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover pointer-events-none ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {/* Large Countdown Overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 z-30 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center font-extrabold text-5xl shadow-2xl animate-bounce ${
                currentSubStage === 'boomerang'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                  : 'bg-amber-500 text-zinc-950'
              }`}
            >
              {countdown}
            </div>
            <span className="text-xs font-bold text-white bg-black/70 px-3 py-1 rounded-full backdrop-blur-sm">
              {currentSubStage === 'boomerang' ? '⚡ Siap Gerak Boomerang!' : '📸 Tersenyumlah!'}
            </span>
          </div>
        )}

        {/* Live Recording Indicator for Boomerang */}
        {isRecordingBoomerang && (
          <div className="absolute inset-0 z-30 bg-black/25 flex flex-col items-center justify-between p-4 pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-600 to-rose-600 text-white text-xs sm:text-sm font-extrabold shadow-xl ring-2 ring-white/50 animate-bounce">
              <span className="w-3 h-3 rounded-full bg-white animate-ping shrink-0" />
              <span>🎬 GERAK SEKARANG! (ACTION!)</span>
            </div>

            {/* Live Progress Bar (0 to 100%) */}
            <div className="w-full max-w-xs space-y-1.5 bg-black/60 backdrop-blur-md p-2 rounded-xl border border-white/20">
              <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden border border-white/10">
                <div
                  className="bg-gradient-to-r from-pink-500 via-rose-500 to-amber-400 h-full transition-all duration-75"
                  style={{ width: `${boomerangProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-center font-bold text-pink-200 drop-shadow">
                ⚡ Lambaikan tangan atau gerakkan tubuh terus-menerus!
              </p>
            </div>
          </div>
        )}

        {/* Boomerang Processing Spinner */}
        {isCompilingBoomerang && (
          <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-white">
            <Loader2 className="w-9 h-9 animate-spin text-pink-400" />
            <p className="text-xs font-bold">Menyusun Video Loop Boomerang...</p>
            <span className="text-[10px] text-zinc-400 font-mono">Efek maju-mundur (ping-pong)</span>
          </div>
        )}

        {/* Framing Grid Lines */}
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
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20">
          <button
            onClick={() => setTimerDuration((prev) => (prev === 3 ? 5 : prev === 5 ? 0 : 3))}
            className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-mono flex items-center gap-1 cursor-pointer hover:bg-black/80"
          >
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{timerDuration === 0 ? 'Tanpa Timer' : `${timerDuration}s Timer`}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white hover:text-amber-300 transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
            </button>

            <button
              onClick={toggleFacingMode}
              className="p-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white hover:text-amber-300 transition-colors cursor-pointer"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Floating Shutter Overlay Button inside Viewfinder */}
        {!isAllComplete && !cameraError && !isRecordingBoomerang && !isCompilingBoomerang && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-0 right-0 flex flex-col items-center justify-center gap-1 z-20 pointer-events-none"
          >
            <button
              id="btn-take-photo-overlay"
              disabled={countdown !== null}
              onClick={handleShutterClick}
              className={`pointer-events-auto w-14 h-14 rounded-full border-4 border-white/90 p-1 flex items-center justify-center transition-transform active:scale-90 hover:scale-105 shadow-2xl shadow-black/90 cursor-pointer disabled:opacity-50 ${
                currentSubStage === 'boomerang'
                  ? 'hover:border-pink-400 ring-2 ring-pink-500/50'
                  : 'hover:border-amber-400'
              }`}
            >
              <div
                className={`w-full h-full rounded-full flex items-center justify-center transition-colors ${
                  currentSubStage === 'boomerang'
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:brightness-110'
                    : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                }`}
              >
                {currentSubStage === 'boomerang' ? (
                  <Zap className="w-6 h-6 fill-current animate-pulse" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
              </div>
            </button>
            <span
              className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full tracking-wide shadow-md ${
                currentSubStage === 'boomerang'
                  ? 'bg-pink-600/90 text-white'
                  : 'bg-black/70 text-white'
              }`}
            >
              {currentSubStage === 'boomerang' ? '⚡ Rekam Boomerang' : '📸 Ambil Foto'}
            </span>
          </div>
        )}

        {/* Camera Error / Permission Banner */}
        {cameraError && (
          <div className="absolute inset-0 bg-zinc-950/95 p-6 flex flex-col items-center justify-center text-center gap-3 z-30">
            <Camera className="w-10 h-10 text-amber-400" />
            <p className="text-xs text-zinc-300 max-w-xs">{cameraError}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                onClick={handleUseDemoPhotos}
                className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold shadow cursor-pointer hover:bg-amber-400"
              >
                Gunakan Sampel Foto & Boomerang Demo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-white text-xs font-semibold cursor-pointer hover:bg-zinc-700 flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Captured Slots Tray (Shows both Photo and Boomerang per slot) */}
      <div className="my-1 shrink-0">
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-1">
          <span>Hasil Slot ({capturedPhotos.length}/{targetPhotoCount}):</span>
          {capturedPhotos.length > 0 && (
            <button
              onClick={handleResetAll}
              className="text-zinc-500 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Ulangi Semua</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {Array.from({ length: targetPhotoCount }).map((_, idx) => {
            const photo = capturedPhotos[idx];
            const boomerang = capturedBoomerangs[idx];
            const isTarget = currentTargetSlot === idx;

            return (
              <div
                key={idx}
                onClick={() => photo && setSlotOptionsModal(idx)}
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

                    {/* Boomerang / Photo badge indicator */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (boomerang) setPreviewModalSlot(idx);
                      }}
                      className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold flex items-center gap-0.5 shadow-md ${
                        boomerang
                          ? 'bg-pink-500 text-white hover:bg-pink-400'
                          : slotBoomerangConfig[idx]
                          ? 'bg-pink-950/90 text-pink-300 border border-pink-600/50'
                          : 'bg-zinc-800/90 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {slotBoomerangConfig[idx] ? (
                        <>
                          <Zap className="w-2.5 h-2.5 fill-current" />
                          <span>{boomerang ? 'Loop' : 'Antre'}</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-2.5 h-2.5" />
                          <span>Foto</span>
                        </>
                      )}
                    </div>

                    {/* Hover retake prompt */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[9px] font-mono text-amber-300 transition-opacity">
                      <RotateCcw className="w-3.5 h-3.5 mb-0.5" />
                      <span>Opsi Slot</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-600">
                    <span className="text-[10px] font-mono font-bold">#{idx + 1}</span>
                    <span className="text-[8px] text-zinc-500">
                      {slotBoomerangConfig[idx] ? '⚡ Boomerang' : '📸 Foto'}
                    </span>
                  </div>
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

      {/* Bottom Main Action Button when photos are complete */}
      {capturedPhotos.length >= targetPhotoCount && (
        <div className="fixed-bottom-action-bar">
          <button
            id="btn-proceed-to-filters"
            onClick={handleProceed}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>
              Lanjut ke Filter Warna ({targetPhotoCount} Foto Siap)
            </span>
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* MODAL: Slot Retake / Options */}
      {slotOptionsModal !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xs w-full p-4 space-y-3 shadow-2xl text-center relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setSlotOptionsModal(null)}
              className="absolute top-3 right-3 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-white">
              Opsi Slot #{slotOptionsModal + 1}
            </h3>
            <p className="text-[11px] text-zinc-400">
              Pilih tindakan yang ingin dilakukan pada slot ini
            </p>

            <div className="space-y-2 pt-1">
              {/* Preview Boomerang Video if available */}
              {capturedBoomerangs[slotOptionsModal] && (
                <button
                  onClick={() => {
                    const s = slotOptionsModal;
                    setSlotOptionsModal(null);
                    setPreviewModalSlot(s);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Lihat Video Boomerang</span>
                </button>
              )}

              {/* Retake Photo Only */}
              <button
                onClick={() => handleSelectRetakeAction(slotOptionsModal, 'photo')}
                className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-zinc-700"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span>Foto Ulang Foto Cetak Saja</span>
              </button>

              {/* If slot has boomerang configured */}
              {slotBoomerangConfig[slotOptionsModal] ? (
                <>
                  <button
                    onClick={() => handleSelectRetakeAction(slotOptionsModal, 'boomerang')}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-pink-300 font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-pink-500/30"
                  >
                    <Zap className="w-3.5 h-3.5 text-pink-400" />
                    <span>Rekam Ulang Boomerang Saja</span>
                  </button>

                  <button
                    onClick={() => handleSelectRetakeAction(slotOptionsModal, 'both')}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Ulangi Keduanya (Foto & Boomerang)</span>
                  </button>

                  <button
                    onClick={() => handleRemoveBoomerangFromSlot(slotOptionsModal)}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-zinc-800"
                  >
                    <Camera className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Ubah Slot Ini Menjadi Foto Biasa Saja</span>
                  </button>
                </>
              ) : (
                /* Slot is currently photo only: option to turn on boomerang */
                <button
                  onClick={() => handleAddBoomerangToSlot(slotOptionsModal)}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-pink-600/30 to-rose-600/30 hover:from-pink-600/40 hover:to-rose-600/40 text-pink-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-pink-500/40"
                >
                  <Zap className="w-3.5 h-3.5 text-pink-400" />
                  <span>⚡ Tambahkan Boomerang untuk Slot Ini</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Preview Boomerang Video Loop */}
      {previewModalSlot !== null && capturedBoomerangs[previewModalSlot] && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xs w-full p-4 space-y-3 shadow-2xl text-center relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setPreviewModalSlot(null)}
              className="absolute top-3 right-3 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 z-10"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-[10px] font-bold mb-1">
                <Zap className="w-3 h-3 fill-current" />
                <span>Loop Boomerang 6 Detik</span>
              </div>
              <h3 className="text-sm font-bold text-white">
                Loop Boomerang Slot #{previewModalSlot + 1}
              </h3>
            </div>

            {/* Video player looping */}
            <div className="aspect-square w-full rounded-xl overflow-hidden bg-black border border-zinc-800 shadow-inner">
              <video
                src={capturedBoomerangs[previewModalSlot]!}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            </div>

            <div className="pt-1">
              <button
                onClick={() => setPreviewModalSlot(null)}
                className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
