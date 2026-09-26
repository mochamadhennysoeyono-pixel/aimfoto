import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Step1EventInfo } from './components/Step1EventInfo';
import { Step2ThemeSelect } from './components/Step2ThemeSelect';
import { Step4Camera } from './components/Step4Camera';
import { Step5Filters } from './components/Step5Filters';
import { Step6Slotting } from './components/Step6Slotting';
import { Step7Overlay } from './components/Step7Overlay';
import { Step8PreviewLocked } from './components/Step8PreviewLocked';
import { Step9Checkout } from './components/Step9Checkout';
import { Step10FinalSuccess } from './components/Step10FinalSuccess';
import { LegalInfoModal, LegalTab } from './components/LegalInfoModal';
import { AdminPortal } from './admin/AdminPortal';
import {
  StepKey,
  PhotoboothSession,
  PhotoboothOrder,
  EventConfig,
  FrameTheme,
  FrameLayoutItem,
  PhotoboothLayout,
  CustomDecorationItem,
  SlotAdjustmentsMap,
} from './types';
import { FILTER_PRESETS } from './data/filters';
import { DEFAULT_LAYOUTS, normalizeLayout } from './data/defaultLayouts';
import { generateUuid } from './utils/uuid';
import { supabase, HARDCODED_EVENT_ID } from './supabaseClient';
import { fetchEventsMetadata, getCachedEventMetadata } from './services/eventMetaService';
import { fetchAdminWhatsapp } from './services/adminContactService';
import { prefetchFrames } from './services/frameService';
import { renderCompositedPhoto } from './utils/canvasRenderer';
import { uploadFinalPhotoToStorage, uploadBoomerangToStorage } from './services/storageService';
import { compileCompositedAnimatedFrameVideo } from './utils/animatedFrameRenderer';

