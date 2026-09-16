import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit2,
  Power,
  RefreshCw,
  Upload,
  AlertCircle,
  Check,
  Calendar,
  X,
  FileImage,
  Layers,
  LayoutGrid,
  CheckCircle2,
  ArrowLeft,
  Eye,
  Info,
  Search,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { generateUuid } from '../utils/uuid';
import { AdminEventItem } from './AdminEvents';
import { PhotoboothLayout, LayoutSlot, FrameTheme, FrameLayoutItem } from '../types';
import { DEFAULT_LAYOUTS, sortLayoutsList } from '../data/defaultLayouts';

interface AdminFramesProps {
  initialSelectedEventId?: string | null;
}

export const AdminFrames: React.FC<AdminFramesProps> = ({ initialSelectedEventId }) => {
  const [events, setEvents] = useState<AdminEventItem[]>([]);
  const [layouts, setLayouts] = useState<PhotoboothLayout[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(initialSelectedEventId || 'all');
  const [themes, setThemes] = useState<FrameTheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active theme selected for Part 2 (Kelola Varian Layout)
  const [selectedThemeForLayouts, setSelectedThemeForLayouts] = useState<FrameTheme | null>(null);

  // Part 1: Form add/edit Frame Theme
  const [showAddThemeForm, setShowAddThemeForm] = useState(false);
  const [themeEventId, setThemeEventId] = useState('');
  const [themeName, setThemeName] = useState('');
  const [themeSortOrder, setThemeSortOrder] = useState('1');
  const [themeIsActive, setThemeIsActive] = useState(true);

  // Upload frames per layout in create theme form
  const [layoutUploads, setLayoutUploads] = useState<Record<string, { file: File; previewUrl: string }>>({});
  const [layoutFilterTab, setLayoutFilterTab] = useState<'all' | 'priority' | 'others' | 'selected'>('all');
  const [layoutSearchQuery, setLayoutSearchQuery] = useState('');
  const [savingProgressText, setSavingProgressText] = useState('');

  // Edit Theme Modal
  const [editingTheme, setEditingTheme] = useState<FrameTheme | null>(null);
  const [editThemeName, setEditThemeName] = useState('');
  const [editThemeSortOrder, setEditThemeSortOrder] = useState('1');
  const [editThemeIsActive, setEditThemeIsActive] = useState(true);

  // Delete Theme Modal
  const [themeToDelete, setThemeToDelete] = useState<FrameTheme | null>(null);
  const [isDeletingTheme, setIsDeletingTheme] = useState(false);

  // Part 2: State for Layout Combinations in selectedThemeForLayouts
  const [frameLayouts, setFrameLayouts] = useState<FrameLayoutItem[]>([]);
  const [isLoadingCombinations, setIsLoadingCombinations] = useState(false);
  const [comboLayoutId, setComboLayoutId] = useState('');
  const [comboFile, setComboFile] = useState<File | null>(null);
  const [comboPreviewUrl, setComboPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete combination modal
  const [comboToDelete, setComboToDelete] = useState<FrameLayoutItem | null>(null);
  const [isDeletingCombo, setIsDeletingCombo] = useState(false);

  // 1. Fetch Events
  const fetchEvents = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && data.length > 0) {
        setEvents(data as AdminEventItem[]);
      }
    } catch (e) {
      console.warn('Gagal memuat events:', e);
    }
  }, []);

  // 2. Fetch Layouts
  const fetchLayouts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('layouts')
        .select('*')
        .order('photo_count', { ascending: true });

      if (error || !data || data.length === 0) {
        setLayouts(DEFAULT_LAYOUTS);
      } else {
        const parsed: PhotoboothLayout[] = data.map((item: any) => {
          let parsedSlots: LayoutSlot[] = [];
          if (Array.isArray(item.slots)) {
            parsedSlots = item.slots;
          } else if (typeof item.slots === 'string') {
            try {
              parsedSlots = JSON.parse(item.slots);
            } catch (e) {
              parsedSlots = [];
            }
          }

          return {
            id: item.id,
            name: item.name || 'Layout',
            ratio: item.ratio || '1:1',
            canvas_width: item.canvas_width || 1080,
            canvas_height: item.canvas_height || 1350,
            photo_count: item.photo_count || parsedSlots.length || 1,
            slots: parsedSlots,
          };
        });
        setLayouts(sortLayoutsList(parsed));
      }
    } catch (e) {
      console.warn('Fallback ke default layouts:', e);
      setLayouts(sortLayoutsList(DEFAULT_LAYOUTS));
    }
  }, []);

  // 3. Fetch Frame Themes (tabel `frames`)
  const fetchThemes = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      let query = supabase.from('frames').select('*');

      if (selectedEventId && selectedEventId !== 'all') {
        query = query.eq('event_id', selectedEventId);
      }

      const { data: dbThemes, error } = await query.order('sort_order', { ascending: true });

      if (error) {
        console.warn('Error fetching frames themes:', error.message);
        setErrorMsg(`Gagal memuat tema frame: ${error.message}`);
      } else if (dbThemes) {
        // Query counts of frame_layouts for each theme
        const { data: allCombinations } = await supabase
          .from('frame_layouts')
          .select('id, frame_id, image_url');

        const countsMap = new Map<string, number>();
        const previewMap = new Map<string, string>();
        if (allCombinations) {
          allCombinations.forEach((c: any) => {
            countsMap.set(c.frame_id, (countsMap.get(c.frame_id) || 0) + 1);
            if (c.image_url && !previewMap.has(c.frame_id)) {
              previewMap.set(c.frame_id, c.image_url);
            }
          });
        }

        const mapped: FrameTheme[] = dbThemes.map((t: any) => ({
          id: t.id,
          name: t.name || 'Tema Tanpa Nama',
          event_id: t.event_id,
          sort_order: t.sort_order ?? 1,
          is_active: t.is_active ?? true,
          description: t.description,
          created_at: t.created_at,
          image_url: previewMap.get(t.id) || t.image_url || '',
          variants_count: countsMap.get(t.id) || 0,
        }));

        setThemes(mapped);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat daftar tema frame');
    } finally {
      setIsLoading(false);
    }
  }, [selectedEventId]);

  // 4. Fetch Combinations for a selected Theme
  const fetchThemeCombinations = useCallback(async (themeId: string) => {
    setIsLoadingCombinations(true);
    try {
      const { data, error } = await supabase
        .from('frame_layouts')
        .select('*, layout:layouts(*)')
        .eq('frame_id', themeId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Error fetching frame_layouts:', error.message);
      } else if (data) {
        const mapped: FrameLayoutItem[] = data.map((item: any) => {
          let layoutObj: PhotoboothLayout | undefined = undefined;
          if (item.layout) {
            let parsedSlots: LayoutSlot[] = [];
            if (Array.isArray(item.layout.slots)) {
              parsedSlots = item.layout.slots;
            } else if (typeof item.layout.slots === 'string') {
              try {
                parsedSlots = JSON.parse(item.layout.slots);
              } catch (e) {}
            }

            layoutObj = {
              id: item.layout.id,
              name: item.layout.name,
              ratio: item.layout.ratio || '2:3',
              canvas_width: item.layout.canvas_width || 1200,
              canvas_height: item.layout.canvas_height || 1800,
              photo_count: item.layout.photo_count || parsedSlots.length || 1,
              slots: parsedSlots,
            };
          } else {
            layoutObj = layouts.find((l) => l.id === item.layout_id) || DEFAULT_LAYOUTS[0];
          }

          return {
            id: item.id,
            frame_id: item.frame_id,
            layout_id: item.layout_id,
            image_url: item.image_url,
            created_at: item.created_at,
            layout: layoutObj,
          };
        });

        setFrameLayouts(mapped);
      }
    } catch (err: any) {
      console.warn('Error in fetchThemeCombinations:', err);
    } finally {
      setIsLoadingCombinations(false);
    }
  }, [layouts]);

  useEffect(() => {
    fetchEvents();
    fetchLayouts();
  }, [fetchEvents, fetchLayouts]);

  useEffect(() => {
    fetchThemes();
  }, [fetchThemes]);

  useEffect(() => {
    if (selectedThemeForLayouts) {
      fetchThemeCombinations(selectedThemeForLayouts.id);
    }
  }, [selectedThemeForLayouts, fetchThemeCombinations]);

  // Set default event and layout in forms
  useEffect(() => {
    if (events.length > 0 && !themeEventId) {
      setThemeEventId(selectedEventId !== 'all' ? selectedEventId : events[0].id);
    }
  }, [events, selectedEventId, themeEventId]);

  useEffect(() => {
    if (layouts.length > 0 && !comboLayoutId) {
      setComboLayoutId(layouts[0].id);
    }
  }, [layouts, comboLayoutId]);

  // Handle PNG file selection for combination
  const handleComboFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Format file tidak didukung. Harap unggah format PNG transparan.');
      return;
    }

    const maxSize = 8 * 1024 * 1024; // 8MB
    if (file.size > maxSize) {
      setErrorMsg(`Ukuran file terlalu besar (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maksimal 8 MB.`);
      return;
    }

    setComboFile(file);
    setComboPreviewUrl(URL.createObjectURL(file));
    setErrorMsg(null);
  };

  // Helper to upload PNG frame file with safe fallback
  const uploadFrameFileHelper = async (file: File, prefix: string): Promise<string> => {
    const fileExt = file.name.split('.').pop() || 'png';
    const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15);
    const fileName = `${cleanPrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('frames-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/png',
        });

      if (uploadError) {
        console.warn('Storage upload error, using data URL fallback:', uploadError.message);
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      const { data: publicUrlData } = supabase.storage
        .from('frames-assets')
        .getPublicUrl(filePath);
      return publicUrlData.publicUrl;
    } catch (err) {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  };

  // Handle single layout frame file selection in theme creation form
  const handleSelectLayoutFile = (layoutId: string, file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Format file tidak didukung. Harap unggah format PNG transparan.');
      return;
    }

    const maxSize = 15 * 1024 * 1024; // 15MB
    if (file.size > maxSize) {
      setErrorMsg(`Ukuran file terlalu besar (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maksimal 15 MB.`);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLayoutUploads((prev) => ({
      ...prev,
      [layoutId]: { file, previewUrl },
    }));
    setErrorMsg(null);
  };

  // Remove selected layout frame file
  const handleRemoveLayoutFile = (layoutId: string) => {
    setLayoutUploads((prev) => {
      const copy = { ...prev };
      if (copy[layoutId]?.previewUrl) {
        URL.revokeObjectURL(copy[layoutId].previewUrl);
      }
      delete copy[layoutId];
      return copy;
    });
  };

  // PART 1: Create Frame Theme (tabel `frames`) beserta varian layout langsung
  const handleCreateTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!themeEventId) {
      setErrorMsg('Pilih event tujuan untuk tema ini.');
      return;
    }
    if (!themeName.trim()) {
      setErrorMsg('Nama tema frame wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const newThemeId = generateUuid();
      const sortOrderNum = parseInt(themeSortOrder, 10) || 1;
      const uploadedEntries = Object.entries(layoutUploads) as [string, { file: File; previewUrl: string }][];

      setSavingProgressText(`Menyiapkan tema frame "${themeName.trim()}"...`);

      // 1. Upload semua frame PNG yang dipilih
      let firstUploadedUrl = '';
      const combinationsToInsert: { id: string; frame_id: string; layout_id: string; image_url: string }[] = [];

      let index = 1;
      for (const [layoutId, uploadItem] of uploadedEntries) {
        const layoutObj = layouts.find((l) => l.id === layoutId);
        setSavingProgressText(`Mengunggah desain frame ${index}/${uploadedEntries.length} (${layoutObj?.name || 'Layout'})...`);
        const finalUrl = await uploadFrameFileHelper(uploadItem.file, `${themeName}_${layoutObj?.name || layoutId}`);
        if (!firstUploadedUrl) firstUploadedUrl = finalUrl;

        combinationsToInsert.push({
          id: generateUuid(),
          frame_id: newThemeId,
          layout_id: layoutId,
          image_url: finalUrl,
        });
        index++;
      }

      setSavingProgressText('Menyimpan data tema ke database...');

      // 2. Insert tabel frames (tanpa kolom description karena tidak ada di skema tabel)
      const { data, error } = await supabase.from('frames').insert([
        {
          id: newThemeId,
          name: themeName.trim(),
          event_id: themeEventId,
          sort_order: sortOrderNum,
          is_active: themeIsActive,
          image_url: firstUploadedUrl || '',
        },
      ]).select().single();

      if (error) throw error;

      // 3. Insert ke frame_layouts per item agar aman dari batasan ukuran payload
      let savedCombinationsCount = 0;
      if (combinationsToInsert.length > 0) {
        setSavingProgressText(`Menghubungkan ${combinationsToInsert.length} varian layout...`);
        for (const item of combinationsToInsert) {
          const { error: comboError } = await supabase
            .from('frame_layouts')
            .insert([item]);

          if (comboError) {
            console.warn('Peringatan saat simpan varian layout:', comboError.message);
          } else {
            savedCombinationsCount++;
          }
        }
      }

      setSuccessMsg(
        savedCombinationsCount > 0
          ? `Tema Frame "${themeName.trim()}" berhasil dibuat beserta ${savedCombinationsCount} desain varian layout!`
          : `Tema Frame "${themeName.trim()}" berhasil dibuat!`
      );

      // Bersihkan formulir & state
      setShowAddThemeForm(false);
      setThemeName('');
      setLayoutUploads({});
      setSavingProgressText('');

      await fetchThemes();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal membuat tema frame.');
    } finally {
      setIsSubmitting(false);
      setSavingProgressText('');
    }
  };

  // Toggle Theme Active status
  const handleToggleThemeActive = async (theme: FrameTheme) => {
    const updatedStatus = !theme.is_active;
    try {
      const { error } = await supabase
        .from('frames')
        .update({ is_active: updatedStatus })
        .eq('id', theme.id);

      if (error) throw error;

      setThemes((prev) =>
        prev.map((t) => (t.id === theme.id ? { ...t, is_active: updatedStatus } : t))
      );
    } catch (err: any) {
      setErrorMsg(`Gagal mengubah status tema: ${err.message}`);
    }
  };

  // Save Edit Theme
  const handleSaveEditTheme = async () => {
    if (!editingTheme) return;
    if (!editThemeName.trim()) {
      setErrorMsg('Nama tema frame tidak boleh kosong.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('frames')
        .update({
          name: editThemeName.trim(),
          sort_order: parseInt(editThemeSortOrder, 10) || 1,
          is_active: editThemeIsActive,
        })
        .eq('id', editingTheme.id);

      if (error) throw error;

      setEditingTheme(null);
      setSuccessMsg('Perubahan tema frame berhasil disimpan.');
      fetchThemes();
    } catch (err: any) {
      setErrorMsg(`Gagal menyimpan perubahan tema: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Theme
  const handleDeleteTheme = async () => {
    if (!themeToDelete) return;
    setIsDeletingTheme(true);
    try {
      // 1. Delete linked frame_layouts first
      await supabase.from('frame_layouts').delete().eq('frame_id', themeToDelete.id);

      // 2. Delete frame theme
      const { error } = await supabase.from('frames').delete().eq('id', themeToDelete.id);
      if (error) throw error;

      setThemeToDelete(null);
      setSuccessMsg(`Tema "${themeToDelete.name}" berhasil dihapus.`);
      if (selectedThemeForLayouts?.id === themeToDelete.id) {
        setSelectedThemeForLayouts(null);
      }
      fetchThemes();
    } catch (err: any) {
      setErrorMsg(`Gagal menghapus tema: ${err.message}`);
    } finally {
      setIsDeletingTheme(false);
    }
  };

  // PART 2: Add Combination to selectedThemeForLayouts (tabel `frame_layouts`)
  const handleAddCombination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThemeForLayouts) return;
    if (!comboLayoutId) {
      setErrorMsg('Pilih Layout dari dropdown.');
      return;
    }
    if (!comboFile && !comboPreviewUrl) {
      setErrorMsg('Harap unggah SATU file PNG transparan desain dekoratif untuk kombinasi ini.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const newComboId = generateUuid();
      let finalImageUrl = '';

      if (comboFile) {
        const fileExt = comboFile.name.split('.').pop() || 'png';
        const cleanThemePrefix = selectedThemeForLayouts.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 10);
        const fileName = `${cleanThemePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('frames-assets')
          .upload(filePath, comboFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: comboFile.type,
          });

        if (uploadError) {
          console.warn('Storage upload notice, falling back to data URL:', uploadError.message);
          const reader = new FileReader();
          finalImageUrl = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(comboFile);
          });
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('frames-assets')
            .getPublicUrl(filePath);
          finalImageUrl = publicUrlData.publicUrl;
        }
      } else if (comboPreviewUrl) {
        finalImageUrl = comboPreviewUrl;
      }

      // Insert into frame_layouts table
      const { error: insertError } = await supabase.from('frame_layouts').insert([
        {
          id: newComboId,
          frame_id: selectedThemeForLayouts.id,
          layout_id: comboLayoutId,
          image_url: finalImageUrl,
        },
      ]);

      if (insertError) {
        throw new Error(`Gagal menyimpan ke tabel frame_layouts: ${insertError.message}`);
      }

      // Also ensure parent frame record has an image_url if empty
      await supabase
        .from('frames')
        .update({ image_url: finalImageUrl })
        .eq('id', selectedThemeForLayouts.id);

      const targetLayoutObj = layouts.find((l) => l.id === comboLayoutId);
      setSuccessMsg(`Kombinasi Layout "${targetLayoutObj?.name || 'Layout'}" berhasil ditambahkan ke tema ${selectedThemeForLayouts.name}!`);

      // Reset form
      setComboFile(null);
      setComboPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Refresh combinations and theme counts
      fetchThemeCombinations(selectedThemeForLayouts.id);
      fetchThemes();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan kombinasi layout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete combination from frame_layouts
  const handleDeleteCombination = async () => {
    if (!comboToDelete || !selectedThemeForLayouts) return;
    setIsDeletingCombo(true);
    try {
      const { error } = await supabase
        .from('frame_layouts')
        .delete()
        .eq('id', comboToDelete.id);

      if (error) throw error;

      setComboToDelete(null);
      setSuccessMsg('Kombinasi layout berhasil dihapus.');
      fetchThemeCombinations(selectedThemeForLayouts.id);
      fetchThemes();
    } catch (err: any) {
      setErrorMsg(`Gagal menghapus kombinasi layout: ${err.message}`);
    } finally {
      setIsDeletingCombo(false);
    }
  };

  const selectedComboLayout = layouts.find((l) => l.id === comboLayoutId) || layouts[0] || null;

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PART 2: SUB-HALAMAN KELOLA VARIAN LAYOUT PER TEMA FRAME */}
      {/* ========================================================================= */}
      {selectedThemeForLayouts ? (
        <div className="space-y-6">
          {/* Top Breadcrumb & Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div>
              <button
                onClick={() => setSelectedThemeForLayouts(null)}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400 mb-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Daftar Tema Frame</span>
              </button>
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Layers className="w-5 h-5" />
                </span>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Varian Layout: {selectedThemeForLayouts.name}
                  </h1>
                  <p className="text-xs text-zinc-400">
                    Satu tema frame dapat memiliki beberapa kombinasi layout dengan file PNG dekoratif masing-masing
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${selectedThemeForLayouts.is_active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                Status: {selectedThemeForLayouts.is_active ? 'Aktif' : 'Non-Aktif'}
              </span>
              <button
                onClick={() => fetchThemeCombinations(selectedThemeForLayouts.id)}
                disabled={isLoadingCombinations}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCombinations ? 'animate-spin text-amber-400' : ''}`} />
                <span>Segarkan</span>
              </button>
            </div>
          </div>

          {/* Form Tambah Varian Layout */}
          <form
            onSubmit={handleAddCombination}
            className="rounded-2xl bg-gradient-to-b from-zinc-900 to-[#0a0c13] border border-amber-500/30 p-5 md:p-6 space-y-5 shadow-2xl"
          >
            <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-400" />
                  Tambah Kombinasi Layout ke Tema &quot;{selectedThemeForLayouts.name}&quot;
                </h2>
                <p className="text-xs text-zinc-400">
                  Pilih satu layout dari tabel database, lalu unggah SATU file PNG desain dekoratif khusus layout tersebut
                </p>
              </div>
              <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                tabel `frame_layouts`
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pilih Layout Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono flex items-center justify-center font-bold">1</span>
                  Pilih Layout dari Database:
                </label>
                <select
                  value={comboLayoutId}
                  onChange={(e) => setComboLayoutId(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-xs text-amber-300 font-semibold focus:border-amber-400 focus:outline-none"
                >
                  <option value="" disabled>-- Pilih Layout --</option>
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id} className="text-white">
                      {l.name} ({l.photo_count} foto • {l.canvas_width}×{l.canvas_height} px • Rasio {l.ratio})
                    </option>
                  ))}
                </select>
              </div>

              {/* Layout Specifications Banner */}
              {selectedComboLayout && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono flex items-center justify-center font-bold">2</span>
                    Spesifikasi Kanvas:
                  </label>
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs h-[42px]">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-zinc-300 text-xs">
                        {selectedComboLayout.canvas_width} × {selectedComboLayout.canvas_height} px ({selectedComboLayout.ratio})
                      </span>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {selectedComboLayout.photo_count} Slot Foto
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Upload File PNG Desain Dekoratif */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono flex items-center justify-center font-bold">3</span>
                Upload SATU File PNG Desain Dekoratif Khusus Kombinasi Ini:
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="md:col-span-2 border-2 border-dashed border-zinc-700 hover:border-amber-400/80 rounded-2xl p-6 bg-zinc-950/60 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleComboFileChange}
                    className="hidden"
                  />

                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>

                  <p className="text-xs font-semibold text-white">
                    {comboFile ? comboFile.name : 'Klik atau seret file PNG desain ke sini'}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Format disarankan: PNG transparan resolusi {selectedComboLayout ? `${selectedComboLayout.canvas_width}×${selectedComboLayout.canvas_height}px` : 'sesuai layout'} (Maks. 8MB)
                  </p>

                  {comboFile && (
                    <span className="mt-2 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      Ukuran: {(comboFile.size / 1024).toFixed(1)} KB • Siap Simpan
                    </span>
                  )}
                </div>

                {/* Preview Box with Slot Guide */}
                <div className="border border-zinc-800 rounded-2xl p-3 bg-zinc-950 flex flex-col items-center justify-center relative min-h-[160px]">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Pratinjau Kombinasi:</span>
                  {comboPreviewUrl ? (
                    <div
                      className="relative max-h-[160px] w-auto rounded border border-zinc-700 overflow-hidden bg-zinc-900"
                      style={{
                        aspectRatio: selectedComboLayout ? `${selectedComboLayout.canvas_width} / ${selectedComboLayout.canvas_height}` : '3/4',
                      }}
                    >
                      {/* Visual Slots Guide */}
                      {selectedComboLayout?.slots.map((slot, i) => (
                        <div
                          key={slot.index ?? i}
                          style={{
                            position: 'absolute',
                            left: `${slot.x}%`,
                            top: `${slot.y}%`,
                            width: `${slot.width}%`,
                            height: `${slot.height}%`,
                          }}
                          className="bg-zinc-800 border border-zinc-600 flex items-center justify-center text-[8px] font-mono text-zinc-400"
                        >
                          Slot #{slot.index ?? i + 1}
                        </div>
                      ))}
                      {/* PNG Overlay */}
                      <img
                        src={comboPreviewUrl}
                        alt="Preview Desain"
                        className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-600 text-xs py-4">
                      <FileImage className="w-8 h-8 mb-1 opacity-50" />
                      <span>Belum ada file dipilih</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-800">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke tabel frame_layouts...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Simpan Kombinasi Layout</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Daftar Kombinasi Layout Yang Sudah Ada */}
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  Kombinasi Layout Terdaftar ({frameLayouts.length})
                </h2>
                <span className="text-[11px] font-mono text-zinc-500">
                  Tema: {selectedThemeForLayouts.name}
                </span>
              </div>
            </div>

            {isLoadingCombinations ? (
              <div className="p-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                <span>Memuat kombinasi layout dari database...</span>
              </div>
            ) : frameLayouts.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-3">
                <Layers className="w-8 h-8 text-zinc-600" />
                <p>Belum ada kombinasi layout untuk tema ini.</p>
                <p className="text-zinc-500 text-[11px]">
                  Pilih layout dan upload file PNG di formulir atas untuk menambahkan kombinasi pertama.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4">
                {frameLayouts.map((combo) => {
                  const layout = combo.layout || layouts.find((l) => l.id === combo.layout_id) || DEFAULT_LAYOUTS[0];

                  return (
                    <div
                      key={combo.id}
                      className="rounded-xl bg-zinc-950 border border-zinc-800/80 p-3 flex flex-col justify-between space-y-3 group hover:border-amber-500/40 transition-all"
                    >
                      {/* Visual Preview */}
                      <div className="relative w-full aspect-[3/4] rounded-lg bg-zinc-900 overflow-hidden border border-zinc-800 flex items-center justify-center p-1">
                        {/* Slot guide */}
                        <div
                          className="relative w-full h-full"
                          style={{
                            aspectRatio: `${layout.canvas_width} / ${layout.canvas_height}`,
                          }}
                        >
                          {layout.slots.map((s, i) => (
                            <div
                              key={s.index ?? i}
                              style={{
                                position: 'absolute',
                                left: `${s.x}%`,
                                top: `${s.y}%`,
                                width: `${s.width}%`,
                                height: `${s.height}%`,
                              }}
                              className="bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-[7px] font-mono text-zinc-500"
                            >
                              #{s.index ?? i + 1}
                            </div>
                          ))}
                          <img
                            src={combo.image_url}
                            alt={layout.name}
                            className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                          />
                        </div>
                      </div>

                      {/* Info & Badges */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white text-xs truncate">
                            {layout.name}
                          </span>
                          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0">
                            {layout.photo_count} Foto
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 font-mono">
                          {layout.canvas_width} × {layout.canvas_height} px • Rasio {layout.ratio}
                        </p>
                      </div>

                      {/* Action Delete */}
                      <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-mono">
                          ID: {combo.id.slice(0, 8)}...
                        </span>
                        <button
                          onClick={() => setComboToDelete(combo)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Hapus Varian</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* PART 1: DAFTAR & FORM TEMA FRAME (tabel `frames`) */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Top Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ImageIcon className="w-5 h-5" />
                </span>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Kelola Tema Frame Photobooth
                  </h1>
                  <p className="text-xs text-zinc-400">
                    Atur tema frame per event, lalu kelola kombinasi layout & PNG dekoratif per tema
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={fetchThemes}
                disabled={isLoading}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
                <span>Segarkan</span>
              </button>

              <button
                onClick={() => setShowAddThemeForm(!showAddThemeForm)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                {showAddThemeForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{showAddThemeForm ? 'Tutup Formulir' : 'Buat Tema Frame Baru'}</span>
              </button>
            </div>
          </div>

          {/* Filter Berdasarkan Event */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-zinc-300">Filter Berdasarkan Event:</span>
            </div>

            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-sans cursor-pointer"
            >
              <option value="all">Semua Event (Global)</option>
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name} ({evt.location || 'Aktif'})
                </option>
              ))}
            </select>
          </div>

          {/* Form Buat Tema Frame Baru */}
          {showAddThemeForm && (
            <form
              onSubmit={handleCreateTheme}
              className="rounded-2xl bg-gradient-to-b from-zinc-900 to-[#0a0c13] border border-amber-500/30 p-5 md:p-6 space-y-5 shadow-2xl"
            >
              <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-amber-400" />
                    Formulir Buat Tema Frame Baru
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Isi informasi tema frame dan langsung unggah desain file frame PNG untuk masing-masing layout di bawah ini.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                  tabel `frames` &amp; `frame_layouts`
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Pilih Event */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Pilih Event:</label>
                  <select
                    value={themeEventId}
                    onChange={(e) => setThemeEventId(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="" disabled>-- Pilih Event Terkait --</option>
                    {events.map((evt) => (
                      <option key={evt.id} value={evt.id}>
                        {evt.name} ({evt.location || 'Indonesia'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Nama Tema */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Nama Tema Frame:</label>
                  <input
                    type="text"
                    placeholder="Contoh: Autumn Korean Foliage, Classic Wedding White"
                    value={themeName}
                    onChange={(e) => setThemeName(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none placeholder:text-zinc-600"
                  />
                </div>

                {/* 3. Urutan Tampil */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">Urutan Tampil (Sort Order):</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={themeSortOrder}
                    onChange={(e) => setThemeSortOrder(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none font-mono"
                  />
                </div>

                {/* 4. Status Aktif Kiosk */}
                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="text-xs font-semibold text-zinc-300">Status Visibilitas Kiosk:</label>
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer hover:border-zinc-700">
                    <input
                      type="checkbox"
                      id="themeIsActive"
                      checked={themeIsActive}
                      onChange={(e) => setThemeIsActive(e.target.checked)}
                      className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                    />
                    <span className="text-xs text-zinc-300 font-medium">
                      Aktifkan tema ini di kiosk publik tamu
                    </span>
                  </label>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* DAFTAR LAYOUT & UPLOAD DESAIN FRAME PER LAYOUT */}
              {/* ========================================================================= */}
              <div className="pt-4 border-t border-zinc-800 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-amber-400" />
                      Daftar Layout &amp; Upload Desain Frame
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Unggah file PNG transparan untuk masing-masing layout di bawah ini. Anda bisa mengunggah untuk satu, beberapa, atau sekaligus.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono px-3 py-1 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                      {Object.keys(layoutUploads).length} layout frame dipilih
                    </span>
                  </div>
                </div>

                {/* Filter Tabs & Search */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    <button
                      type="button"
                      onClick={() => setLayoutFilterTab('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        layoutFilterTab === 'all'
                          ? 'bg-amber-500 text-zinc-950 shadow'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      Semua Layout ({layouts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutFilterTab('priority')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        layoutFilterTab === 'priority'
                          ? 'bg-amber-500 text-zinc-950 shadow'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      Layout 1 – 14 ({layouts.filter((l) => {
                        const m = l.name.match(/Layout\s*(\d+)/i);
                        if (!m) return false;
                        const n = parseInt(m[1], 10);
                        return n >= 1 && n <= 14;
                      }).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutFilterTab('others')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        layoutFilterTab === 'others'
                          ? 'bg-amber-500 text-zinc-950 shadow'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      Layout Lainnya ({layouts.filter((l) => {
                        const m = l.name.match(/Layout\s*(\d+)/i);
                        if (!m) return true;
                        const n = parseInt(m[1], 10);
                        return n < 1 || n > 14;
                      }).length})
                    </button>
                    {Object.keys(layoutUploads).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setLayoutFilterTab('selected')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                          layoutFilterTab === 'selected'
                            ? 'bg-emerald-500 text-zinc-950 shadow font-bold'
                            : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/40'
                        }`}
                      >
                        ✓ Siap Diupload ({Object.keys(layoutUploads).length})
                      </button>
                    )}
                  </div>

                  {/* Search Layout */}
                  <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Cari nama layout..."
                      value={layoutSearchQuery}
                      onChange={(e) => setLayoutSearchQuery(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Grid Layouts Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 max-h-[460px] overflow-y-auto pr-1 p-0.5">
                  {layouts
                    .filter((layout) => {
                      const m = layout.name.match(/Layout\s*(\d+)/i);
                      const is1to14 = m ? parseInt(m[1], 10) >= 1 && parseInt(m[1], 10) <= 14 : false;

                      if (layoutFilterTab === 'priority' && !is1to14) return false;
                      if (layoutFilterTab === 'others' && is1to14) return false;
                      if (layoutFilterTab === 'selected' && !layoutUploads[layout.id]) return false;

                      if (layoutSearchQuery.trim()) {
                        const q = layoutSearchQuery.toLowerCase();
                        return (
                          layout.name.toLowerCase().includes(q) ||
                          layout.ratio.toLowerCase().includes(q) ||
                          `${layout.photo_count}`.includes(q)
                        );
                      }
                      return true;
                    })
                    .map((layout) => {
                      const uploadItem = layoutUploads[layout.id];
                      const isUploaded = Boolean(uploadItem);

                      return (
                        <div
                          key={layout.id}
                          id={`form-layout-card-${layout.id}`}
                          className={`rounded-2xl border p-3 transition-all flex flex-col justify-between ${
                            isUploaded
                              ? 'bg-amber-500/10 border-amber-500/80 ring-1 ring-amber-500/30'
                              : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700'
                          }`}
                        >
                          {/* Card Header */}
                          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-800/80">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white truncate">
                                {layout.name}
                              </span>
                              {(() => {
                                const match = layout.name.match(/Layout\s*(\d+)/i);
                                const num = match ? parseInt(match[1], 10) : 0;
                                if (num >= 1 && num <= 14) {
                                  return (
                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold shrink-0">
                                      #{num}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                                {layout.photo_count} Foto
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400">
                                {layout.ratio}
                              </span>
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="flex items-center gap-3">
                            {/* Mini Visual Canvas Preview */}
                            <div className="w-20 shrink-0 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-700/80 flex items-center justify-center p-1 relative shadow-inner">
                              <div
                                className="relative w-full rounded overflow-hidden bg-zinc-950"
                                style={{
                                  aspectRatio: `${layout.canvas_width} / ${layout.canvas_height}`,
                                }}
                              >
                                {layout.slots.map((slot, i) => (
                                  <div
                                    key={slot.index ?? i}
                                    style={{
                                      position: 'absolute',
                                      left: `${slot.x}%`,
                                      top: `${slot.y}%`,
                                      width: `${slot.width}%`,
                                      height: `${slot.height}%`,
                                      borderRadius: '2px',
                                    }}
                                    className="bg-zinc-800/90 border border-zinc-600/60 flex items-center justify-center text-[7px] font-mono text-zinc-400 font-bold"
                                  >
                                    #{slot.index ?? i + 1}
                                  </div>
                                ))}

                                {/* Real-time PNG frame overlay if selected */}
                                {uploadItem && (
                                  <img
                                    src={uploadItem.previewUrl}
                                    alt={`Frame ${layout.name}`}
                                    className="absolute inset-0 w-full h-full object-fill pointer-events-none"
                                  />
                                )}
                              </div>
                            </div>

                            {/* Upload Area & File Actions */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-zinc-400 font-mono">
                                  {layout.canvas_width}×{layout.canvas_height} px
                                </span>
                                {isUploaded ? (
                                  <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Siap Disimpan
                                  </span>
                                ) : (
                                  <span className="text-zinc-500 font-mono">
                                    Belum ada frame
                                  </span>
                                )}
                              </div>

                              {isUploaded ? (
                                <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-700/80 flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-white font-medium text-[11px] truncate">
                                      {uploadItem.file.name}
                                    </p>
                                    <p className="text-zinc-500 font-mono text-[9px]">
                                      {(uploadItem.file.size / 1024).toFixed(1)} KB
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <label
                                      htmlFor={`file-input-${layout.id}`}
                                      className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold cursor-pointer transition-colors border border-zinc-700"
                                    >
                                      Ganti
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveLayoutFile(layout.id)}
                                      className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] cursor-pointer transition-colors border border-rose-500/20"
                                      title="Hapus file frame ini"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <label
                                  htmlFor={`file-input-${layout.id}`}
                                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-zinc-700 hover:border-amber-400/80 hover:bg-zinc-900 bg-zinc-900/40 text-center flex flex-col items-center justify-center cursor-pointer transition-all group"
                                >
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 group-hover:text-amber-300">
                                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Upload Frame PNG</span>
                                  </div>
                                  <span className="text-[9px] text-zinc-500 mt-0.5">
                                    PNG transparan resolusi {layout.canvas_width}×{layout.canvas_height}px
                                  </span>
                                </label>
                              )}

                              {/* Hidden file input */}
                              <input
                                id={`file-input-${layout.id}`}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleSelectLayoutFile(layout.id, f);
                                  e.target.value = '';
                                }}
                                className="hidden"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex items-center justify-between border-t border-zinc-800">
                <div className="text-xs text-zinc-400">
                  {Object.keys(layoutUploads).length > 0 ? (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      {Object.keys(layoutUploads).length} file frame layout siap diupload dan disimpan
                    </span>
                  ) : (
                    <span className="text-zinc-500 text-[11px]">
                      Tip: Anda bisa upload desain layout sekarang atau menambahkannya nanti.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddThemeForm(false);
                      setLayoutUploads({});
                    }}
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{savingProgressText || 'Menyimpan...'}</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>
                          {Object.keys(layoutUploads).length > 0
                            ? `Simpan Tema Frame & Upload (${Object.keys(layoutUploads).length} Desain)`
                            : 'Simpan Tema Frame'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Table Daftar Tema Frame */}
          <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">
                  Daftar Tema Frame ({themes.length})
                </h2>
                <span className="text-[11px] font-mono text-zinc-500">
                  tabel `frames`
                </span>
              </div>
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                <span>Memuat tema frame dari database...</span>
              </div>
            ) : themes.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-3">
                <ImageIcon className="w-8 h-8 text-zinc-600" />
                <p>Belum ada tema frame yang dibuat untuk event ini.</p>
                <button
                  onClick={() => setShowAddThemeForm(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs cursor-pointer hover:bg-amber-400"
                >
                  Buat Tema Frame Sekarang
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 text-[11px] font-mono uppercase bg-zinc-950/40">
                      <th className="py-3 px-4">Nama Tema</th>
                      <th className="py-3 px-4">Event Terkait</th>
                      <th className="py-3 px-4">Varian Layout</th>
                      <th className="py-3 px-4">Urutan</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {themes.map((theme) => {
                      const matchedEvent = events.find((e) => e.id === theme.event_id);

                      return (
                        <tr key={theme.id} className="hover:bg-zinc-800/30 transition-colors">
                          {/* Nama Tema */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                                <Layers className="w-4 h-4" />
                              </span>
                              <div>
                                <span className="font-bold text-white block text-xs">
                                  {theme.name}
                                </span>
                                {theme.description && (
                                  <span className="text-[11px] text-zinc-400 block line-clamp-1">
                                    {theme.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Event */}
                          <td className="py-3 px-4">
                            <span className="text-zinc-300 font-medium">
                              {matchedEvent?.name || 'Event Global'}
                            </span>
                          </td>

                          {/* Varian Layout Count */}
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-semibold font-mono">
                              <LayoutGrid className="w-3 h-3" />
                              {theme.variants_count ?? 0} Varian Layout
                            </span>
                          </td>

                          {/* Urutan */}
                          <td className="py-3 px-4 font-mono text-zinc-300">
                            #{theme.sort_order ?? 1}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleThemeActive(theme)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                                theme.is_active
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                              }`}
                            >
                              {theme.is_active ? '● Aktif' : '○ Non-Aktif'}
                            </button>
                          </td>

                          {/* Aksi */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Kelola Varian Layout Button */}
                              <button
                                onClick={() => setSelectedThemeForLayouts(theme)}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow shadow-amber-500/20 cursor-pointer"
                                title="Kelola Varian Layout"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Kelola Varian</span>
                              </button>

                              {/* Edit Theme */}
                              <button
                                onClick={() => {
                                  setEditingTheme(theme);
                                  setEditThemeName(theme.name);
                                  setEditThemeSortOrder(String(theme.sort_order ?? 1));
                                  setEditThemeIsActive(theme.is_active ?? true);
                                }}
                                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                title="Ubah Tema"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Hapus Theme */}
                              <button
                                onClick={() => setThemeToDelete(theme)}
                                className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Hapus Tema"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT THEME MODAL */}
      {editingTheme && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white">Edit Tema Frame</h3>
              <button
                onClick={() => setEditingTheme(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Nama Tema:</label>
                <input
                  type="text"
                  value={editThemeName}
                  onChange={(e) => setEditThemeName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Urutan Tampil:</label>
                <input
                  type="number"
                  value={editThemeSortOrder}
                  onChange={(e) => setEditThemeSortOrder(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white focus:border-amber-400 focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="editThemeIsActive"
                  checked={editThemeIsActive}
                  onChange={(e) => setEditThemeIsActive(e.target.checked)}
                  className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                />
                <label htmlFor="editThemeIsActive" className="text-zinc-300 font-medium cursor-pointer">
                  Aktifkan tema ini di kiosk publik
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingTheme(null)}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEditTheme}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold cursor-pointer hover:bg-amber-400"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE THEME CONFIRMATION MODAL */}
      {themeToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-rose-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" />
              Hapus Tema Frame Ini?
            </h3>
            <p className="text-zinc-300">
              Apakah Anda yakin ingin menghapus tema <strong>&quot;{themeToDelete.name}&quot;</strong> beserta seluruh varian layout yang terhubung?
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setThemeToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteTheme}
                disabled={isDeletingTheme}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold cursor-pointer"
              >
                {isDeletingTheme ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE COMBINATION CONFIRMATION MODAL */}
      {comboToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-rose-500/40 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" />
              Hapus Varian Layout Ini?
            </h3>
            <p className="text-zinc-300">
              Apakah Anda yakin ingin menghapus varian layout ini dari tema <strong>&quot;{selectedThemeForLayouts?.name}&quot;</strong>?
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setComboToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteCombination}
                disabled={isDeletingCombo}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold cursor-pointer"
              >
                {isDeletingCombo ? 'Menghapus...' : 'Ya, Hapus Varian'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
