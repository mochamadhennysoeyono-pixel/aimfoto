import { supabase } from '../supabaseClient';

/**
 * Konversi Data URL (Base64) ke Blob objek biner
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binaryString = atob(parts[1]);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

/**
 * Upload foto HD hasil compositing photobooth ke Supabase Storage (Bucket 'photos')
 * dan update kolom final_url di tabel sessions.
 */
export async function uploadFinalPhotoToStorage(
  sessionId: string,
  photoDataUrl: string,
  frameLayoutId?: string,
  status: string = 'paid'
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    if (!photoDataUrl) {
      return { success: false, error: 'Data foto kosong' };
    }

    const blob = dataUrlToBlob(photoDataUrl);
    const fileName = `sessions/${sessionId}.jpg`;

    // 1. Upload file ke bucket 'photos' di Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.warn('Supabase storage upload error:', uploadError.message);
      return { success: false, error: uploadError.message };
    }

    // 2. Dapatkan Public URL resmi dari Supabase Storage
    const { data: publicUrlData } = supabase.storage
      .from('photos')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      return { success: false, error: 'Gagal mendapatkan Public URL dari Storage' };
    }

    // 3. Upsert kolom final_url dan frame_layout_id pada tabel sessions
    try {
      const updatePayload: any = {
        id: sessionId,
        final_url: publicUrl,
        status: status,
      };
      if (frameLayoutId) {
        updatePayload.frame_layout_id = frameLayoutId;
      }

      const { error: dbError } = await supabase
        .from('sessions')
        .upsert([updatePayload], { onConflict: 'id' });

      if (dbError) {
        console.warn('Gagal update sessions di Supabase:', dbError.message);
      } else {
        console.log('Berhasil update sessions di Supabase:', publicUrl, frameLayoutId);
      }
    } catch (dbErr) {
      console.warn('Database update note:', dbErr);
    }

    return {
      success: true,
      publicUrl,
    };
  } catch (err: any) {
    console.error('Fatal upload error:', err);
    return {
      success: false,
      error: err?.message || 'Terjadi kesalahan saat upload ke Supabase Storage',
    };
  }
}

/**
 * Upload video Boomerang soft file ke Supabase Storage (Bucket 'photos')
 */
