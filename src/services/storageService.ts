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
  frameLayoutId?: string
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

    // 3. Update kolom final_url dan frame_layout_id pada tabel sessions
    try {
      const updatePayload: any = {
        final_url: publicUrl,
        status: 'paid',
      };
      if (frameLayoutId) {
        updatePayload.frame_layout_id = frameLayoutId;
      }

      const { error: dbError } = await supabase
        .from('sessions')
        .update(updatePayload)
        .eq('id', sessionId);

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

    const ext = contentType.includes('webm') ? 'webm' : 'mp4';
    const isFrameVideo = slotIndex === 'frame' || slotIndex === 999 || slotIndex === undefined;
    const fileName = isFrameVideo
      ? `sessions/${sessionId}_frame_boomerang.${ext}`
      : `sessions/${sessionId}_boomerang_slot_${(slotIndex as number) + 1}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, blob, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.warn('Supabase boomerang upload error:', uploadError.message);
      return { success: false, error: uploadError.message };
    }

    // Jika ini adalah 1-frame video, simpan juga sebagai fallback utama sessions/${sessionId}_boomerang.${ext}
    if (isFrameVideo) {
      try {
        await supabase.storage
          .from('photos')
          .upload(`sessions/${sessionId}_boomerang.${ext}`, blob, {
            contentType,
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
 */
export async function deleteSessionPhotoFromStorage(
  sessionId: string,
  finalUrl?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const pathsToDelete: string[] = [];

    // Path standar foto
    if (sessionId) {
      pathsToDelete.push(`sessions/${sessionId}.jpg`);

      // Cari dan hapus juga file video boomerang sesi ini jika ada
      try {
        const { data: sessionFiles } = await supabase.storage
          .from('photos')
          .list('sessions', { search: sessionId });

        if (sessionFiles && sessionFiles.length > 0) {
          sessionFiles.forEach((file) => {
            if (file.name.startsWith(sessionId)) {
              const fullPath = `sessions/${file.name}`;
              if (!pathsToDelete.includes(fullPath)) {
                pathsToDelete.push(fullPath);
              }
            }
          });
        }
      } catch (listErr) {
        console.warn('Catatan list file sesi storage saat hapus:', listErr);
      }
    }

    // Jika finalUrl mengandung path spesifik
    if (finalUrl) {
      const match = finalUrl.match(/\/photos\/(.+)$/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        if (!pathsToDelete.includes(decoded)) {
          pathsToDelete.push(decoded);
        }
      }
    }

    if (pathsToDelete.length > 0) {
      const { data, error } = await supabase.storage.from('photos').remove(pathsToDelete);
      if (error) {
        console.warn('Gagal hapus file dari Supabase Storage:', error.message);
        return { success: false, error: error.message };
      }
      console.log('Berhasil hapus file storage:', pathsToDelete, data);
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Error saat hapus photo storage:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Hapus seluruh file foto yang ada di dalam folder sessions pada bucket 'photos'
 */
export async function deleteAllSessionPhotosFromStorage(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // 1. List semua file di dalam folder sessions
    const { data: files, error: listError } = await supabase.storage.from('photos').list('sessions');
    if (listError) {
      console.warn('Gagal list file di folder sessions:', listError.message);
      return { success: false, error: listError.message };
    }

    if (!files || files.length === 0) {
      return { success: true, count: 0 };
    }

    const pathsToDelete = files.map((f) => `sessions/${f.name}`);
    const { error: removeError } = await supabase.storage.from('photos').remove(pathsToDelete);

    if (removeError) {
      console.warn('Gagal hapus semua file sessions di storage:', removeError.message);
      return { success: false, error: removeError.message };
    }

    console.log(`Berhasil menghapus ${pathsToDelete.length} file di storage`);
    return { success: true, count: pathsToDelete.length };
  } catch (err: any) {
    console.warn('Error saat hapus semua photo storage:', err);
    return { success: false, error: err?.message };
  }
}
