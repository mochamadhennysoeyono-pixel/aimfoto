/**
 * Utilitas untuk mengonversi dan mengunduh video Boomerang / Frame Boomerang dalam format MP4.
 * Memastikan video dapat diputar di semua perangkat (iPhone/iOS Photos, macOS QuickTime, Android, Windows)
 * tanpa masalah ekstensi atau format .webm yang tidak didukung.
 */

/**
 * Transcode WebM video blob/URL to genuine MP4 container using in-browser MediaRecorder + Canvas.
 */
export async function convertWebmToMp4(videoUrlOrBlob: string | Blob): Promise<Blob> {
  const supportedMp4Mime = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4;codecs=h264',
    'video/mp4',
  ].find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));

  let blob: Blob;
  if (typeof videoUrlOrBlob === 'string') {
    const res = await fetch(videoUrlOrBlob, { mode: 'cors' });
    blob = await res.blob();
  } else {
    blob = videoUrlOrBlob;
  }

  // Jika blob sudah berformat MP4, langsung kembalikan tanpa transcoding ulang
  if (blob.type && blob.type.toLowerCase().includes('mp4')) {
    return blob;
  }

  // Jika browser tidak mendukung MP4 encoder di MediaRecorder,
  // kembalikan blob dengan MIME video/mp4
  if (!supportedMp4Mime) {
    return new Blob([blob], { type: 'video/mp4' });
  }

  const srcUrl = URL.createObjectURL(blob);

  try {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Video loading timeout')), 8000);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Failed to load video element'));
      };
      video.src = srcUrl;
    });

    // Validasi durasi video asli (jika WebM blob sering bernilai Infinity)
    const validDurationSec = isFinite(video.duration) && video.duration > 0 ? video.duration : 6.0;

    const width = video.videoWidth || 720;
    const height = video.videoHeight || 900;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot acquire canvas 2d context');

    const fps = 24;
    // Gunakan captureStream standar
    const stream = canvas.captureStream ? canvas.captureStream(fps) : (canvas as any).mozCaptureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: supportedMp4Mime });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    return await new Promise<Blob>((resolve, reject) => {
      let isStopped = false;
      let animId: number;
      let lastTime = -1;
      let stallCount = 0;

      const stopRecording = () => {
        if (isStopped) return;
        isStopped = true;
        cancelAnimationFrame(animId);
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      };

      recorder.onstop = () => {
        const mp4Blob = new Blob(chunks, { type: 'video/mp4' });
        resolve(mp4Blob);
      };

      recorder.onerror = (err) => {
        cancelAnimationFrame(animId);
        reject(err);
      };

      const renderLoop = () => {
        if (isStopped) return;

        // Jika video telah mencapai durasi atau selesai diputar, langsung hentikan
        if (video.ended || (video.currentTime >= validDurationSec - 0.05 && video.currentTime > 0.5)) {
          stopRecording();
          return;
        }

        // Cek jika frame macet / video berhenti bergerak di akhir
        if (Math.abs(video.currentTime - lastTime) < 0.001 && video.currentTime > 0.5) {
          stallCount++;
          if (stallCount > 8) {
            stopRecording();
            return;
          }
        } else {
          stallCount = 0;
          lastTime = video.currentTime;
        }

        ctx.drawImage(video, 0, 0, width, height);
        animId = requestAnimationFrame(renderLoop);
      };

      video.onended = () => {
        stopRecording();
      };

      video.onpause = () => {
        if (video.currentTime > 0.5) {
          stopRecording();
        }
      };

      // Safety timeout pas dengan durasi video (maksimal durasi + 200ms)
      const maxDuration = Math.max(2000, validDurationSec * 1000 + 200);
      const safetyTimer = setTimeout(stopRecording, maxDuration);

      recorder.start(100);
      video
        .play()
        .then(() => {
          renderLoop();
        })
        .catch((e) => {
          clearTimeout(safetyTimer);
          stopRecording();
          reject(e);
        });
    });
  } finally {
    URL.revokeObjectURL(srcUrl);
  }
}

/**
 * Unduh video boomerang/frame boomerang dengan jaminan format .MP4.
 * Jika file aslinya adalah WebM, fungsi ini akan otomatis mengonversinya menjadi MP4.
 */
export async function downloadBoomerangAsMp4(
  videoUrlOrBlob: string | Blob,
  preferredFilename = 'frame-boomerang.mp4'
): Promise<void> {
  // Pastikan nama file berakhiran .mp4
  const safeFilename = preferredFilename.replace(/\.(webm|mkv|mov|mp4)$/i, '') + '.mp4';

  const triggerDownload = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  try {
    // 1. Jika URL adalah endpoint file R2 kami dan sudah berupa format .mp4, gunakan direct attachment download
    if (typeof videoUrlOrBlob === 'string') {
      const isR2File = videoUrlOrBlob.includes('/api/r2/file/');
      const isMp4Url = videoUrlOrBlob.toLowerCase().includes('.mp4');

      if (isR2File && isMp4Url) {
        const sep = videoUrlOrBlob.includes('?') ? '&' : '?';
        const directDownloadUrl = `${videoUrlOrBlob}${sep}download=1&filename=${encodeURIComponent(safeFilename)}`;
        triggerDownload(directDownloadUrl, safeFilename);
        return;
      }
    }

    let blob: Blob;
    let isWebm = false;

    if (typeof videoUrlOrBlob === 'string') {
      const urlLower = videoUrlOrBlob.toLowerCase();
      if (urlLower.includes('.webm')) {
        isWebm = true;
      }

      if (videoUrlOrBlob.startsWith('data:') || videoUrlOrBlob.startsWith('blob:')) {
        const res = await fetch(videoUrlOrBlob);
        blob = await res.blob();
      } else {
        const res = await fetch(videoUrlOrBlob, { mode: 'cors' });
        blob = await res.blob();
      }
    } else {
      blob = videoUrlOrBlob;
    }

    if (blob.type.includes('webm')) {
      isWebm = true;
    }

    // Jika video sudah berupa MP4
    if (!isWebm && (blob.type === 'video/mp4' || blob.type === '')) {
      const mp4Blob = new Blob([blob], { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(mp4Blob);
      triggerDownload(blobUrl, safeFilename);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }

    // Jika WebM, coba transcode ke MP4 asli
    try {
      const mp4Blob = await convertWebmToMp4(blob);
      const blobUrl = URL.createObjectURL(mp4Blob);
      triggerDownload(blobUrl, safeFilename);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (transcodeErr) {
      console.warn('Transcode WebM ke MP4 gagal, mengunduh dengan MIME MP4:', transcodeErr);
      const fallbackBlob = new Blob([blob], { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(fallbackBlob);
      triggerDownload(blobUrl, safeFilename);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    }
  } catch (err) {
    console.warn('Gagal unduh MP4 via blob, fallback ke download link langsung:', err);
    if (typeof videoUrlOrBlob === 'string') {
      const sep = videoUrlOrBlob.includes('?') ? '&' : '?';
      const fallbackUrl = `${videoUrlOrBlob}${sep}download=1&filename=${encodeURIComponent(safeFilename)}`;
      triggerDownload(fallbackUrl, safeFilename);
    }
  }
}