export async function uploadBoomerangToStorage(
  sessionId: string,
  videoUrlOrBlob: string | Blob,
  slotIndex?: number | 'frame'
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    if (!videoUrlOrBlob) {
      return { success: false, error: 'Data video boomerang kosong' };
    }

    let blob: Blob;
    let contentType = 'video/mp4';

    if (typeof videoUrlOrBlob === 'string') {
      if (videoUrlOrBlob.startsWith('data:')) {
        blob = dataUrlToBlob(videoUrlOrBlob);
        contentType = blob.type || 'video/mp4';
      } else if (videoUrlOrBlob.startsWith('blob:')) {
        const res = await fetch(videoUrlOrBlob);
        blob = await res.blob();
        contentType = blob.type || 'video/mp4';
      } else {
        // Sudah URL publik
        return { success: true, publicUrl: videoUrlOrBlob };
      }
    } else {
      blob = videoUrlOrBlob;
      contentType = blob.type || 'video/mp4';
    }

    const isFrameVideo = slotIndex === 'frame' || slotIndex === 999 || slotIndex === undefined;
    const ext = isFrameVideo ? 'mp4' : (contentType.includes('webm') ? 'webm' : 'mp4');
    const uploadContentType = isFrameVideo && !contentType.includes('mp4') ? 'video/mp4' : contentType;
    const fileName = isFrameVideo
      ? `sessions/${sessionId}_frame_boomerang.${ext}`
      : `sessions/${sessionId}_boomerang_slot_${(slotIndex as number) + 1}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, blob, {
        contentType: uploadContentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn('Supabase boomerang upload error:', uploadError.message);
      return { success: false, error: uploadError.message };
    }

    // Jika ini adalah 1-frame video, simpan juga sebagai fallback utama sessions/${sessionId}_boomerang.mp4
    if (isFrameVideo) {
      try {
        await supabase.storage
          .from('photos')
          .upload(`sessions/${sessionId}_boomerang.mp4`, blob, {
            contentType: 'video/mp4',
            upsert: true,
          });
      } catch (fErr) {
        // Non-fatal fallback
      }
    }

    const { data: publicUrlData } = supabase.storage
      .from('photos')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData?.publicUrl;

    return {
      success: true,
      publicUrl,
    };
  } catch (err: any) {
    console.warn('Boomerang storage upload error:', err);
    return {
      success: false,
      error: err?.message || 'Gagal mengunggah video boomerang ke storage',
    };
  }
}

/**
 * Hapus file foto dari Supabase Storage (Bucket 'photos') untuk sesi tertentu.
 * Menghapus foto HD (.jpg), video boomerang frame (.mp4/.webm), dan seluruh klip video per-slot.
 */
export async function deleteSessionPhotoFromStorage(
  sessionId: string,
  finalUrl?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const pathsToDelete = new Set<string>();

    if (sessionId) {
      // 1. Tambahkan secara eksplisit seluruh kemungkinan nama file yang dihasilkan sesi ini
      pathsToDelete.add(`sessions/${sessionId}.jpg`);
      pathsToDelete.add(`sessions/${sessionId}_frame_boomerang.mp4`);
      pathsToDelete.add(`sessions/${sessionId}_frame_boomerang.webm`);
      pathsToDelete.add(`sessions/${sessionId}_boomerang.mp4`);
      pathsToDelete.add(`sessions/${sessionId}_boomerang.webm`);

      // Klip boomerang per slot (slot 1 sampai 8)
      for (let s = 1; s <= 8; s++) {
        pathsToDelete.add(`sessions/${sessionId}_boomerang_slot_${s}.mp4`);
        pathsToDelete.add(`sessions/${sessionId}_boomerang_slot_${s}.webm`);
      }

      // 2. Query Storage R2 untuk mencari file tambahan apa pun yang berkaitan dengan sessionId
      try {
        const { data: sessionFiles } = await supabase.storage
          .from('photos')
          .list('sessions', { search: sessionId });

        if (sessionFiles && sessionFiles.length > 0) {
          sessionFiles.forEach((file: any) => {
            if (file.name && file.name.includes(sessionId)) {
              pathsToDelete.add(`sessions/${file.name}`);
            }
          });
        }
      } catch (listErr) {
        console.warn('Catatan list file sesi storage saat hapus:', listErr);
      }
    }

    // 3. Jika finalUrl mengandung path spesifik
    if (finalUrl) {
      const match = finalUrl.match(/\/photos\/(.+)$/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        pathsToDelete.add(decoded);
      }
    }

    const fileList = Array.from(pathsToDelete);
    if (fileList.length > 0) {
      const { data, error } = await supabase.storage.from('photos').remove(fileList);
      if (error) {
        console.warn('Gagal hapus file dari Supabase Storage:', error.message);
        return { success: false, error: error.message };
      }
      console.log('Berhasil membersihkan file storage untuk sesi:', sessionId, fileList.length, data);
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Error saat hapus photo storage:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Hapus seluruh file foto & video yang ada di dalam folder sessions pada bucket 'photos'
 */
export async function deleteAllSessionPhotosFromStorage(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // 1. List semua file di dalam folder sessions
    const { data: files, error: listError } = await supabase.storage.from('photos').list('sessions', { limit: 1000 });
    if (listError) {
      console.warn('Gagal list file di folder sessions:', listError.message);
      return { success: false, error: listError.message };
    }

    if (!files || files.length === 0) {
      return { success: true, count: 0 };
    }

    const pathsToDelete = files.map((f: any) => `sessions/${f.name}`);
    
    // Hapus dalam batch 50 file sekaligus
    const chunkSize = 50;
    for (let i = 0; i < pathsToDelete.length; i += chunkSize) {
      const chunk = pathsToDelete.slice(i, i + chunkSize);
      await supabase.storage.from('photos').remove(chunk);
    }

    console.log(`Berhasil menghapus seluruh ${pathsToDelete.length} file sesi di storage`);
    return { success: true, count: pathsToDelete.length };
  } catch (err: any) {
    console.warn('Error saat hapus semua photo storage:', err);
    return { success: false, error: err?.message };
  }
}
