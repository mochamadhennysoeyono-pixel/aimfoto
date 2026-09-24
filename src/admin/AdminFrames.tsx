import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  Image as ImageIcon,
  Layers,
  Move,
  Maximize2,
  Eye,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Search,
  Copy,
  Info,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  Database,
  Power,
  Tag,
  FolderPlus,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { generateUuid } from '../utils/uuid';
import { PhotoboothLayout, LayoutSlot, FrameTheme } from '../types';
import { AdminEventItem } from './AdminEvents';
import { invalidateFrameCache } from '../services/frameService';
import {
  FrameCategory,
  DEFAULT_FRAME_CATEGORIES,
  getFrameCategoriesSync,
  fetchFrameCategoriesData,
  saveFrameCategoriesData,
  setFrameCategory,
  getFrameCategory,
} from '../services/frameCategoryService';

interface AdminFramesProps {
  initialSelectedEventId?: string | null;
}

export interface FrameSlotItem extends LayoutSlot {
  label: string;
}

// Memory Cache untuk navigasi tab instan 0ms
let cachedAdminFramesEvents: AdminEventItem[] = [];
let cachedAdminFramesMap = new Map<string, FrameTheme[]>();

export const AdminFrames: React.FC<AdminFramesProps> = ({ initialSelectedEventId }) => {
  const [events, setEvents] = useState<AdminEventItem[]>(cachedAdminFramesEvents);
  const [selectedEventId, setSelectedEventId] = useState<string>(initialSelectedEventId || 'all');
  const initialCachedFrames = cachedAdminFramesMap.get(initialSelectedEventId || 'all') || [];
  const [frames, setFrames] = useState<FrameTheme[]>(initialCachedFrames);
  const [isLoading, setIsLoading] = useState(initialCachedFrames.length === 0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State: Modal Upload & Editor Slot
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
  const [formEventId, setFormEventId] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formSortOrder, setFormSortOrder] = useState<string>('1');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formCategory, setFormCategory] = useState<string>('Korean Photostrip');
  const [isCustomCategoryInput, setIsCustomCategoryInput] = useState<boolean>(false);
  const [customCategoryName, setCustomCategoryName] = useState<string>('');

  // Master Data Kategori States
  const [categories, setCategories] = useState<FrameCategory[]>(getFrameCategoriesSync().categories);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState<string>('');
  const [isSavingCategory, setIsSavingCategory] = useState<boolean>(false);

  // Admin filter & search
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>('');
  const [adminFilterCategory, setAdminFilterCategory] = useState<string>('all');

  // Frame image file / preview
  const [frameImageFile, setFrameImageFile] = useState<File | null>(null);
  const [frameImageUrl, setFrameImageUrl] = useState<string>('');
  const [imgNaturalWidth, setImgNaturalWidth] = useState<number>(1200);
  const [imgNaturalHeight, setImgNaturalHeight] = useState<number>(1800);

  // Slot states (persentase 0 - 100%)
  const [slots, setSlots] = useState<FrameSlotItem[]>([
    { index: 0, label: 'Foto 1', x: 10, y: 8, width: 80, height: 26, borderRadius: 8 },
    { index: 1, label: 'Foto 2', x: 10, y: 37, width: 80, height: 26, borderRadius: 8 },
    { index: 2, label: 'Foto 3', x: 10, y: 66, width: 80, height: 26, borderRadius: 8 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete modal & RLS block states (in-app modal, avoids window.confirm iframe issues)
  const [frameToDelete, setFrameToDelete] = useState<FrameTheme | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [rlsBlockedFrame, setRlsBlockedFrame] = useState<FrameTheme | null>(null);
  const [hasCopiedSql, setHasCopiedSql] = useState<boolean>(false);
  const [isDeactivatingInstead, setIsDeactivatingInstead] = useState<boolean>(false);

  // Canvas interaction ref
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // 1. Fetch Events
  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
      if (!error && data) {
        cachedAdminFramesEvents = data;
        setEvents(data);
      }
    } catch (e) {
      console.warn('Gagal fetch events:', e);
    }
  };

  // 2. Fetch Frames beserta Layout & Slots yang terhubung secara PARALEL
  const fetchFrames = async () => {
    if (frames.length === 0) {
      setIsLoading(true);
    }
    setErrorMsg(null);
    try {
      let query = supabase.from('frames').select('*');
      if (selectedEventId && selectedEventId !== 'all') {
        query = query.eq('event_id', selectedEventId);
      }

      // Query frames, frame_layouts, dan categories berjalan sekaligus secara paralel
      const [framesRes, flRes, catData] = await Promise.all([
        query.order('sort_order', { ascending: true }),
        supabase.from('frame_layouts').select('*, layout:layouts(*)'),
        fetchFrameCategoriesData(),
      ]);

      if (catData && catData.categories) {
        setCategories(catData.categories);
      }

      const dbFrames = framesRes.data;
      const error = framesRes.error;
      const flData = flRes.data;
      const frameCategoryMap = catData?.frameCategoryMap || getFrameCategoriesSync().frameCategoryMap;

      if (error) {
        setErrorMsg(`Gagal memuat frames: ${error.message}`);
        setFrames([]);
      } else if (dbFrames) {
        const layoutMap = new Map<string, PhotoboothLayout>();
        const imageUrlMap = new Map<string, string>();

        if (flData) {
          flData.forEach((fl: any) => {
            if (fl.layout && !layoutMap.has(fl.frame_id)) {
              let parsedSlots: LayoutSlot[] = [];
              if (Array.isArray(fl.layout.slots)) {
                parsedSlots = fl.layout.slots;
              } else if (typeof fl.layout.slots === 'string') {
                try {
                  parsedSlots = JSON.parse(fl.layout.slots);
                } catch (e) {
                  parsedSlots = [];
                }
              }

              layoutMap.set(fl.frame_id, {
                id: fl.layout.id,
                name: fl.layout.name || 'Layout',
                ratio: fl.layout.ratio || '2:3',
                canvas_width: fl.layout.canvas_width || 1200,
                canvas_height: fl.layout.canvas_height || 1800,
                photo_count: fl.layout.photo_count || parsedSlots.length || 1,
                slots: parsedSlots,
              });
            }
            if (fl.image_url && !imageUrlMap.has(fl.frame_id)) {
              imageUrlMap.set(fl.frame_id, fl.image_url);
            }
          });
        }

        const mapped: FrameTheme[] = dbFrames.map((f: any) => {
          const matchedLayout = layoutMap.get(f.id);
          const finalImageUrl = imageUrlMap.get(f.id) || f.image_url || '';
          const frameCat = frameCategoryMap[f.id] || 'Umum';
          return {
            id: f.id,
            name: f.name || 'Frame Photobooth',
            event_id: f.event_id,
            sort_order: f.sort_order ?? 1,
            is_active: f.is_active ?? true,
            category: frameCat,
            created_at: f.created_at,
            image_url: finalImageUrl,
            slots_count: matchedLayout ? matchedLayout.photo_count || matchedLayout.slots?.length : 3,
            layout: matchedLayout,
          };
        });

        cachedAdminFramesMap.set(selectedEventId || 'all', mapped);
        setFrames(mapped);
      }
    } catch (e: any) {
      setErrorMsg(`Error memuat frame: ${e?.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    fetchFrames();
  }, [selectedEventId]);

  // Load natural dimensions when image changes
  useEffect(() => {
    if (frameImageUrl) {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setImgNaturalWidth(img.naturalWidth);
          setImgNaturalHeight(img.naturalHeight);
        }
      };
      img.src = frameImageUrl;
    }
  }, [frameImageUrl]);

  // Buka modal untuk Buat Frame Baru
  const handleOpenCreateModal = () => {
    setEditingFrameId(null);
    setFormName('');
    setFormEventId(
      selectedEventId && selectedEventId !== 'all'
        ? selectedEventId
        : events[0]?.id || ''
    );
    setFormSortOrder(String(frames.length + 1));
    setFormIsActive(true);
    setFormCategory(categories[0]?.name || 'Korean Photostrip');
    setIsCustomCategoryInput(false);
    setCustomCategoryName('');
    setFrameImageFile(null);
    setFrameImageUrl('');
    setImgNaturalWidth(1200);
    setImgNaturalHeight(1800);
    // Default 3 slot proporsional
    setSlots([
      { index: 0, label: 'Foto 1', x: 10, y: 7, width: 80, height: 26, borderRadius: 8 },
      { index: 1, label: 'Foto 2', x: 10, y: 37, width: 80, height: 26, borderRadius: 8 },
      { index: 2, label: 'Foto 3', x: 10, y: 67, width: 80, height: 26, borderRadius: 8 },
    ]);
    setErrorMsg(null);
    setIsEditorOpen(true);
  };

  // Buka modal untuk Edit Frame & Slot yang sudah ada
  const handleOpenEditModal = (frame: FrameTheme) => {
    setEditingFrameId(frame.id);
    setFormName(frame.name);
    setFormEventId(frame.event_id || events[0]?.id || '');
    setFormSortOrder(String(frame.sort_order ?? 1));
    setFormIsActive(frame.is_active ?? true);
    const existingCat = frame.category || getFrameCategory(frame.id) || 'Umum';
    setFormCategory(existingCat);
    setIsCustomCategoryInput(false);
    setCustomCategoryName('');
    setFrameImageFile(null);
    setFrameImageUrl(frame.image_url || '');

    if (frame.layout && frame.layout.slots && frame.layout.slots.length > 0) {
      setImgNaturalWidth(frame.layout.canvas_width || 1200);
      setImgNaturalHeight(frame.layout.canvas_height || 1800);
      setSlots(
        frame.layout.slots.map((s, idx) => ({
          index: s.index ?? idx,
          label: s.label || `Foto ${idx + 1}`,
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
          borderRadius: s.borderRadius ?? 8,
        }))
      );
    } else {
      setSlots([
        { index: 0, label: 'Foto 1', x: 10, y: 7, width: 80, height: 26, borderRadius: 8 },
        { index: 1, label: 'Foto 2', x: 10, y: 37, width: 80, height: 26, borderRadius: 8 },
        { index: 2, label: 'Foto 3', x: 10, y: 67, width: 80, height: 26, borderRadius: 8 },
      ]);
    }
    setErrorMsg(null);
    setIsEditorOpen(true);
  };

  // Handle pilih file PNG frame
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFrameImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setFrameImageUrl(dataUrl);
      if (!formName) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setFormName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    };
    reader.readAsDataURL(file);
  };

  // Update jumlah slot secara dinamis berdasarkan input angka
  const handleSlotCountChange = (count: number) => {
    const validCount = Math.max(1, Math.min(20, count || 1));
    const isLandscape = imgNaturalWidth >= imgNaturalHeight && imgNaturalWidth > 0;

    setSlots((prev) => {
      const newSlots: FrameSlotItem[] = [];
      for (let i = 0; i < validCount; i++) {
        if (prev[i]) {
          newSlots.push({ ...prev[i], index: i, label: `Foto ${i + 1}` });
        } else {
          // Generate slot default yang tersebar rapi
          if (isLandscape) {
            const width = Math.max(15, Math.floor(84 / validCount));
            const x = Math.min(85, 6 + i * (width + 2));
            newSlots.push({
              index: i,
              label: `Foto ${i + 1}`,
              x,
              y: 8,
              width,
              height: 84,
              borderRadius: 8,
            });
          } else {
            const height = Math.max(12, Math.floor(84 / validCount));
            const y = Math.min(85, 6 + i * (height + 2));
            newSlots.push({
              index: i,
              label: `Foto ${i + 1}`,
              x: 10,
              y,
              width: 80,
              height,
              borderRadius: 8,
            });
          }
        }
      }
      return newSlots;
    });
  };

  // SIMPAN FRAME & SLOT KE DATABASE
  const handleSaveFrameAndSlots = async () => {
    if (!formName.trim()) {
      alert('Harap isi nama frame.');
      return;
    }
    if (!formEventId) {
      alert('Harap pilih event untuk frame ini.');
      return;
    }
    if (!frameImageUrl) {
      alert('Harap unggah gambar frame (PNG).');
      return;
    }
    if (slots.length === 0) {
      alert('Frame minimal harus memiliki minimal 1 slot foto.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let finalImageUrl = frameImageUrl;

      // 1. Jika ada file upload baru, upload ke Supabase Storage
      if (frameImageFile) {
        const fileExt = frameImageFile.name.split('.').pop() || 'png';
        const fileName = `frames/${Date.now()}_${generateUuid().substring(0, 8)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('photobooth-frames')
          .upload(fileName, frameImageFile, { upsert: true });

        if (uploadError) {
          console.warn('Gagal upload ke storage bucket photobooth-frames, gunakan DataURL sebagai fallback:', uploadError.message);
        } else if (uploadData) {
          const { data: pubUrlData } = supabase.storage
            .from('photobooth-frames')
            .getPublicUrl(fileName);
          if (pubUrlData?.publicUrl) {
            finalImageUrl = pubUrlData.publicUrl;
          }
        }
      }

      // Hitung ratio canvas
      const width = imgNaturalWidth || 1200;
      const height = imgNaturalHeight || 1800;
      let ratio = '2:3';
      const calculatedRatio = width / height;
      if (Math.abs(calculatedRatio - 0.33) < 0.08) ratio = '1:3';
      else if (Math.abs(calculatedRatio - 0.5) < 0.08) ratio = '1:2';
      else if (Math.abs(calculatedRatio - 0.67) < 0.08) ratio = '2:3';
      else if (Math.abs(calculatedRatio - 0.75) < 0.08) ratio = '3:4';
      else if (Math.abs(calculatedRatio - 1.0) < 0.08) ratio = '1:1';
      else ratio = `${Math.round(calculatedRatio * 10)}:10`;

      // 2. Simpan atau Update Layout Struktur ke tabel `layouts`
      const layoutDataToSave = {
        name: `${formName.trim()} Layout`,
        ratio,
        canvas_width: width,
        canvas_height: height,
        photo_count: slots.length,
        slots: slots.map((s, idx) => ({
          index: idx,
          label: s.label || `Foto ${idx + 1}`,
          x: s.x,
          y: s.y,
          width: s.width,
          height: s.height,
          borderRadius: s.borderRadius ?? 8,
        })),
      };

      let savedLayoutId: string = editingFrameId ? '' : generateUuid();
      let savedFrameId: string = editingFrameId || '';

      if (editingFrameId) {
        // Cek apakah sudah ada layout terhubung via frame_layouts
        const { data: existingFl } = await supabase
          .from('frame_layouts')
          .select('layout_id')
          .eq('frame_id', editingFrameId)
          .limit(1);

        if (existingFl && existingFl.length > 0 && existingFl[0].layout_id) {
          savedLayoutId = existingFl[0].layout_id;
          await supabase.from('layouts').update(layoutDataToSave).eq('id', savedLayoutId);
        } else {
          const newGeneratedLayoutId = generateUuid();
          savedLayoutId = newGeneratedLayoutId;
          const { data: newL, error: newLErr } = await supabase
            .from('layouts')
            .insert([{ id: newGeneratedLayoutId, ...layoutDataToSave }])
            .select();
          if (newLErr || !newL || newL.length === 0) {
            throw new Error(`Gagal menyimpan konfigurasi slot: ${newLErr?.message}`);
          }
          if (newL[0].id) savedLayoutId = newL[0].id;
        }

        // Update row tabel `frames`
        const { error: updateFrameErr } = await supabase
          .from('frames')
          .update({
            name: formName.trim(),
            event_id: formEventId,
            sort_order: parseInt(formSortOrder) || 1,
            is_active: formIsActive,
            image_url: finalImageUrl,
          })
          .eq('id', editingFrameId);

        if (updateFrameErr) throw new Error(updateFrameErr.message);

        // Update or insert tabel `frame_layouts`
        const { data: checkFl } = await supabase
          .from('frame_layouts')
          .select('id')
          .eq('frame_id', editingFrameId);

        if (checkFl && checkFl.length > 0) {
          await supabase
            .from('frame_layouts')
            .update({
              layout_id: savedLayoutId,
              image_url: finalImageUrl,
            })
            .eq('id', checkFl[0].id);
        } else {
          await supabase.from('frame_layouts').insert([
            {
              id: generateUuid(),
              frame_id: editingFrameId,
              layout_id: savedLayoutId,
              image_url: finalImageUrl,
            },
          ]);
        }
      } else {
        // Buat Frame Baru
        // 1. Insert layout
        const newGeneratedLayoutId = savedLayoutId || generateUuid();
        savedLayoutId = newGeneratedLayoutId;
        const { data: newLayoutRows, error: layoutErr } = await supabase
          .from('layouts')
          .insert([{ id: newGeneratedLayoutId, ...layoutDataToSave }])
          .select();

        if (layoutErr || !newLayoutRows || newLayoutRows.length === 0) {
          throw new Error(`Gagal menyimpan layout slot: ${layoutErr?.message}`);
        }
        if (newLayoutRows[0].id) savedLayoutId = newLayoutRows[0].id;

        // 2. Insert frame ke tabel `frames`
        const newFrameId = generateUuid();
        savedFrameId = newFrameId;
        const { error: insertFrameErr } = await supabase.from('frames').insert([
          {
            id: newFrameId,
            name: formName.trim(),
            event_id: formEventId,
            sort_order: parseInt(formSortOrder) || 1,
            is_active: formIsActive,
            image_url: finalImageUrl,
          },
        ]);

        if (insertFrameErr) throw new Error(`Gagal menyimpan frame: ${insertFrameErr.message}`);

        // 3. Hubungkan ke tabel `frame_layouts`
        const { error: flInsertErr } = await supabase.from('frame_layouts').insert([
          {
            id: generateUuid(),
            frame_id: newFrameId,
            layout_id: savedLayoutId,
            image_url: finalImageUrl,
          },
        ]);

        if (flInsertErr) {
          console.warn('Notice saat menghubungkan frame_layouts:', flInsertErr.message);
        }
      }

      // Simpan asosiasi kategori frame ke master data
      const chosenCat = (isCustomCategoryInput ? customCategoryName : formCategory).trim() || 'Umum';
      if (savedFrameId) {
        await setFrameCategory(savedFrameId, chosenCat);
      }

      setSuccessMsg(`Sukses! Frame "${formName}" dengan ${slots.length} slot foto berhasil disimpan.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setIsEditorOpen(false);
      invalidateFrameCache();
      fetchFrames();
      setCategories(getFrameCategoriesSync().categories);
    } catch (err: any) {
      setErrorMsg(`Gagal menyimpan: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Master Data Kategori Handlers
  const handleAddMasterCategory = async () => {
    if (!newCatName.trim()) return;
    setIsSavingCategory(true);
    try {
      const trimmed = newCatName.trim();
      const current = getFrameCategoriesSync();
      if (!current.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
        const updated = [...current.categories, { id: `cat-${Date.now()}`, name: trimmed }];
        await saveFrameCategoriesData(updated, current.frameCategoryMap);
        setCategories(updated);
        setNewCatName('');
        setSuccessMsg(`Kategori "${trimmed}" berhasil ditambahkan ke master data.`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleUpdateMasterCategory = async (catId: string) => {
    if (!editingCatName.trim()) return;
    setIsSavingCategory(true);
    try {
      const trimmed = editingCatName.trim();
      const current = getFrameCategoriesSync();
      const oldCat = current.categories.find((c) => c.id === catId);
      const updatedCategories = current.categories.map((c) =>
        c.id === catId ? { ...c, name: trimmed } : c
      );
      const updatedMap = { ...current.frameCategoryMap };
      if (oldCat) {
        Object.keys(updatedMap).forEach((fId) => {
          if (updatedMap[fId] === oldCat.name) {
            updatedMap[fId] = trimmed;
          }
        });
      }
      await saveFrameCategoriesData(updatedCategories, updatedMap);
      setCategories(updatedCategories);
      setEditingCatId(null);
      setEditingCatName('');
      invalidateFrameCache();
      fetchFrames();
      setSuccessMsg(`Kategori berhasil diperbarui menjadi "${trimmed}".`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteMasterCategory = async (catId: string) => {
    setIsSavingCategory(true);
    try {
      const current = getFrameCategoriesSync();
      const catToDelete = current.categories.find((c) => c.id === catId);
      const updatedCategories = current.categories.filter((c) => c.id !== catId);
      const updatedMap = { ...current.frameCategoryMap };
      if (catToDelete) {
        Object.keys(updatedMap).forEach((fId) => {
          if (updatedMap[fId] === catToDelete.name) {
            updatedMap[fId] = 'Umum';
          }
        });
      }
      await saveFrameCategoriesData(updatedCategories, updatedMap);
      setCategories(updatedCategories);
      invalidateFrameCache();
      fetchFrames();
      setSuccessMsg('Kategori berhasil dihapus dari master data.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Konfirmasi Hapus Frame dari Modal In-App
  const handleConfirmDelete = async () => {
    if (!frameToDelete) return;

    setIsDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Ambil relasi layout_id di frame_layouts untuk dibersihkan
      const { data: flRows } = await supabase
        .from('frame_layouts')
        .select('layout_id')
        .eq('frame_id', frameToDelete.id);

      // 2. Hapus relasi di frame_layouts terlebih dahulu
      const { error: flError } = await supabase
        .from('frame_layouts')
        .delete()
        .eq('frame_id', frameToDelete.id);

      if (flError) {
        console.warn('Notice saat menghapus frame_layouts:', flError.message);
      }

      // 3. Hapus frame dari tabel frames
      const { data, error } = await supabase
        .from('frames')
        .delete()
        .eq('id', frameToDelete.id)
        .select();

      if (error) {
        console.warn('Error saat menghapus frame dari Supabase:', error);
        if (error.code === '42501') {
          // Row Level Security (RLS) membatasi akses DELETE
          setRlsBlockedFrame(frameToDelete);
          setFrameToDelete(null);
          return;
        } else if (error.code === '23503') {
          // Terikat foreign key riwayat sesi/order foto
          setErrorMsg(
            `Frame "${frameToDelete.name}" tidak dapat dihapus permanen karena terikat dengan riwayat sesi/order foto yang tersimpan di database. Silakan nonaktifkan frame ini (ikon centang) agar tidak muncul di photobooth.`
          );
          setFrameToDelete(null);
          return;
        } else {
          throw error;
        }
      } else if (!data || data.length === 0) {
        // PostgREST RLS memblokir DELETE tanpa melempar error (0 baris terhapus)
        console.warn('Supabase RLS memblokir operasi DELETE (0 baris terhapus):', frameToDelete.name);
        setRlsBlockedFrame(frameToDelete);
        setFrameToDelete(null);
        return;
      }

      // 4. Bersihkan layout slot di tabel layouts jika ada
      if (flRows && flRows.length > 0) {
        for (const fl of flRows) {
          if (fl.layout_id) {
            await supabase.from('layouts').delete().eq('id', fl.layout_id);
          }
        }
      }

      // 5. Berhasil dihapus dari database
      const deletedName = frameToDelete.name;
      setFrames((prev) => prev.filter((f) => f.id !== frameToDelete.id));
      setSuccessMsg(`Frame "${deletedName}" berhasil dihapus permanen dari database.`);
      setFrameToDelete(null);
      setTimeout(() => setSuccessMsg(null), 4000);
      invalidateFrameCache();
      fetchFrames();
    } catch (e: any) {
      console.error('Error deleting frame:', e);
      setErrorMsg(`Gagal menghapus frame: ${e?.message || 'Terjadi kesalahan pada database Supabase'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Alternatif: Nonaktifkan frame jika RLS Supabase memblokir operasi DELETE
  const handleDeactivateInstead = async (frame: FrameTheme) => {
    setIsDeactivatingInstead(true);
    try {
      const { error } = await supabase
        .from('frames')
        .update({ is_active: false })
        .eq('id', frame.id);

      if (error) throw error;

      setFrames((prev) =>
        prev.map((f) => (f.id === frame.id ? { ...f, is_active: false } : f))
      );
      setSuccessMsg(
        `Frame "${frame.name}" berhasil dinonaktifkan. Pengunjung photobooth tidak akan dapat memilih frame ini lagi.`
      );
      setRlsBlockedFrame(null);
      setTimeout(() => setSuccessMsg(null), 4000);
      invalidateFrameCache();
    } catch (err: any) {
      setErrorMsg(`Gagal menonaktifkan frame: ${err?.message || 'Terjadi kesalahan'}`);
    } finally {
      setIsDeactivatingInstead(false);
    }
  };

  // Toggle Aktif/Nonaktif
  const handleToggleActive = async (frame: FrameTheme) => {
    try {
      const nextStatus = !frame.is_active;
      const { error } = await supabase
        .from('frames')
        .update({ is_active: nextStatus })
        .eq('id', frame.id);
      if (error) throw error;
      setFrames((prev) =>
        prev.map((f) => (f.id === frame.id ? { ...f, is_active: nextStatus } : f))
      );
      invalidateFrameCache();
    } catch (e: any) {
      setErrorMsg(`Gagal mengubah status frame: ${e?.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-amber-400" />
              <span>Kelola Frame Photobooth</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {frames.length} Frame
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Cukup upload gambar frame (PNG) dan tentukan jumlah slot foto.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Master Kategori Button */}
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span>Master Kategori ({categories.length})</span>
          </button>

          {/* Filter Event */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-zinc-500 text-[11px]">Event:</span>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-transparent text-zinc-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-zinc-900 text-white">Semua Event</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id} className="bg-zinc-900 text-white">
                  {ev.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Upload Frame Baru</span>
          </button>
        </div>
      </div>

      {/* Admin Search & Category Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={adminSearchQuery}
            onChange={(e) => setAdminSearchQuery(e.target.value)}
            placeholder="Cari frame atau kategori..."
            className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
          {adminSearchQuery && (
            <button
              onClick={() => setAdminSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setAdminFilterCategory('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
              adminFilterCategory === 'all'
                ? 'bg-amber-500 text-zinc-950 font-bold'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            Semua Kategori
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setAdminFilterCategory(c.name)}
              className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                adminFilterCategory.toLowerCase() === c.name.toLowerCase()
                  ? 'bg-amber-500 text-zinc-950 font-bold'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Messages */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Frame List Cards */}
      {isLoading ? (
        <div className="p-16 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
          <span>Memuat frame photobooth...</span>
        </div>
      ) : frames.length === 0 ? (
        <div className="p-12 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ImageIcon className="w-7 h-7 stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-bold text-white">Belum Ada Frame</h3>
          <p className="text-xs text-zinc-400 max-w-sm">
            Klik tombol di bawah untuk mengunggah gambar frame PNG dan menentukan letak slot fotonya.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-2 px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Frame Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {frames
            .filter((frame) => {
              const frameCat = frame.category || getFrameCategory(frame.id) || 'Umum';
              if (
                adminFilterCategory !== 'all' &&
                frameCat.toLowerCase() !== adminFilterCategory.toLowerCase()
              ) {
                return false;
              }
              if (adminSearchQuery.trim()) {
                const q = adminSearchQuery.toLowerCase().trim();
                const nameMatch = (frame.name || '').toLowerCase().includes(q);
                const catMatch = frameCat.toLowerCase().includes(q);
                if (!nameMatch && !catMatch) return false;
              }
              return true;
            })
            .map((frame) => {
            const ev = events.find((e) => e.id === frame.event_id);
            const slotCount = frame.slots_count || frame.layout?.slots?.length || 3;
            const frameCat = frame.category || getFrameCategory(frame.id) || 'Umum';

            return (
              <div
                key={frame.id}
                className={`rounded-2xl border bg-zinc-900/70 p-3.5 flex flex-col justify-between transition-all group hover:border-zinc-700 hover:bg-zinc-900 ${
                  frame.is_active ? 'border-zinc-800' : 'border-zinc-800/40 opacity-60'
                }`}
              >
                <div>
                  {/* Thumbnail Frame */}
                  <div className="relative w-full aspect-[2/3] max-h-72 rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden flex items-center justify-center p-2 mb-3">
                    {/* Gambar Frame */}
                    {frame.image_url ? (
                      <img
                        src={frame.image_url}
                        alt={frame.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-zinc-600 text-xs flex flex-col items-center gap-1">
                        <ImageIcon className="w-8 h-8" />
                        <span>Tidak ada gambar</span>
                      </div>
                    )}

                    {/* Badge Jumlah Slot */}
                    <div className="absolute top-2 left-2 z-20">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-950/80 backdrop-blur-md border border-amber-500/30 text-amber-300">
                        <Layers className="w-2.5 h-2.5" />
                        {slotCount} Slot Foto
                      </span>
                    </div>

                    {/* Badge Status */}
                    <div className="absolute top-2 right-2 z-20">
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          frame.is_active
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {frame.is_active ? 'AKTIF' : 'NONAKTIF'}
                      </span>
                    </div>
                  </div>

                  {/* Info Frame & Kategori */}
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                      {frame.name}
                    </h3>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-zinc-400">
                      <span className="truncate">Event: <span className="text-zinc-300">{ev?.name || 'Semua Event'}</span></span>
                      <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-medium flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5" />
                        <span>{frameCat}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-3 mt-3 border-t border-zinc-800/80">
                  <button
                    onClick={() => handleOpenEditModal(frame)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3 text-amber-400" />
                    <span>Edit Slot</span>
                  </button>

                  <button
                    onClick={() => handleToggleActive(frame)}
                    className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                      frame.is_active
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                    }`}
                    title={frame.is_active ? 'Nonaktifkan Frame' : 'Aktifkan Frame'}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setFrameToDelete(frame)}
                    className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
                    title="Hapus Frame"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: UPLOAD FRAME & VISUAL SLOT EDITOR */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-[#0e1017] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-[#0a0c13]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-bold text-white">
                    {editingFrameId ? 'Edit Frame' : 'Upload Frame'}
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Pratinjau gambar dan informasi frame photobooth
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Split 2 Columns (Canvas Preview vs Controls) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto">
              {/* Kolom Kiri: Visual Canvas Preview (7 Kolom) */}
              <div className="lg:col-span-7 p-4 bg-zinc-950/60 border-b lg:border-b-0 lg:border-r border-zinc-800 flex flex-col items-center justify-center select-none">
                <div className="w-full flex items-center justify-between mb-2 text-xs">
                  <span className="text-zinc-400 font-medium flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pratinjau Frame ({slots.length} Foto):</span>
                  </span>
                  <span className="text-[11px] font-mono text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                    {imgNaturalWidth} × {imgNaturalHeight} px ({imgNaturalWidth >= imgNaturalHeight ? 'Landscape' : 'Portrait'})
                  </span>
                </div>

                {/* Canvas Frame Container dengan Rasio Dinamis Otomatis */}
                <div
                  className="relative w-full max-w-sm max-h-[520px] rounded-xl bg-zinc-900 border-2 border-zinc-800 overflow-hidden flex items-center justify-center shadow-inner group transition-all"
                  style={{
                    aspectRatio: `${imgNaturalWidth || 1200} / ${imgNaturalHeight || 1800}`,
                  }}
                >
                  <div
                    ref={canvasContainerRef}
                    className="relative w-full h-full overflow-hidden flex items-center justify-center"
                  >
                    {/* Transparent PNG Overlay Frame */}
                    {frameImageUrl ? (
                      <img
                        src={frameImageUrl}
                        alt="Frame Preview"
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 p-6 text-center bg-zinc-900/80">
                        <Upload className="w-10 h-10 text-amber-400 mb-2 stroke-[1.5]" />
                        <p className="text-xs text-zinc-300 font-semibold">
                          Belum ada gambar frame
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Silakan unggah gambar PNG pada panel kanan
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Kolom Kanan: Detail Frame & Presisi Slot (5 Kolom) */}
              <div className="lg:col-span-5 p-5 space-y-4 overflow-y-auto max-h-[75vh]">
                {/* 1. Upload Gambar Frame */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>1. Gambar Frame (PNG Transparan)</span>
                  </label>
                  <label className="border-2 border-dashed border-zinc-700 hover:border-amber-500/60 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors bg-zinc-900/60">
                    <input
                      type="file"
                      accept="image/png,image/webp"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Upload className="w-5 h-5 text-zinc-400 mb-1" />
                    <span className="text-xs font-semibold text-zinc-300">
                      {frameImageFile ? frameImageFile.name : 'Pilih file gambar frame'}
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">
                      Rekomendasi file PNG transparan (Rasio 2:3 atau 1:3)
                    </span>
                  </label>
                </div>

                {/* 2. Informasi Frame */}
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <label className="text-xs font-bold text-zinc-200">
                    2. Informasi Frame & Event
                  </label>
                  <div>
                    <span className="text-[11px] text-zinc-400">Nama Frame:</span>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Contoh: Autumn Classic Strip"
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Kategori Frame */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-zinc-400">Kategori Frame:</span>
                      <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        <span>Kelola Master Kategori</span>
                      </button>
                    </div>
                    <select
                      value={isCustomCategoryInput ? '__custom__' : formCategory}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomCategoryInput(true);
                          setCustomCategoryName('');
                        } else {
                          setIsCustomCategoryInput(false);
                          setFormCategory(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                      <option value="__custom__">+ Tulis Kategori Baru...</option>
                    </select>

                    {isCustomCategoryInput && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={customCategoryName}
                          onChange={(e) => {
                            setCustomCategoryName(e.target.value);
                            setFormCategory(e.target.value);
                          }}
                          placeholder="Ketik nama kategori baru..."
                          className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-amber-500/60 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                          autoFocus
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-[11px] text-zinc-400">Pilih Event:</span>
                      <select
                        value={formEventId}
                        onChange={(e) => setFormEventId(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[11px] text-zinc-400">Urutan Tampil:</span>
                      <input
                        type="number"
                        value={formSortOrder}
                        onChange={(e) => setFormSortOrder(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Pengaturan Jumlah Foto */}
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>3. Jumlah Slot Foto</span>
                    </label>
                    <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                      {slots.length} Foto
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3">
                    <div>
                      <label className="block text-xs text-zinc-300 font-medium mb-1.5">
                        Masukkan jumlah foto untuk frame ini:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={slots.length}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) {
                              handleSlotCountChange(val);
                            }
                          }}
                          className="w-28 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-sm font-bold text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-center"
                          placeholder="Contoh: 3"
                        />
                        <span className="text-xs text-zinc-400">foto / slot</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      Cukup upload gambar frame dan input jumlah slot foto. Pengunjung di Step 5 dapat menggeser posisi foto secara bebas (free space) dan mengatur transparansi bingkai gambar agar pas dengan lubang.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer CTA */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-800 bg-[#0a0c13]">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveFrameAndSlots}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan Frame...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>Simpan Frame</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS FRAME (IN-APP MODAL, TIDAK TERBLOKIR IFRAME) */}
      {frameToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Hapus Frame Photobooth?</h3>
                <p className="text-xs text-zinc-400">
                  Frame <strong className="text-white font-semibold">"{frameToDelete.name}"</strong> beserta konfigurasi posisi slot fotonya akan dihapus permanen.
                </p>
              </div>
            </div>

            {frameToDelete.image_url && (
              <div className="w-full h-32 rounded-xl bg-zinc-950 border border-zinc-800 p-2 flex items-center justify-center overflow-hidden">
                <img
                  src={frameToDelete.image_url}
                  alt={frameToDelete.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/80">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setFrameToDelete(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Frame</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PANDUAN RLS DATABASE SUPABASE KETIKA DELETE DIBLOKIR */}
      {rlsBlockedFrame && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="w-full max-w-lg bg-zinc-900 border border-amber-500/40 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 p-4 sm:p-5 shrink-0 bg-zinc-900">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Penghapusan Tertahan oleh Database Supabase
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Row Level Security (RLS) pada tabel <code className="text-amber-300 font-mono">frames</code> membatasi izin DELETE
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRlsBlockedFrame(null)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Isi Info & Penjelasan */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs text-zinc-300">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                <p className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Target Frame: <span className="text-white font-bold">{rlsBlockedFrame.name}</span>
                </p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Tabel <code className="text-zinc-200 font-mono">frames</code> atau <code className="text-zinc-200 font-mono">frame_layouts</code> di Supabase Anda saat ini mengaktifkan RLS dan belum memiliki hak izin operasi <code className="text-amber-400 font-mono">DELETE</code> untuk public/anon. Oleh sebab itu, Supabase menolak query hapus dan saat halaman dimuat ulang, data tersebut ditarik kembali dari server.
                </p>
              </div>

              {/* Kotak SQL Query untuk Dijalankan di Supabase */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                    Solusi Permanen (Jalankan 1x di Supabase SQL Editor):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const sql = `ALTER TABLE frames DISABLE ROW LEVEL SECURITY;\nALTER TABLE frame_layouts DISABLE ROW LEVEL SECURITY;`;
                      navigator.clipboard.writeText(sql);
                      setHasCopiedSql(true);
                      setTimeout(() => setHasCopiedSql(false), 2500);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {hasCopiedSql ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Script Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Salin Query SQL</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-200 overflow-x-auto select-all leading-relaxed">
{`-- Salin dan jalankan di menu SQL Editor di Supabase:
ALTER TABLE frames DISABLE ROW LEVEL SECURITY;
ALTER TABLE frame_layouts DISABLE ROW LEVEL SECURITY;`}
                </pre>

                <ol className="text-[11px] text-zinc-400 list-decimal list-inside space-y-0.5 pt-1">
                  <li>Buka dashboard Supabase project Anda</li>
                  <li>Pilih menu <strong>SQL Editor</strong> di sidebar kiri</li>
                  <li>Tempelkan (Paste) 2 baris perintah di atas lalu klik tombol <strong>Run</strong></li>
                  <li>Setelah itu, semua frame dapat langsung dihapus permanen</li>
                </ol>
              </div>
            </div>

            {/* Tindakan Alternatif Instan */}
            <div className="p-4 sm:p-5 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 bg-zinc-900">
              <button
                type="button"
                disabled={isDeactivatingInstead}
                onClick={() => handleDeactivateInstead(rlsBlockedFrame)}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Status frame akan diubah ke nonaktif sehingga tidak muncul lagi di photobooth pengunjung"
              >
                {isDeactivatingInstead ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Power className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Nonaktifkan Saja Frame Ini (Solusi Cepat)</span>
              </button>

              <button
                type="button"
                onClick={() => setRlsBlockedFrame(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Master Data Kategori Frame */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Tag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Master Data Kategori Frame</h3>
                  <p className="text-[11px] text-zinc-400">Kelola daftar pilihan kategori frame</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Modal */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {/* Tambah Kategori Baru */}
              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                <label className="text-[11px] font-semibold text-zinc-300 block">
                  Tambah Kategori Baru
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMasterCategory();
                      }
                    }}
                    placeholder="Contoh: Graduation, Vintage..."
                    className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    disabled={!newCatName.trim() || isSavingCategory}
                    onClick={handleAddMasterCategory}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs flex items-center gap-1 cursor-pointer shrink-0 transition-colors shadow-md shadow-amber-500/20"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Tambah</span>
                  </button>
                </div>
              </div>

              {/* Daftar Kategori */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Daftar Kategori ({categories.length})
                  </label>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {categories.map((cat) => {
                    const countFrames = frames.filter(
                      (f) =>
                        (f.category || getFrameCategory(f.id)).toLowerCase() ===
                        cat.name.toLowerCase()
                    ).length;
                    const isEditing = editingCatId === cat.id;

                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 transition-colors gap-2"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editingCatName}
                              onChange={(e) => setEditingCatName(e.target.value)}
                              className="flex-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-amber-500 text-xs text-white focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateMasterCategory(cat.id)}
                              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                              title="Simpan"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCatId(null);
                                setEditingCatName('');
                              }}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 cursor-pointer"
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 min-w-0">
                              <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="text-xs font-semibold text-white truncate">
                                {cat.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 shrink-0">
                                {countFrames} frame
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCatId(cat.id);
                                  setEditingCatName(cat.name);
                                }}
                                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 cursor-pointer transition-colors"
                                title="Ubah Nama"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={categories.length <= 1}
                                onClick={() => handleDeleteMasterCategory(cat.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 disabled:opacity-30 cursor-pointer transition-colors"
                                title="Hapus Kategori"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-3.5 sm:p-4 border-t border-zinc-800 bg-zinc-900 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
