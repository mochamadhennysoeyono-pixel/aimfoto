import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  SwitchCamera,
  Grid3X3,
  Timer,
  RotateCcw,
  Check,
  AlertCircle,
  Upload,
  Sparkles,
  Zap,
  Loader2,
  Trash2,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { playCountdownBeep, playShutterSound } from '../utils/audioEffects';
import { supabase, HARDCODED_EVENT_ID } from '../supabaseClient';
import { generateUuid } from '../utils/uuid';

interface Step2CameraProps {
  onPhotosCaptured: (photos: string[]) => void;
  onPhotoCaptured?: (photoDataUrl: string) => void;
  onBack: () => void;
  sessionId?: string;
  eventId?: string;
  maxPhotos?: number;
  targetSlotsCount?: number;
}

export const Step2Camera: React.FC<Step2CameraProps> = ({
  onPhotosCaptured,
  onPhotoCaptured,
  onBack,
  sessionId,
  eventId,
  maxPhotos = 7,
  targetSlotsCount = 3,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [countdownDuration, setCountdownDuration] = useState<3 | 5 | 0>(3);
  const [countdownCurrent, setCountdownCurrent] = useState<number | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSavingToSupabase, setIsSavingToSupabase] = useState(false);
  const [supabaseSyncStatus, setSupabaseSyncStatus] = useState<string | null>(null);

  // Stop current active media stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Initialize camera stream
  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    setIsInitializing(true);
    setErrorMessage(null);
    stopStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser ini tidak mendukung akses kamera secara langsung');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          aspectRatio: { ideal: 4 / 3 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err: any) => {
            if (err?.name !== 'AbortError') console.warn('Video play error on metadata:', err);
          });
        };
        videoRef.current.play().catch((err: any) => {
          if (err?.name !== 'AbortError') console.warn('Video play error:', err);
        });
      }

      setHasCamera(true);
    } catch (err: unknown) {
      console.warn('Camera access error:', err);
      setHasCamera(false);
      const e = err as Error;
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setErrorMessage('Izin kamera ditolak. Silakan izinkan akses kamera pada browser atau upload foto di bawah.');
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        setErrorMessage('Perangkat kamera tidak ditemukan pada perangkat Anda.');
      } else {
        setErrorMessage('Kamera tidak dapat diakses saat ini. Anda dapat menggunakan tombol upload foto.');
      }
    } finally {
      setIsInitializing(false);
    }
  }, [stopStream]);

  // Initial load
  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stopStream();
    };
  }, [facingMode, startCamera, stopStream]);

  // Switch between front and rear cameras
  const handleToggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
  };

  // Perform the physical frame capture onto hidden offscreen canvas
  const captureCurrentFrame = (): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 960;

    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.save();
    // Mirror horizontally if using front user-facing camera
    if (facingMode === 'user') {
      ctx.translate(vw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, vw, vh);
    ctx.restore();

    return canvas.toDataURL('image/jpeg', 0.95);
  };

  // Shutter button trigger
  const handleShutter = () => {
    if (capturedPhotos.length >= maxPhotos) return;

    if (countdownDuration === 0) {
      takeSnapshot();
      return;
    }

    setCountdownCurrent(countdownDuration);
    playCountdownBeep(false);

    let remaining = countdownDuration;
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdownCurrent(remaining);
        playCountdownBeep(remaining === 1);
      } else {
        clearInterval(interval);
        setCountdownCurrent(null);
        takeSnapshot();
      }
    }, 1000);
  };

  // Capture execution
  const takeSnapshot = () => {
    playShutterSound();

    // Trigger visual screen flash
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 120);

    const frameUrl = captureCurrentFrame();
    if (frameUrl) {
      setCapturedPhotos((prev) => {
        const next = [...prev, frameUrl];
        if (next.length >= maxPhotos) {
          // If reached 7 photos, stop camera stream to save battery
          stopStream();
        }
        return next;
      });
      setSelectedPhotoIndex(null);
    }
  };

  // Delete a specific photo
  const handleDeletePhoto = (indexToDelete: number) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== indexToDelete));
    if (selectedPhotoIndex === indexToDelete) {
      setSelectedPhotoIndex(null);
    }
    // Restart camera if it was stopped
    if (!streamRef.current) {
      startCamera(facingMode);
    }
  };

  // Retake all photos
  const handleRetakeAll = () => {
    setCapturedPhotos([]);
    setSelectedPhotoIndex(null);
    startCamera(facingMode);
  };

  // Confirm photos and proceed to next step
  const handleConfirm = async () => {
    if (capturedPhotos.length === 0) return;

    setIsSavingToSupabase(true);
    const activeSessionId = sessionId || generateUuid();

    try {
      let validEventId = eventId;
      if (!validEventId) {
        try {
          const { data: ev } = await supabase
            .from('events')
            .select('id')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (ev?.id) validEventId = ev.id;
        } catch (e) {}
      }
      if (!validEventId) {
        validEventId = HARDCODED_EVENT_ID;
      }

      const sessionPayload: Record<string, any> = {
        id: activeSessionId,
        event_id: validEventId,
        status: 'draft',
        preview_url: capturedPhotos[0],
      };

      const { data, error } = await supabase
        .from('sessions')
        .upsert([sessionPayload], { onConflict: 'id' })
        .select();

      if (error) {
        console.warn('Supabase sessions upsert notice:', error.message);
        setSupabaseSyncStatus(`Catatan Supabase: ${error.message}`);
      } else {
        console.log('Berhasil simpan session ke Supabase:', data);
        setSupabaseSyncStatus('Sesi tersimpan di Supabase');
      }
    } catch (err: any) {
      console.warn('Error connecting to Supabase sessions:', err);
    } finally {
      setIsSavingToSupabase(false);
      stopStream();
      onPhotosCaptured(capturedPhotos);
      if (onPhotoCaptured) {
        onPhotoCaptured(capturedPhotos[0]);
      }
    }
  };

  // Fallback: Handle file upload from gallery
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files).slice(0, maxPhotos - capturedPhotos.length) as File[];

    fileList.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          setCapturedPhotos((prev) => {
            if (prev.length >= maxPhotos) return prev;
            return [...prev, dataUrl];
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Fallback: Generate demo sample photos
  const handleUseSample = () => {
    const colors = [
      ['#2D1B36', '#E28743', 'Pose 1: Senyum Ceria ✨', 'Gaya Bebas 1'],
      ['#1B2E36', '#F7C844', 'Pose 2: Peace Sign ✌️', 'Gaya Bebas 2'],
      ['#361B24', '#FF4081', 'Pose 3: Finger Heart 🫰', 'Gaya Romantis'],
      ['#1F361B', '#10B981', 'Pose 4: Candid Tawa 😄', 'Gaya Spontan'],
      ['#241B36', '#8B5CF6', 'Pose 5: Wink Eye 😉', 'Gaya Imut'],
      ['#362D1B', '#F59E0B', 'Pose 6: Gaya Keren 😎', 'Gaya Elegan'],
      ['#1E243D', '#00E5FF', 'Pose 7: Pose Terakhir 🎉', 'Gaya Selebrasi'],
    ];

    const currentCount = capturedPhotos.length;
    const poseConfig = colors[currentCount % colors.length];

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 1080;
    sampleCanvas.height = 1350;
    const ctx = sampleCanvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 0, 1080, 1350);
      grad.addColorStop(0, poseConfig[0]);
      grad.addColorStop(1, '#0c0e14');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1350);

      // Stylized smile avatar
      ctx.fillStyle = poseConfig[1];
      ctx.beginPath();
      ctx.arc(540, 500, 200, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#0c0e14';
      ctx.beginPath();
      ctx.arc(460, 460, 24, 0, Math.PI * 2);
      ctx.arc(620, 460, 24, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#0c0e14';
      ctx.beginPath();
      ctx.arc(540, 520, 95, 0.15 * Math.PI, 0.85 * Math.PI, false);
      ctx.stroke();

      // Pose Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 36px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(poseConfig[2], 540, 920);

      ctx.font = '600 22px "JetBrains Mono", monospace';
      ctx.fillStyle = poseConfig[1];
      ctx.fillText(`FOTO KE-${currentCount + 1} • ${poseConfig[3]}`, 540, 980);

      const sampleUrl = sampleCanvas.toDataURL('image/jpeg', 0.95);
      setCapturedPhotos((prev) => [...prev, sampleUrl]);
    }
  };

  const isMaxReached = capturedPhotos.length >= maxPhotos;

  return (
    <div className="flex-1 flex flex-col justify-between max-w-lg mx-auto w-full p-3 md:p-4 relative overflow-hidden">
      {/* Hidden canvas for offscreen capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Screen flash effect */}
      {isFlashing && (
        <div className="fixed inset-0 z-50 bg-white pointer-events-none transition-opacity duration-150" />
      )}

      {/* Top Controls Bar */}
      <div className="flex items-center justify-between pb-2 z-10">
        <button
          id="btn-camera-back"
          onClick={onBack}
          className="px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 hover:text-white cursor-pointer"
        >
          ← Ganti Frame
        </button>

        {/* Counter Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-400 font-mono">
          <Camera className="w-3.5 h-3.5" />
          <span>
            {capturedPhotos.length} / {maxPhotos} Foto
          </span>
        </div>

        {/* Settings buttons (only when camera is live) */}
        {!isMaxReached && (
          <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800 rounded-full px-2 py-1">
            <button
              id="btn-toggle-grid"
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                showGrid ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-400 hover:text-white'
              }`}
              title="Garis bantu komposisi"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>

            <button
              id="btn-toggle-timer"
              onClick={() => {
                const next = countdownDuration === 3 ? 5 : countdownDuration === 5 ? 0 : 3;
                setCountdownDuration(next as 3 | 5 | 0);
              }}
              className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                countdownDuration > 0
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {countdownDuration > 0 ? `${countdownDuration}s` : 'Off'}
            </button>

            <button
              id="btn-switch-camera"
              onClick={handleToggleFacingMode}
              className="p-1.5 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Ganti kamera depan / belakang"
            >
              <SwitchCamera className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Viewfinder / Photo Preview */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[4/3] max-h-[50vh] bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center my-auto">
        {selectedPhotoIndex !== null && capturedPhotos[selectedPhotoIndex] ? (
          /* Inspecting a previously captured photo */
          <div className="relative w-full h-full bg-black flex items-center justify-center">
            <img
              src={capturedPhotos[selectedPhotoIndex]}
              alt={`Foto ${selectedPhotoIndex + 1}`}
              className="w-full h-full object-contain"
            />
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-xs font-mono text-amber-300 border border-amber-500/30">
              Foto #{selectedPhotoIndex + 1} dari {capturedPhotos.length}
            </div>
            <button
              onClick={() => setSelectedPhotoIndex(null)}
              className="absolute top-3 right-3 bg-zinc-900/80 hover:bg-zinc-800 text-white text-xs px-3 py-1 rounded-full border border-zinc-700 cursor-pointer"
            >
              Kembali ke Kamera
            </button>
          </div>
        ) : isMaxReached ? (
          /* Max 7 photos reached card */
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 bg-zinc-900/60 w-full h-full">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Check className="w-7 h-7 stroke-[3]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">7 Jepretan Lengkap!</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs">
                Anda telah mengambil 7 foto. Sekarang saatnya memilih filter dan mengatur foto ke layout frame.
              </p>
            </div>
            <button
              onClick={handleConfirm}
              className="py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <span>Lanjut ke Filter & Atur Layout</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Live Camera Stream */
          <div className="relative w-full h-full bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`w-full h-full object-cover ${
                facingMode === 'user' ? 'scale-x-[-1]' : ''
              }`}
            />

            {/* Initializing Spinner */}
            {isInitializing && (
              <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center gap-2 text-zinc-400">
                <div className="w-7 h-7 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                <p className="text-xs font-mono">Menghubungkan kamera...</p>
              </div>
            )}

            {/* Grid overlay */}
            {showGrid && !isInitializing && (
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div />
              </div>
            )}

            {/* Viewfinder corner brackets */}
            <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-amber-400 pointer-events-none" />
            <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-amber-400 pointer-events-none" />
            <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-amber-400 pointer-events-none" />
            <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-amber-400 pointer-events-none" />

            {/* Countdown overlay */}
            {countdownCurrent !== null && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-30">
                <div className="w-20 h-20 rounded-full bg-amber-500/90 text-zinc-950 font-black text-5xl flex items-center justify-center animate-ping">
                  {countdownCurrent}
                </div>
              </div>
            )}

            {/* Camera Error Fallback */}
            {errorMessage && (
              <div className="absolute inset-0 bg-zinc-950/95 flex flex-col items-center justify-center p-6 text-center z-20 space-y-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white mb-1">Kamera Tidak Tersedia</h3>
                  <p className="text-[11px] text-zinc-400 max-w-xs">{errorMessage}</p>
                </div>
                <div className="w-full space-y-2 pt-1 max-w-xs">
                  <label className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>Upload Foto dari Galeri</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={handleUseSample}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Gunakan Foto Contoh Demo</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Thumbnails Tray of Captured Photos */}
      <div className="py-2">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5 px-1">
          <span className="font-semibold text-zinc-300">
            Koleksi Foto ({capturedPhotos.length}/{maxPhotos})
          </span>
          {capturedPhotos.length > 0 && (
            <button
              onClick={handleRetakeAll}
              className="text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Semua
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {Array.from({ length: maxPhotos }).map((_, idx) => {
            const photo = capturedPhotos[idx];
            const isSelected = selectedPhotoIndex === idx;

            return (
              <div
                key={idx}
                onClick={() => {
                  if (photo) setSelectedPhotoIndex(isSelected ? null : idx);
                }}
                className={`relative w-14 h-14 shrink-0 rounded-xl overflow-hidden border transition-all cursor-pointer flex items-center justify-center ${
                  isSelected
                    ? 'border-amber-400 ring-2 ring-amber-400/40'
                    : photo
                    ? 'border-zinc-700 bg-zinc-900'
                    : 'border-zinc-800 border-dashed bg-zinc-900/40 text-zinc-600'
                }`}
              >
                {photo ? (
                  <>
                    <img src={photo} alt={`Snap ${idx + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0.5 left-0.5 bg-black/70 text-[9px] font-mono px-1 rounded text-white">
                      #{idx + 1}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePhoto(idx);
                      }}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-600/80 text-white flex items-center justify-center hover:bg-red-500 cursor-pointer shadow"
                      title="Hapus foto ini"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </>
                ) : (
                  <span className="text-[10px] font-mono">#{idx + 1}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Shutter & Confirm Action Controls */}
      <div className="pt-2 pb-1">
        {capturedPhotos.length >= targetSlotsCount || isMaxReached ? (
          /* Ready to proceed or take more */
          <div className="flex items-center gap-2.5">
            {!isMaxReached && (
              <button
                id="btn-shutter-more"
                onClick={handleShutter}
                disabled={countdownCurrent !== null || isInitializing}
                className="py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Jepret Lagi</span>
              </button>
            )}

            <button
              id="btn-confirm-photos"
              onClick={handleConfirm}
              disabled={isSavingToSupabase}
              className="flex-1 py-3.5 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-75"
            >
              {isSavingToSupabase ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyiapkan Sesi...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>
                    Lanjut ke Filter ({capturedPhotos.length} Foto Siap)
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        ) : (
          /* Shutter & Quick Add Options */
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-6 w-full">
              {/* Gallery upload */}
              <label
                className="w-11 h-11 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer transition-colors"
                title="Pilih foto dari galeri HP"
              >
                <Upload className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {/* Shutter Button */}
              <button
                id="btn-shutter"
                onClick={handleShutter}
                disabled={countdownCurrent !== null || isInitializing || errorMessage !== null}
                className="w-18 h-18 rounded-full border-4 border-white/80 p-1 flex items-center justify-center group active:scale-90 transition-transform cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Ambil Foto"
              >
                <div className="w-full h-full rounded-full bg-amber-400 group-hover:bg-amber-300 transition-colors shadow-lg flex items-center justify-center">
                  <Camera className="w-7 h-7 text-zinc-950" />
                </div>
              </button>

              {/* Quick sample photo test */}
              <button
                onClick={handleUseSample}
                className="w-11 h-11 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer"
                title="Gunakan foto demo contoh"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-zinc-500 font-mono text-center">
              {countdownDuration > 0
                ? `Timer ${countdownDuration}s aktif • Minimal ambil ${targetSlotsCount} foto untuk layout ini`
                : `Tekan shutter • Ambil hingga ${maxPhotos} foto`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