export default function App() {
  // Check if current route is /admin
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path.startsWith('/admin') ||
      path.includes('/admin') ||
      hash.startsWith('#/admin') ||
      hash.startsWith('#admin') ||
      hash.includes('admin') ||
      search.includes('admin=1') ||
      search.includes('admin=true')
    );
  });

  // Legal Modal (Terms, Refund, Contact, Privacy for Flip / Payment Gateway KYC)
  const [legalModalOpen, setLegalModalOpen] = useState<boolean>(() => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return (
      path.includes('terms') ||
      hash.includes('terms') ||
      path.includes('refund') ||
      hash.includes('refund') ||
      path.includes('contact') ||
      hash.includes('contact') ||
      path.includes('privacy') ||
      hash.includes('privacy')
    );
  });

  const [legalInitialTab, setLegalInitialTab] = useState<LegalTab>(() => {
    const combined = (window.location.pathname + window.location.hash).toLowerCase();
    if (combined.includes('refund')) return 'refund';
    if (combined.includes('contact')) return 'contact';
    if (combined.includes('privacy')) return 'privacy';
    return 'terms';
  });

  const handleOpenLegal = (tab: LegalTab) => {
    setLegalInitialTab(tab);
    setLegalModalOpen(true);
  };

  // Listen for browser navigation changes & secret keyboard shortcut
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      const combined = path + hash;

      setIsAdminRoute(
        path.startsWith('/admin') ||
        path.includes('/admin') ||
        hash.startsWith('#/admin') ||
        hash.startsWith('#admin') ||
        hash.includes('admin') ||
        search.includes('admin=1') ||
        search.includes('admin=true')
      );

      if (
        combined.includes('terms') ||
        combined.includes('refund') ||
        combined.includes('contact') ||
        combined.includes('privacy')
      ) {
        if (combined.includes('refund')) setLegalInitialTab('refund');
        else if (combined.includes('contact')) setLegalInitialTab('contact');
        else if (combined.includes('privacy')) setLegalInitialTab('privacy');
        else setLegalInitialTab('terms');
        setLegalModalOpen(true);
      }
    };

    // Secret keyboard shortcut untuk operator kiosk: Ctrl + Alt + A atau F2
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A')) ||
        (e.shiftKey && e.altKey && (e.key === 'a' || e.key === 'A')) ||
        e.key === 'F2'
      ) {
        e.preventDefault();
        try {
          window.location.hash = '/admin';
        } catch (_) {}
        setIsAdminRoute(true);
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Event configuration
  const [eventConfig, setEventConfig] = useState<EventConfig>(() => {
    try {
      const cached = localStorage.getItem('photobooth_cached_event_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          parsed &&
          parsed.id &&
          parsed.nama &&
          parsed.nama !== 'ADMIN_CONFIG' &&
          !parsed.nama.toUpperCase().includes('ADMIN_CONFIG')
        ) {
          const hFoto = parsed.hargaPerFoto !== undefined ? parsed.hargaPerFoto : 25000;
          return {
            id: parsed.id || HARDCODED_EVENT_ID,
            nama: parsed.nama || 'AIM SPACE Studio',
            subtitle: parsed.subtitle || 'Photobooth Rumahan & Event — Abadikan Momen Spesial Berkualitas Tinggi',
            tanggal: parsed.tanggal || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
            lokasi: parsed.lokasi || 'AIM SPACE Studio',
            hargaPerFoto: hFoto,
            hargaDigital: parsed.hargaDigital !== undefined ? parsed.hargaDigital : (hFoto === 0 ? 0 : 10000),
            hargaPrint: parsed.hargaPrint !== undefined ? parsed.hargaPrint : (hFoto === 0 ? 0 : 25000),
            isFreeEvent: parsed.isFreeEvent ?? (hFoto === 0),
            paymentMethodsAllowed: parsed.paymentMethodsAllowed || 'all',
            promoBadge: parsed.promoBadge || 'Promo Spesial Studio Rumahan',
            promoDescription: parsed.promoDescription || 'Hasil foto tajam resolusi tinggi 300 DPI, pencahayaan optimal, & cetak instan!',
            cashInstruction: parsed.cashInstruction || 'Serahkan uang tunai langsung ke kasir atau operator photobooth',
            tipeEvent: parsed.tipeEvent || 'Studio Rumahan & Event',
            ...parsed,
          };
        } else {
          localStorage.removeItem('photobooth_cached_event_config');
        }
      }
    } catch (e) {
      // ignore
    }

    const cachedMeta = getCachedEventMetadata(HARDCODED_EVENT_ID);
    return {
      id: HARDCODED_EVENT_ID,
      nama: 'AIM SPACE Studio',
      subtitle: 'Photobooth Rumahan & Event — Abadikan Momen Spesial Berkualitas Tinggi',
      tanggal: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      lokasi: cachedMeta?.lokasi || 'AIM SPACE Studio',
      hargaPerFoto: 25000,
      hargaDigital: 10000,
      hargaPrint: 25000,
      isFreeEvent: false,
      paymentMethodsAllowed: 'all',
      promoBadge: 'Promo Spesial Studio Rumahan',
      promoDescription: 'Hasil foto tajam resolusi tinggi 300 DPI, pencahayaan optimal, & cetak instan!',
      cashInstruction: 'Serahkan uang tunai langsung ke kasir atau operator photobooth',
      tipeEvent: 'Studio Rumahan & Event',
    };
  });

  // Paket terpilih: 'digital' atau 'print' (default print + digital atau sesuai konfigurasi paket aktif)
  const [selectedPackage, setSelectedPackage] = useState<'digital' | 'print'>(() => {
    try {
      const cached = localStorage.getItem('photobooth_cached_event_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.packagesAllowed === 'digital_only') return 'digital';
        if (parsed?.packagesAllowed === 'print_only') return 'print';
      }
    } catch (e) {}
    return 'print';
  });

  // Real-time listener jika admin mengupdate harga, metode pembayaran, atau opsi paket
  useEffect(() => {
    const handleConfigUpdate = (e: any) => {
      if (e.detail) {
        setEventConfig((prev) => {
          const next = { ...prev, ...e.detail };
          if (next.packagesAllowed === 'digital_only') {
            setSelectedPackage('digital');
          } else if (next.packagesAllowed === 'print_only') {
            setSelectedPackage('print');
          }
          return next;
        });
      }
    };
    window.addEventListener('photobooth-event-config-updated', handleConfigUpdate);
    return () => {
      window.removeEventListener('photobooth-event-config-updated', handleConfigUpdate);
    };
  }, []);

  // Sinkronisasi tinggi visual viewport real-time untuk mencegah terpotong tombol navigasi HP (Android & iOS)
  useEffect(() => {
    const updateViewportHeight = () => {
      const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${h}px`);
    };
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    window.addEventListener('orientationchange', updateViewportHeight);
    // Segera mulai prefetch data & preload gambar frame di background sedini mungkin saat app dibuka
    prefetchFrames(HARDCODED_EVENT_ID);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight);
    }
    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportHeight);
      }
    };
  }, []);

  // Active step in 10-step sequence:
  // 1: event-info
  // 2: theme-select
  // 3: layout-select
  // 4: camera
  // 5: filter
  // 6: slotting
  // 7: overlay
  // 8: preview-locked
  // 9: checkout
  // 10: final
  const [currentStep, setCurrentStep] = useState<StepKey>('event-info');

  // Selected Theme (from `frames` table)
  const [selectedTheme, setSelectedTheme] = useState<FrameTheme | null>(null);

  // Selected Combination (from `frame_layouts` table, joined with `layouts`)
  const [selectedFrameLayout, setSelectedFrameLayout] = useState<FrameLayoutItem | null>(null);

  // Active Layout Structure (from `layouts` table)
  const [activeLayout, setActiveLayout] = useState<PhotoboothLayout>(DEFAULT_LAYOUTS[0]);

  // Active Decorative Frame PNG URL
  const [activeFramePngUrl, setActiveFramePngUrl] = useState<string>('');

  // Core Session Data Model
  const [session, setSession] = useState<PhotoboothSession>(() => {
    const initialId = generateUuid();
    return {
      id: initialId,
      timestamp: new Date().toISOString(),
      fotoOriginal: '',
      capturedPhotos: [],
      slotAssignments: {},
      filterDipilih: 'normal',
      frameDipilih: '',
      frame_layout_id: undefined,
      layout: DEFAULT_LAYOUTS[0],
      status: 'draft',
      eventId: HARDCODED_EVENT_ID,
      decorations: [],
      slotAdjustments: {},
    };
  });

  // Order Data Model
  const [order, setOrder] = useState<PhotoboothOrder>(() => ({
    id: generateUuid(),
    sessionId: session?.id || generateUuid(),
    harga: eventConfig.hargaPerFoto || 10000,
    statusPembayaran: 'pending',
    waktuCheckout: '',
  }));

  // Fetch event data from Supabase dengan query paralel & prefetch frames instan
  const loadSupabaseEvent = useCallback(async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlEventQr = urlParams.get('event');
      const urlEventId = urlParams.get('event_id');

      let eventData: any = null;
      let metaMap: Record<string, any> = {};

      if (urlEventQr || urlEventId) {
        let query = supabase
          .from('events')
          .select('*')
          .not('name', 'like', '\\_\\_%')
          .neq('name', 'ADMIN_CONFIG');

        if (urlEventQr) {
          query = query.eq('qr_code', urlEventQr);
        } else {
          query = query.eq('id', urlEventId);
        }

        const [eventRes, fetchedMeta] = await Promise.all([
          query.maybeSingle(),
          fetchEventsMetadata(),
        ]);
        eventData = eventRes.data;
        metaMap = fetchedMeta;
      } else {
        // Ambil daftar event aktif, metadata, dan nomor kontak admin sekaligus secara paralel dalam 1 roundtrip
        const [eventsRes, fetchedMeta] = await Promise.all([
          supabase
            .from('events')
            .select('*')
            .eq('is_active', true)
            .not('name', 'like', '\\_\\_%')
            .neq('name', 'ADMIN_CONFIG')
            .order('created_at', { ascending: false }),
          fetchEventsMetadata(),
          fetchAdminWhatsapp(),
        ]);

        metaMap = fetchedMeta;
        const activeEvents = eventsRes.data || [];

        // 1. Prioritaskan event yang memiliki is_default = 1 / true di Database Cloud (agar sinkron di semua HP & Kiosk)
        eventData = activeEvents.find((e) => e.is_default === 1 || e.is_default === true);

        // 2. Fallback cek default event id yang disimpan di localStorage jika database belum ada yang ditandai default
        if (!eventData) {
          const savedDefaultId = localStorage.getItem('photobooth_default_event_id');
          if (savedDefaultId) {
            eventData = activeEvents.find((e) => e.id === savedDefaultId);
          }
        }

        // 3. Fallback cek event AIM SPACE utama (HARDCODED_EVENT_ID)
        if (!eventData) {
          eventData = activeEvents.find((e) => e.id === HARDCODED_EVENT_ID);
        }

        // 4. Fallback ambil event aktif pertama yang tersedia
        if (!eventData && activeEvents.length > 0) {
          eventData = activeEvents[0];
        }
      }

      if (eventData && eventData.name && !eventData.name.startsWith('__') && eventData.name !== 'ADMIN_CONFIG') {
        // Langsung lakukan pre-fetching frames & preload gambar thumbnail di background
        prefetchFrames(eventData.id);

        // Ambil harga per sesi dari kolom default_price di database Supabase/D1
        const sessionPrice =
          eventData.default_price !== undefined && eventData.default_price !== null
            ? Number(eventData.default_price)
            : (Number(eventData.harga_per_foto) || 10000);

        const eventMeta = metaMap[eventData.id] || {};
        const dynamicLocation = eventMeta.lokasi || (eventData as any).lokasi || 'AIM SPACE Studio';

        // Konfigurasi resmi dari Cloud Database (Single Source of Truth untuk semua perangkat & user)
        const isFree = eventMeta.isFreeEvent !== undefined
          ? eventMeta.isFreeEvent
          : (sessionPrice === 0);

        const finalHargaDigital = isFree
          ? 0
          : (eventMeta.hargaDigital !== undefined
              ? eventMeta.hargaDigital
              : sessionPrice);

        const finalHargaPrint = isFree
          ? 0
          : (eventMeta.hargaPrint !== undefined
              ? eventMeta.hargaPrint
              : (sessionPrice > 0 ? sessionPrice : 25000));

        const finalPackagesAllowed = eventMeta.packagesAllowed || 'both';
        const finalPaymentMethodsAllowed = eventMeta.paymentMethodsAllowed || 'all';
        const finalPromoBadge = eventMeta.promoBadge !== undefined ? eventMeta.promoBadge : 'Promo Spesial Studio Rumahan';
        const finalPromoDescription = eventMeta.promoDescription !== undefined ? eventMeta.promoDescription : 'Hasil foto tajam resolusi tinggi 300 DPI, pencahayaan optimal, & cetak instan!';
        const finalCashInstruction = eventMeta.cashInstruction !== undefined ? eventMeta.cashInstruction : 'Serahkan uang tunai langsung ke kasir atau operator photobooth';

        const config: EventConfig = {
          id: eventData.id,
          nama: eventData.name || eventData.nama || 'AIM SPACE',
          subtitle: eventMeta.subtitle || eventData.deskripsi || eventData.subtitle || 'Simpan memori spesial Anda dengan photobooth digital beresolusi tinggi',
          tanggal: eventMeta.tanggal || eventData.tanggal || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
          lokasi: dynamicLocation,
          hargaPerFoto: sessionPrice,
          hargaDigital: finalHargaDigital,
          hargaPrint: finalHargaPrint,
          isFreeEvent: isFree,
          paymentMethodsAllowed: finalPaymentMethodsAllowed,
          packagesAllowed: finalPackagesAllowed,
          promoBadge: finalPromoBadge,
          promoDescription: finalPromoDescription,
          cashInstruction: finalCashInstruction,
          tipeEvent: eventData.tipe || 'Exhibition & Celebration',
        };

        if (finalPackagesAllowed === 'digital_only') {
          setSelectedPackage('digital');
        } else if (finalPackagesAllowed === 'print_only') {
          setSelectedPackage('print');
        }

        setEventConfig(config);
        setOrder((prev) => ({
          ...prev,
          harga: selectedPackage === 'digital' ? finalHargaDigital : finalHargaPrint,
        }));
        setSession((prev) => ({ ...prev, eventId: config.id }));
        localStorage.setItem('photobooth_cached_event_config', JSON.stringify(config));
        localStorage.setItem('photobooth_default_event_id', config.id);
      } else {
        const cached = localStorage.getItem('photobooth_cached_event_config');
        if (cached && (cached.includes('ADMIN_CONFIG') || cached.includes('__SYSTEM_CONFIG__'))) {
          localStorage.removeItem('photobooth_cached_event_config');
        }
      }
    } catch (err) {
      console.warn('Inisialisasi Supabase event error:', err);
    }
  }, []);

  // Listen to Supabase Realtime changes & focus events for instantaneous price sync
  useEffect(() => {
    loadSupabaseEvent();

    const handleFocus = () => {
      loadSupabaseEvent();
    };

    const handleCustomEventUpdate = (e: any) => {
      if (e?.detail?.price !== undefined) {
        const newPrice = Number(e.detail.price);
        setEventConfig((prev) => ({ ...prev, hargaPerFoto: newPrice }));
        setOrder((prev) => ({ ...prev, harga: newPrice }));
      }
      if (e?.detail?.hargaDigital !== undefined) {
        setEventConfig((prev) => ({ ...prev, hargaDigital: Number(e.detail.hargaDigital) }));
      }
      if (e?.detail?.hargaPrint !== undefined) {
        setEventConfig((prev) => ({ ...prev, hargaPrint: Number(e.detail.hargaPrint) }));
      }
      if (e?.detail?.isFreeEvent !== undefined) {
        setEventConfig((prev) => ({ ...prev, isFreeEvent: Boolean(e.detail.isFreeEvent) }));
      }
      if (e?.detail?.lokasi !== undefined) {
        setEventConfig((prev) => ({ ...prev, lokasi: e.detail.lokasi }));
      }
      if (e?.detail?.name) {
        setEventConfig((prev) => ({ ...prev, nama: e.detail.name }));
      }
      loadSupabaseEvent();
    };

    const handleEventConfigUpdate = (e: any) => {
      if (e?.detail) {
        setEventConfig((prev) => ({ ...prev, ...e.detail }));
      }
      loadSupabaseEvent();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleFocus);
    window.addEventListener('photobooth_event_updated', handleCustomEventUpdate);
    window.addEventListener('photobooth-event-config-updated', handleEventConfigUpdate);

    let channel: any = null;
    try {
      channel = supabase
        .channel('realtime_events_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'events' },
          () => {
            loadSupabaseEvent();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Supabase realtime subscription failed:', err);
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleFocus);
      window.removeEventListener('photobooth_event_updated', handleCustomEventUpdate);
      window.removeEventListener('photobooth-event-config-updated', handleEventConfigUpdate);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadSupabaseEvent]);

  // Keep order price in sync with eventConfig
  useEffect(() => {
    if (order.statusPembayaran === 'pending' && currentStep < 9) {
      const isFree =
        eventConfig.isFreeEvent === true ||
        (eventConfig.hargaPerFoto === 0 &&
          (eventConfig.hargaDigital ?? 0) === 0 &&
          (eventConfig.hargaPrint ?? 0) === 0);

      const pkg = order.selectedPackage || selectedPackage;
      const effectivePrice = isFree
        ? 0
        : pkg === 'digital'
        ? (eventConfig.hargaDigital !== undefined && eventConfig.hargaDigital !== null
            ? eventConfig.hargaDigital
            : (eventConfig.hargaPerFoto || 10000))
        : (eventConfig.hargaPrint !== undefined && eventConfig.hargaPrint !== null
            ? eventConfig.hargaPrint
            : (eventConfig.hargaPerFoto || 25000));

      setOrder((prev) => ({
        ...prev,
        harga: effectivePrice,
      }));
    }
  }, [eventConfig.hargaPerFoto, eventConfig.hargaDigital, eventConfig.hargaPrint, eventConfig.isFreeEvent, order.statusPembayaran, order.selectedPackage, selectedPackage, currentStep]);

  // Reset to initial clean state for next guest
  const handleResetSession = () => {
    const newSessionId = generateUuid();
    setSession({
      id: newSessionId,
      timestamp: new Date().toISOString(),
      fotoOriginal: '',
      capturedPhotos: [],
      slotAssignments: {},
      filterDipilih: 'normal',
      frameDipilih: selectedTheme?.id || '',
      frame_layout_id: undefined,
      layout: DEFAULT_LAYOUTS[0],
      status: 'draft',
      eventId: eventConfig.id || HARDCODED_EVENT_ID,
      decorations: [],
      slotAdjustments: {},
    });
    setOrder({
      id: generateUuid(),
      sessionId: newSessionId,
      harga: eventConfig.hargaPerFoto || 10000,
      statusPembayaran: 'pending',
      waktuCheckout: '',
    });
    setCurrentStep('event-info');
  };

  // Step 1: Proceed from Event Info -> Step 2 Theme Select
  const handleStartFromInfo = () => {
    setCurrentStep('theme-select');
  };

  // Step 2: Frame & Layout selected -> Langsung ke Kamera
  const handleFrameSelected = (combination: FrameLayoutItem) => {
    setSelectedFrameLayout(combination);
    if (combination.frame) {
      setSelectedTheme(combination.frame);
    }
    const layoutObj = normalizeLayout(combination.layout || DEFAULT_LAYOUTS[0]);
    setActiveLayout(layoutObj);
    const framePng = combination.image_url || combination.frame?.image_url || '';
    setActiveFramePngUrl(framePng);

    setSession((prev) => ({
      ...prev,
      frameDipilih: combination.frame_id,
      frame_layout_id: combination.id,
      selectedFrameLayout: combination,
      selectedTheme: combination.frame,
      layout: layoutObj,
    }));

    setCurrentStep('camera');
  };

  // Step 4: Photos captured -> Step 5 Filter
  const handlePhotosCaptured = (
    photos: string[],
    boomerangClips?: string[],
    slotBoomerangConfig?: Record<number, boolean>
  ) => {
    // Strictly map 1:1 photos to slots in exact sequential order (Slot 0 -> Photo 0, Slot 1 -> Photo 1, etc.)
    const initialAssignments: { [slotIndex: number]: string } = {};
    activeLayout.slots.forEach((_, i) => {
      if (photos[i] !== undefined) {
        initialAssignments[i] = photos[i];
      } else if (photos.length > 0) {
        initialAssignments[i] = photos[i % photos.length];
      }
    });

    const slotBoomerangsMap: { [slotIndex: number]: string } = {};
    if (boomerangClips) {
      boomerangClips.forEach((clip, idx) => {
        if (clip) {
          slotBoomerangsMap[idx] = clip;
        }
      });
    }

    const hasAnyBoomerang = boomerangClips ? boomerangClips.some(Boolean) : false;

    setSession((prev) => ({
      ...prev,
      fotoOriginal: photos[0] || '',
      capturedPhotos: photos,
      boomerangEnabled: hasAnyBoomerang,
      slotBoomerangConfig: slotBoomerangConfig || {},
      boomerangClips: boomerangClips || [],
      slotBoomerangs: slotBoomerangsMap,
      boomerangVideoUrl: boomerangClips?.find(Boolean) || '',
      slotAssignments: initialAssignments,
      slotAdjustments: {},
      status: 'draft',
    }));

    setCurrentStep('filter');
  };

  // Step 5: Filter selected
  const handleFilterSelect = (filterId: string) => {
    setSession((prev) => ({
      ...prev,
      filterDipilih: filterId,
    }));
  };

  // Step 6: Slot assignments updated
  const handleUpdateSlotAssignments = (newAssignments: { [slotIndex: number]: string }) => {
    setSession((prev) => ({
      ...prev,
      slotAssignments: newAssignments,
    }));
  };

  // Step 6 & 7: Slot photo adjustments (pan & zoom)
  const handleUpdateSlotAdjustments = (newAdjustments: SlotAdjustmentsMap) => {
    setSession((prev) => ({
      ...prev,
      slotAdjustments: newAdjustments,
    }));
  };

  // Step 7: Custom decorations (texts & emojis)
  const handleUpdateDecorations = (newDecorations: CustomDecorationItem[]) => {
    setSession((prev) => ({
      ...prev,
      decorations: newDecorations,
    }));
  };

  // Step 8: Proceed from Locked Preview to Checkout
  const handleProceedToCheckout = (
    watermarkedPhotoUrl: string,
    chosenPackage: 'digital' | 'print' = selectedPackage
  ) => {
    const newOrderId = generateUuid();
    setSelectedPackage(chosenPackage);
    setSession((prev) => ({
      ...prev,
      watermarkedPhoto: watermarkedPhotoUrl,
      selectedPackage: chosenPackage,
    }));

    const isFree =
      eventConfig.isFreeEvent === true ||
      (eventConfig.hargaPerFoto === 0 &&
        (eventConfig.hargaDigital ?? 0) === 0 &&
        (eventConfig.hargaPrint ?? 0) === 0);

    const price = isFree
      ? 0
      : chosenPackage === 'digital'
      ? (eventConfig.hargaDigital !== undefined && eventConfig.hargaDigital !== null
          ? eventConfig.hargaDigital
          : (eventConfig.hargaPerFoto || 10000))
      : (eventConfig.hargaPrint !== undefined && eventConfig.hargaPrint !== null
          ? eventConfig.hargaPrint
          : (eventConfig.hargaPerFoto || 25000));

    const newOrder: PhotoboothOrder = {
      id: newOrderId,
      sessionId: session.id,
      harga: price,
      statusPembayaran: isFree || price === 0 ? 'success' : 'pending',
      paymentMethod: isFree || price === 0 ? 'Gratis Event' : 'Tunai (Kasir)',
      waktuCheckout: new Date().toISOString(),
      selectedPackage: chosenPackage,
    };
    setOrder(newOrder);

    // Langkah 7: Simpan data sesi & pesanan serta render dan upload file HD & Boomerang ke Storage
    try {
      const sessionPayload: any = {
        id: session.id,
        event_id: session.eventId || eventConfig.id || HARDCODED_EVENT_ID,
        status: isFree || price === 0 ? 'paid' : 'draft',
        filter_applied: session.filterDipilih,
      };
      if (session.frame_layout_id) sessionPayload.frame_layout_id = session.frame_layout_id;
      if (session.frameDipilih) sessionPayload.frame_id = session.frameDipilih;
      supabase.from('sessions').upsert([sessionPayload], { onConflict: 'id' }).then(({ error }) => {
        if (error) console.warn('Supabase upsert session di Step 7 error:', error.message);
      });

      const orderPayload: any = {
        id: newOrderId,
        session_id: session.id,
        amount: price,
        status: isFree || price === 0 ? 'success' : 'pending',
        payment_status: isFree || price === 0 ? 'success' : 'pending',
        payment_method: isFree || price === 0 ? 'Gratis Event' : 'Tunai (Kasir)',
        payment_reference: `ORDER-${newOrderId.slice(0, 8).toUpperCase()}`,
        paid_at: isFree || price === 0 ? new Date().toISOString() : null,
      };
      supabase.from('orders').upsert([orderPayload], { onConflict: 'id' }).then(({ error }) => {
        if (error) console.warn('Supabase upsert order di Step 7 error:', error.message);
      });

      // Render foto HD tanpa watermark dan upload ke Supabase Storage
      if (activeLayout && activeFilter) {
        renderCompositedPhoto({
          photoSrc: session.fotoOriginal,
          slotPhotos: session.slotAssignments,
          slotAdjustments: session.slotAdjustments,
          layout: activeLayout,
          filter: activeFilter,
          frameUrl: activeFramePngUrl,
          decorations: session.decorations,
          withWatermark: false,
        })
          .then((rendered) => {
            uploadFinalPhotoToStorage(session.id, rendered, session.frame_layout_id).then((res) => {
              if (res?.publicUrl) {
                setSession((prev) => ({ ...prev, final_url: res.publicUrl }));
              }
            });
          })
          .catch((err) => console.warn('Gagal render HD di Langkah 7:', err));
      }

      // Upload video 1-Frame Boomerang (Utuh semua foto dan animasi) & klip slot ke Storage jika ada
      const hasBoomerang =
        session.boomerangEnabled ||
        (session.boomerangClips && session.boomerangClips.some(Boolean)) ||
        (session.slotBoomerangs && Object.keys(session.slotBoomerangs).length > 0) ||
        !!session.boomerangVideoUrl;

      if (hasBoomerang && activeLayout) {
        compileCompositedAnimatedFrameVideo({
          layout: activeLayout,
          slotPhotos: session.slotAssignments,
          capturedPhotos: session.capturedPhotos,
          slotBoomerangs: session.slotBoomerangs,
          slotAdjustments: session.slotAdjustments,
          filter: activeFilter,
          frameUrl: activeFramePngUrl,
          decorations: session.decorations,
          withWatermark: false,
          totalDurationMs: 6000,
          fps: 24,
          scaleDownWidth: 720,
        })
          .then((res) => {
            if (res.videoBlob || res.videoUrl) {
              uploadBoomerangToStorage(session.id, res.videoBlob || res.videoUrl, 'frame').then((uRes) => {
                if (uRes.success && uRes.publicUrl) {
                  try {
                    const existingCache = JSON.parse(localStorage.getItem('photobooth_boomerang_sessions') || '{}');
                    existingCache[session.id] = {
                      ...(existingCache[session.id] || {}),
                      hasBoomerang: true,
                      frameVideoUrl: uRes.publicUrl,
                      primaryVideoUrl: uRes.publicUrl,
                      updatedAt: new Date().toISOString(),
                    };
                    localStorage.setItem('photobooth_boomerang_sessions', JSON.stringify(existingCache));
                  } catch (cErr) {
                    console.warn('Cache local frame boomerang error:', cErr);
                  }
                }
              });
            }
          })
          .catch((cErr) => console.warn('Gagal render 1-frame boomerang di Langkah 7:', cErr));

        // Upload juga klip slot sebagai backup
        if (session.slotBoomerangs && Object.keys(session.slotBoomerangs).length > 0) {
          Object.entries(session.slotBoomerangs).forEach(([slotIdx, clip]) => {
            if (clip) {
              uploadBoomerangToStorage(session.id, clip as string | Blob, Number(slotIdx)).catch(console.warn);
            }
          });
        } else if (session.boomerangClips && session.boomerangClips.length > 0) {
          session.boomerangClips.forEach((clip, idx) => {
            if (clip) uploadBoomerangToStorage(session.id, clip as string | Blob, idx).catch(console.warn);
          });
        }
      }
    } catch (saveErr) {
      console.warn('Gagal menyimpan file/sesi di Langkah 7:', saveErr);
    }

    // Jika event gratis (Rp 0), langsung arahkan ke Step 10 Final (Cetak & Download)
    if (isFree || price === 0) {
      setSession((prev) => ({
        ...prev,
        status: 'paid',
      }));
      setCurrentStep('final');
    } else {
      setCurrentStep('checkout');
    }
  };

  // Step 9: Payment Success -> Step 10 Final
  const handlePaymentSuccess = (settledOrder: PhotoboothOrder) => {
    setOrder(settledOrder);
    setSession((prev) => ({
      ...prev,
      status: 'paid',
    }));
    setCurrentStep('final');
  };

  // Current active filter preset
  const activeFilter =
    FILTER_PRESETS.find((f) => f.id === session.filterDipilih) || FILTER_PRESETS[0];

  // Admin routing handlers
  const handleBackToKiosk = () => {
    try {
      const base = import.meta.env.BASE_URL || '/';
      window.history.pushState({}, '', base);
    } catch (e) {}
    setIsAdminRoute(false);
    loadSupabaseEvent();
  };

  const handleOpenKioskWithEvent = (qrCode: string) => {
    try {
      const base = import.meta.env.BASE_URL || '/';
      const separator = base.endsWith('/') ? '' : '/';
      window.history.pushState({}, '', `${base}${separator}?event=${encodeURIComponent(qrCode)}`);
    } catch (e) {}
    setIsAdminRoute(false);
    loadSupabaseEvent();
  };

  const handleOpenAdmin = () => {
    try {
      const base = import.meta.env.BASE_URL || '/';
      const separator = base.endsWith('/') ? '' : '/';
      window.history.pushState({}, '', `${base}${separator}admin`);
    } catch (e) {}
    setIsAdminRoute(true);
  };

  // If viewing admin route
  if (isAdminRoute) {
    return (
      <AdminPortal
        onBackToKiosk={handleBackToKiosk}
        onOpenKioskWithEvent={handleOpenKioskWithEvent}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#07080c] text-zinc-100 flex flex-col items-center justify-start selection:bg-amber-500 selection:text-zinc-950 font-sans w-full">
      {/* Mobile-first centered phone/kiosk canvas wrapper */}
      <div className="w-full max-w-lg min-h-screen flex flex-col bg-[#0b0d13] border-x border-zinc-800/60 shadow-2xl relative">
        {/* Persistent Top Bar */}
        <Navbar
          currentStep={currentStep}
          eventName={eventConfig.nama}
          onReset={handleResetSession}
          onOpenAdmin={handleOpenAdmin}
        />

        {/* Dynamic Step Content */}
        <main className="flex-1 flex flex-col w-full">
          {/* STEP 1: Info Event */}
          {(currentStep === 'event-info' || currentStep === 'landing') && (
            <Step1EventInfo
              eventConfig={eventConfig}
              onStart={handleStartFromInfo}
              onOpenAdmin={handleOpenAdmin}
              onOpenLegal={handleOpenLegal}
              selectedPackage={selectedPackage}
              onSelectPackage={setSelectedPackage}
            />
          )}

          {/* STEP 2: Pilih Frame Photobooth (Langsung menentukan frame dan slotnya) */}
          {currentStep === 'theme-select' && (
            <Step2ThemeSelect
              eventId={eventConfig.id}
              selectedThemeId={selectedTheme?.id}
              onSelectFrameAndLayout={handleFrameSelected}
              onBack={() => setCurrentStep('event-info')}
              onOpenAdmin={handleOpenAdmin}
            />
          )}

          {/* STEP 4: Kamera (Mengambil tepat photo_count foto) */}
          {currentStep === 'camera' && (
            <Step4Camera
              layout={activeLayout}
              onPhotosCaptured={handlePhotosCaptured}
              onBack={() => setCurrentStep('theme-select')}
              initialBoomerangEnabled={eventConfig.boomerangEnabled ?? false}
            />
          )}

          {/* URL Frame PNG Aktif dengan fallback multi-sumber */}
          {(() => null)()}

          {/* STEP 5: Filter Warna */}
          {currentStep === 'filter' && (
            <Step5Filters
              photos={session.capturedPhotos}
              selectedFilterId={session.filterDipilih}
              onSelectFilter={handleFilterSelect}
              onNext={() => setCurrentStep('slotting')}
              onBack={() => setCurrentStep('camera')}
            />
          )}

          {/* STEP 6: Penataan ke Slot (1:1 persis, geser pan & zoom, serta swap) */}
          {currentStep === 'slotting' && (
            <Step6Slotting
              photos={session.capturedPhotos}
              layout={activeLayout}
              filter={activeFilter}
              frameUrl={
                activeFramePngUrl ||
                selectedFrameLayout?.image_url ||
                selectedFrameLayout?.frame?.image_url ||
                selectedTheme?.image_url ||
                session.selectedFrameLayout?.image_url ||
                session.selectedFrameLayout?.frame?.image_url ||
                session.selectedTheme?.image_url ||
                ''
              }
              slotAssignments={session.slotAssignments}
              onUpdateSlotAssignments={handleUpdateSlotAssignments}
              slotAdjustments={session.slotAdjustments || {}}
              onUpdateSlotAdjustments={handleUpdateSlotAdjustments}
              onNext={() => setCurrentStep('overlay')}
              onBack={() => setCurrentStep('filter')}
            />
          )}

          {/* STEP 7: Overlay Frame (PNG layer paling atas & Kustom Teks/Emoji & Pas-kan Foto) */}
          {currentStep === 'overlay' && (
            <Step7Overlay
              photos={session.capturedPhotos}
              slotAssignments={session.slotAssignments}
              layout={activeLayout}
              frameUrl={
                activeFramePngUrl ||
                selectedFrameLayout?.image_url ||
                selectedFrameLayout?.frame?.image_url ||
                selectedTheme?.image_url ||
                session.selectedFrameLayout?.image_url ||
                session.selectedFrameLayout?.frame?.image_url ||
                session.selectedTheme?.image_url ||
                ''
              }
              themeName={selectedTheme?.name || 'Photobooth Frame'}
              filter={activeFilter}
              decorations={session.decorations || []}
              onUpdateDecorations={handleUpdateDecorations}
              slotAdjustments={session.slotAdjustments || {}}
              onUpdateSlotAdjustments={handleUpdateSlotAdjustments}
              onNext={() => setCurrentStep('preview-locked')}
              onBack={() => setCurrentStep('slotting')}
            />
          )}

          {/* STEP 8: Pratinjau Terkunci (Watermarked) */}
          {currentStep === 'preview-locked' && (
            <Step8PreviewLocked
              photos={session.capturedPhotos}
              slotAssignments={session.slotAssignments}
              slotAdjustments={session.slotAdjustments || {}}
              layout={activeLayout}
              frameUrl={
                activeFramePngUrl ||
                selectedFrameLayout?.image_url ||
                selectedFrameLayout?.frame?.image_url ||
                selectedTheme?.image_url ||
                session.selectedFrameLayout?.image_url ||
                session.selectedFrameLayout?.frame?.image_url ||
                session.selectedTheme?.image_url ||
                ''
              }
              filter={activeFilter}
              price={
                selectedPackage === 'digital'
                  ? eventConfig.hargaDigital ?? 10000
                  : eventConfig.hargaPrint ?? eventConfig.hargaPerFoto ?? 25000
              }
              decorations={session.decorations || []}
              eventConfig={eventConfig}
              selectedPackage={selectedPackage}
              session={session}
              onSelectPackage={setSelectedPackage}
              onProceedToCheckout={handleProceedToCheckout}
              onBack={() => setCurrentStep('overlay')}
            />
          )}

          {/* STEP 9: Checkout & Pembayaran */}
          {currentStep === 'checkout' && (
            <Step9Checkout
              session={session}
              order={order}
              eventConfig={eventConfig}
              layout={activeLayout}
              filter={activeFilter}
              frameUrl={activeFramePngUrl}
              onPaymentSuccess={handlePaymentSuccess}
              onBack={() => setCurrentStep('preview-locked')}
              onOpenLegal={handleOpenLegal}
              onRestart={handleResetSession}
            />
          )}

          {/* STEP 10: Hasil Akhir & Cetak */}
          {currentStep === 'final' && (
            <Step10FinalSuccess
              session={session}
              order={order}
              filter={activeFilter}
              layout={activeLayout}
              frameUrl={activeFramePngUrl}
              eventConfig={eventConfig}
              onRestart={handleResetSession}
            />
          )}
        </main>
      </div>

      {/* Global Legal Information Modal (Terms, Refund, Contact, Privacy) */}
      <LegalInfoModal
        isOpen={legalModalOpen}
        initialTab={legalInitialTab}
        onClose={() => setLegalModalOpen(false)}
      />
    </div>
  );
}
