import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Layers,
  RefreshCw,
  Image as ImageIcon,
  Camera,
  Palette,
  MessageSquare,
  Search,
  X,
  Tag,
} from 'lucide-react';
import { FrameTheme, FrameLayoutItem, PhotoboothLayout, LayoutSlot } from '../types';
import { getAdminWhatsapp } from '../services/adminContactService';
import { buildWhatsAppUrl } from '../utils/whatsappHelper';
import {
  fetchActiveFrames,
  getCachedFramesSync,
} from '../services/frameService';
import {
  getFrameCategoriesSync,
  fetchFrameCategoriesData,
} from '../services/frameCategoryService';

interface Step2ThemeSelectProps {
  eventId: string;
  selectedThemeId?: string;
  onSelectFrameAndLayout: (combination: FrameLayoutItem) => void;
  onBack: () => void;
  onOpenAdmin?: () => void;
}

export const Step2ThemeSelect: React.FC<Step2ThemeSelectProps> = ({
  eventId,
  selectedThemeId,
  onSelectFrameAndLayout,
  onBack,
  onOpenAdmin,
}) => {
  // Inisialisasi frames langsung dari cache sync jika tersedia (0ms render time)
  const initialCachedFrames = getCachedFramesSync(eventId) || [];
  const [frames, setFrames] = useState<FrameLayoutItem[]>(initialCachedFrames);
  const [isLoading, setIsLoading] = useState<boolean>(initialCachedFrames.length === 0);
  const [activeFrame, setActiveFrame] = useState<FrameLayoutItem | null>(() => {
    if (initialCachedFrames.length > 0) {
      return initialCachedFrames.find((it) => it.frame_id === selectedThemeId) || initialCachedFrames[0] || null;
    }
    return null;
  });
  const [failedThumbnails, setFailedThumbnails] = useState<Record<string, boolean>>({});

  // Filter Kategori & Search Bar
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleOpenWhatsAppCustomFrame = () => {
    const adminPhone = getAdminWhatsapp();
    const message = 'Halo admin, saya mau request custom frame, boleh dibantu?';
    const waUrl = buildWhatsAppUrl(adminPhone, message);
    window.open(waUrl, '_blank');
  };

  const loadFrames = async (force = false) => {
    // Jika belum ada frames sama sekali, tampilkan status loading
    if (frames.length === 0) {
      setIsLoading(true);
    }
    try {
      const items = await fetchActiveFrames(eventId, force);
      if (items && items.length > 0) {
        setFrames(items);
        setActiveFrame((prev) => {
          if (prev && items.some((it) => it.frame_id === prev.frame_id)) {
            return prev;
          }
          return items.find((it) => it.frame_id === selectedThemeId) || items[0] || null;
        });
      }
    } catch (err) {
      console.warn('Gagal memuat daftar frame:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const hasDummyOnly = frames.length === 1 && (frames[0].id === 'default-strip-3' || frames[0].frame_id === 'default-frame-1');
    loadFrames(hasDummyOnly);

    // Listener realtime jika admin memperbarui frame dari admin portal
    const handleFramesUpdated = () => {
      loadFrames(true);
    };

    window.addEventListener('photobooth_frames_invalidated', handleFramesUpdated);
    window.addEventListener('photobooth_frames_refreshed', handleFramesUpdated);
    window.addEventListener('photobooth_categories_updated', handleFramesUpdated);

    return () => {
      window.removeEventListener('photobooth_frames_invalidated', handleFramesUpdated);
      window.removeEventListener('photobooth_frames_refreshed', handleFramesUpdated);
      window.removeEventListener('photobooth_categories_updated', handleFramesUpdated);
    };
  }, [eventId, selectedThemeId]);

  // Daftar kategori yang tersedia berdasarkan frame aktif & master data
  const availableCategories = useMemo(() => {
    const catSet = new Set<string>();
    frames.forEach((f) => {
      const cat = f.category || f.frame?.category;
      if (cat && cat.trim()) {
        catSet.add(cat.trim());
      }
    });

    // Ambil juga dari master kategori yang tersimpan
    const masterCats = getFrameCategoriesSync().categories;
    masterCats.forEach((c) => {
      if (c.name && c.name.trim()) {
        catSet.add(c.name.trim());
      }
    });

    return Array.from(catSet);
  }, [frames]);

  // Hitung jumlah frame per kategori
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: frames.length };
    frames.forEach((f) => {
      const cat = f.category || f.frame?.category || 'Umum';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [frames]);

  // Hasil filter berdasarkan kategori dan kata kunci pencarian
  const filteredFrames = useMemo(() => {
    return frames.filter((item) => {
      const itemCat = item.category || item.frame?.category || 'Umum';
      // 1. Filter Kategori
      if (
        selectedCategory !== 'all' &&
        itemCat.toLowerCase() !== selectedCategory.toLowerCase()
      ) {
        return false;
      }
      // 2. Filter Search Bar (Nama frame atau Kategori)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (item.frame?.name || '').toLowerCase().includes(q);
        const catMatch = itemCat.toLowerCase().includes(q);
        if (!nameMatch && !catMatch) {
          return false;
        }
      }
      return true;
    });
  }, [frames, selectedCategory, searchQuery]);

  const handleSelect = (item: FrameLayoutItem) => {
    setActiveFrame(item);
  };

  const handleProceed = () => {
    if (activeFrame) {
      onSelectFrameAndLayout(activeFrame);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full max-w-xl mx-auto w-full relative overflow-hidden">
      {/* Scrollable Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4">
        {/* Header Bar */}
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Info Event</span>
            </button>

            <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
              Langkah 2: Pilih Frame
            </span>
          </div>

        {/* Title Header */}
        <div className="text-center pt-4 pb-3">
          <p className="text-[11px] font-mono tracking-widest text-amber-400 uppercase mb-1">
            PILIH FRAME PHOTOBOOTH
          </p>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Pilih Desain Frame Favorit Anda
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            Pilih bingkai foto yang diinginkan untuk langsung mulai sesi pemotretan
          </p>
        </div>

        {/* CTA Banner: Request Custom Frame ke Admin via WhatsApp */}
        <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-emerald-500/30 shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Palette className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-white leading-snug">
                  Mau atau punya referensi custom frame?
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                  Punya desain sendiri atau tema khusus? <span className="text-emerald-400 font-medium">Request ke admin via WhatsApp!</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenWhatsAppCustomFrame}
              className="w-full sm:w-auto shrink-0 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/25 cursor-pointer whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Request ke Admin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search Bar & Category Filter */}
        <div className="mb-4 space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari frame berdasarkan nama atau kategori..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5 rounded-full hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs (Scrollable) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none no-scrollbar">
            {/* Tab Semua */}
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md shadow-amber-500/20 font-bold'
                  : 'bg-zinc-900/80 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <span>Semua</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedCategory === 'all'
                    ? 'bg-zinc-950/25 text-zinc-950 font-bold'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {categoryCounts.all || 0}
              </span>
            </button>

            {/* Specific Categories */}
            {availableCategories.map((catName) => {
              const count = categoryCounts[catName] || 0;
              const isSelected = selectedCategory.toLowerCase() === catName.toLowerCase();

              return (
                <button
                  key={catName}
                  type="button"
                  onClick={() => setSelectedCategory(catName)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-md shadow-amber-500/20 font-bold'
                      : 'bg-zinc-900/80 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <Tag className={`w-3 h-3 ${isSelected ? 'text-zinc-950' : 'text-amber-400/80'}`} />
                  <span>{catName}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? 'bg-zinc-950/25 text-zinc-950 font-bold'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Frames Grid */}
        {isLoading ? (
          <div className="p-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span>Memuat pilihan frame...</span>
          </div>
        ) : frames.length === 0 ? (
          <div className="my-6 p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-1">
              <ImageIcon className="w-7 h-7 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-white">
              Belum Ada Frame
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
              Frame photobooth sedang disiapkan. Silakan klik muat ulang atau buka portal admin untuk mengunggah frame baru.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
              <button
                onClick={loadFrames}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang Frame</span>
              </button>
            </div>
          </div>
        ) : filteredFrames.length === 0 ? (
          <div className="my-6 p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 mb-1">
              <Search className="w-6 h-6 stroke-[1.5]" />
            </div>
            <h3 className="text-sm font-bold text-white">
              Frame Tidak Ditemukan
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm">
              Tidak ada frame yang cocok dengan kategori{' '}
              <span className="text-amber-400 font-semibold">"{selectedCategory === 'all' ? 'Semua' : selectedCategory}"</span>
              {searchQuery ? ` atau kata kunci "${searchQuery}"` : ''}.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="mt-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer transition-colors"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-3">
            {filteredFrames.map((item) => {
              const isSelected = activeFrame?.id === item.id;
              const slotsCount = item.layout?.photo_count || item.layout?.slots?.length || 3;
              const itemCat = item.category || item.frame?.category || 'Umum';

              return (
                <div
                  key={item.id}
                  id={`frame-card-${item.id}`}
                  onClick={() => handleSelect(item)}
                  className={`rounded-2xl p-4 transition-all cursor-pointer border flex flex-col justify-between relative overflow-hidden group ${
                    isSelected
                      ? 'bg-gradient-to-b from-amber-500/15 via-zinc-900 to-zinc-950 border-amber-500 ring-2 ring-amber-500/30 shadow-xl shadow-amber-500/10 scale-[1.02]'
                      : 'bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  {/* Selected Indicator & Slot Count Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg bg-zinc-800/90 text-amber-300 border border-zinc-700/60 font-semibold">
                        <Layers className="w-3 h-3 text-amber-400" />
                        {slotsCount} Slot Foto
                      </span>
                      {itemCat && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                          <Tag className="w-2.5 h-2.5" />
                          {itemCat}
                        </span>
                      )}
                    </div>

                    {isSelected ? (
                      <span className="w-6 h-6 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="w-6 h-6 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-600 group-hover:border-zinc-500" />
                    )}
                  </div>

                  {/* Frame Visual Preview (Pure Frame Image) */}
                  <div className="relative w-full aspect-[2/3] max-h-64 rounded-xl bg-zinc-950/90 border border-zinc-800/90 overflow-hidden flex items-center justify-center mb-3 p-2">
                    {/* Gambar Frame Overlay */}
                    {item.image_url && !failedThumbnails[item.id] ? (
                      <img
                        src={item.image_url}
                        alt={item.frame?.name || 'Frame'}
                        className="w-full h-full object-contain relative z-10 transition-transform duration-300 group-hover:scale-[1.02]"
                        onError={() => setFailedThumbnails((prev) => ({ ...prev, [item.id]: true }))}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-zinc-500 gap-1.5 p-3 text-center relative z-10">
                        <Layers className="w-8 h-8 text-amber-400/60 stroke-[1.5]" />
                        <span className="text-[11px] font-bold text-zinc-300">
                          {item.frame?.name || 'Frame Photobooth'}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {slotsCount} Slot Foto
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Frame Name & Category */}
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                      {item.frame?.name || 'Frame Photobooth'}
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Rasio {item.layout?.ratio || '2:3'} • {slotsCount} Jepretan Foto
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {/* Fixed Docked Bottom CTA Bar (SELALU DI ATAS TOMBOL NAVIGASI HP) */}
      <div className="shrink-0 z-30 w-full p-3 sm:p-4 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))] bg-[#0b0d13]/95 backdrop-blur-md border-t border-zinc-800/80 shadow-[0_-12px_32px_rgba(0,0,0,0.85)]">
        <button
          id="btn-confirm-frame"
          disabled={!activeFrame}
          onClick={handleProceed}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
        >
          <Camera className="w-4 h-4 stroke-[2.5]" />
          <span className="truncate">
            {activeFrame
              ? `Mulai Foto dengan Frame (${activeFrame.frame?.name || 'Pilihan'})`
              : 'Pilih Frame Terlebih Dahulu'}
          </span>
          <ArrowRight className="w-4 h-4 stroke-[2.5] shrink-0" />
        </button>
      </div>
    </div>
  );
};
