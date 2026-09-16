import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Step1EventInfo } from './components/Step1EventInfo';
import { Step2ThemeSelect } from './components/Step2ThemeSelect';
import { Step3LayoutSelect } from './components/Step3LayoutSelect';
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
} from './types';
import { FILTER_PRESETS } from './data/filters';
import { DEFAULT_LAYOUTS } from './data/defaultLayouts';
import { generateUuid } from './utils/uuid';
import { supabase, HARDCODED_EVENT_ID } from './supabaseClient';

export default function App() {
  // Check if current route is /admin
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return path.startsWith('/admin') || hash.startsWith('#/admin') || hash.startsWith('#admin');
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

  // Listen for browser navigation changes
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const combined = path + hash;

      setIsAdminRoute(path.startsWith('/admin') || hash.startsWith('#/admin') || hash.startsWith('#admin'));

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

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Event configuration
  const [eventConfig, setEventConfig] = useState<EventConfig>(() => {
    try {
      const cached = localStorage.getItem('photobooth_cached_event_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id && parsed.nama) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore
    }

    return {
      id: HARDCODED_EVENT_ID,
      nama: 'SnapMoment Exclusive Event',
      subtitle: 'Simpan memori spesial Anda dengan photobooth digital beresolusi tinggi',
      tanggal: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      lokasi: 'Main Ballroom & Hall',
      hargaPerFoto: 5000,
      tipeEvent: 'Exhibition & Celebration',
    };
  });

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
    };
  });

  // Order Data Model
  const [order, setOrder] = useState<PhotoboothOrder>(() => ({
    id: generateUuid(),
    sessionId: session?.id || generateUuid(),
    harga: eventConfig.hargaPerFoto || 25000,
    statusPembayaran: 'pending',
    waktuCheckout: '',
  }));

  // Fetch event data from Supabase
  const loadSupabaseEvent = useCallback(async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlEventQr = urlParams.get('event');
      const urlEventId = urlParams.get('event_id');

      let eventData: any = null;

      if (urlEventQr) {
        const { data } = await supabase
          .from('events')
          .select('*')
          .eq('qr_code', urlEventQr)
          .maybeSingle();
        eventData = data;
      } else if (urlEventId) {
        const { data } = await supabase
          .from('events')
          .select('*')
          .eq('id', urlEventId)
          .maybeSingle();
        eventData = data;
      } else {
        const { data } = await supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        eventData = data;
      }

      if (eventData) {
        // Ambil harga per sesi dari kolom default_price di database Supabase
        const sessionPrice =
          eventData.default_price !== undefined && eventData.default_price !== null
            ? Number(eventData.default_price)
            : (Number(eventData.harga_per_foto) || 5000);

        const config: EventConfig = {
          id: eventData.id,
          nama: eventData.name || eventData.nama || 'Photobooth Event',
          subtitle: eventData.deskripsi || eventData.subtitle || 'Simpan memori spesial Anda di photobooth',
          tanggal: eventData.tanggal || '',
          lokasi: eventData.lokasi || 'Kiosk Photobooth',
          hargaPerFoto: sessionPrice,
          tipeEvent: eventData.tipe || '',
        };

        setEventConfig(config);
        setOrder((prev) => ({ ...prev, harga: sessionPrice }));
        setSession((prev) => ({ ...prev, eventId: config.id }));
        localStorage.setItem('photobooth_cached_event_config', JSON.stringify(config));
      }
    } catch (err) {
      console.warn('Inisialisasi Supabase event error:', err);
    }
  }, []);

  useEffect(() => {
    loadSupabaseEvent();
  }, [loadSupabaseEvent]);

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
    });
    setOrder({
      id: generateUuid(),
      sessionId: newSessionId,
      harga: eventConfig.hargaPerFoto || 25000,
      statusPembayaran: 'pending',
      waktuCheckout: '',
    });
    setCurrentStep('event-info');
  };

  // Step 1: Proceed from Event Info -> Step 2 Theme Select
  const handleStartFromInfo = () => {
    setCurrentStep('theme-select');
  };

  // Step 2: Theme selected -> Step 3 Layout Select
  const handleThemeSelected = (theme: FrameTheme) => {
    setSelectedTheme(theme);
    setSession((prev) => ({
      ...prev,
      frameDipilih: theme.id,
    }));
    setCurrentStep('layout-select');
  };

  // Step 3: Layout Variant selected -> Step 4 Camera
  const handleLayoutVariantSelected = (combination: FrameLayoutItem) => {
    setSelectedFrameLayout(combination);
    const layoutObj = combination.layout || DEFAULT_LAYOUTS[0];
    setActiveLayout(layoutObj);
    setActiveFramePngUrl(combination.image_url || '');

    setSession((prev) => ({
      ...prev,
      frame_layout_id: combination.id,
      layout: layoutObj,
    }));

    setCurrentStep('camera');
  };

  // Step 4: Photos captured -> Step 5 Filter
  const handlePhotosCaptured = (photos: string[]) => {
    // Automatically map 1:1 photos to slots
    const initialAssignments: { [slotIndex: number]: string } = {};
    activeLayout.slots.forEach((slot, i) => {
      const slotKey = slot.index ?? i;
      if (photos[i]) {
        initialAssignments[slotKey] = photos[i];
      } else if (photos.length > 0) {
        initialAssignments[slotKey] = photos[i % photos.length];
      }
    });

    setSession((prev) => ({
      ...prev,
      fotoOriginal: photos[0] || '',
      capturedPhotos: photos,
      slotAssignments: initialAssignments,
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

  // Step 7: Custom decorations (texts & emojis)
  const handleUpdateDecorations = (newDecorations: CustomDecorationItem[]) => {
    setSession((prev) => ({
      ...prev,
      decorations: newDecorations,
    }));
  };

  // Step 8: Proceed from Locked Preview to Checkout
  const handleProceedToCheckout = (watermarkedPhotoUrl: string) => {
    const newOrderId = generateUuid();
    setSession((prev) => ({
      ...prev,
      watermarkedPhoto: watermarkedPhotoUrl,
    }));
    setOrder({
      id: newOrderId,
      sessionId: session.id,
      harga: eventConfig.hargaPerFoto,
      statusPembayaran: 'pending',
      waktuCheckout: new Date().toISOString(),
    });
    setCurrentStep('checkout');
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
      window.history.pushState({}, '', '/');
    } catch (e) {}
    setIsAdminRoute(false);
  };

  const handleOpenKioskWithEvent = (qrCode: string) => {
    try {
      window.history.pushState({}, '', `/?event=${encodeURIComponent(qrCode)}`);
    } catch (e) {}
    setIsAdminRoute(false);
    loadSupabaseEvent();
  };

  const handleOpenAdmin = () => {
    try {
      window.history.pushState({}, '', '/admin');
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
    <div className="min-h-screen bg-[#07080c] text-zinc-100 flex flex-col items-center justify-start selection:bg-amber-500 selection:text-zinc-950 font-sans">
      {/* Mobile-first centered phone/kiosk canvas wrapper */}
      <div className="w-full max-w-lg h-screen flex flex-col bg-[#0b0d13] border-x border-zinc-800/60 shadow-2xl relative overflow-hidden">
        {/* Persistent Top Bar */}
        <Navbar
          currentStep={currentStep}
          eventName={eventConfig.nama}
          onReset={handleResetSession}
        />

        {/* Dynamic Step Content */}
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {/* STEP 1: Info Event */}
          {(currentStep === 'event-info' || currentStep === 'landing') && (
            <Step1EventInfo
              eventConfig={eventConfig}
              onStart={handleStartFromInfo}
              onOpenAdmin={handleOpenAdmin}
              onOpenLegal={handleOpenLegal}
            />
          )}

          {/* STEP 2: Pilih Tema Frame (dari tabel frames) */}
          {currentStep === 'theme-select' && (
            <Step2ThemeSelect
              eventId={eventConfig.id}
              selectedThemeId={selectedTheme?.id}
              onSelectTheme={handleThemeSelected}
              onBack={() => setCurrentStep('event-info')}
              onOpenAdmin={handleOpenAdmin}
            />
          )}

          {/* STEP 3: Pilih Varian Layout (join frame_layouts & layouts) */}
          {currentStep === 'layout-select' && (
            selectedTheme ? (
              <Step3LayoutSelect
                selectedTheme={selectedTheme}
                selectedFrameLayoutId={selectedFrameLayout?.id}
                onSelectLayoutVariant={handleLayoutVariantSelected}
                onBack={() => setCurrentStep('theme-select')}
                onOpenAdmin={handleOpenAdmin}
              />
            ) : (
              <div className="p-8 text-center">
                <p className="text-zinc-400 text-sm mb-4">Silakan pilih tema frame terlebih dahulu.</p>
                <button
                  onClick={() => setCurrentStep('theme-select')}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs"
                >
                  Kembali ke Pilihan Tema
                </button>
              </div>
            )
          )}

          {/* STEP 4: Kamera (Mengambil tepat photo_count foto) */}
          {currentStep === 'camera' && (
            <Step4Camera
              layout={activeLayout}
              onPhotosCaptured={handlePhotosCaptured}
              onBack={() => setCurrentStep('layout-select')}
            />
          )}

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

          {/* STEP 6: Penataan ke Slot (1:1 persis & swap) */}
          {currentStep === 'slotting' && (
            <Step6Slotting
              photos={session.capturedPhotos}
              layout={activeLayout}
              filter={activeFilter}
              slotAssignments={session.slotAssignments}
              onUpdateSlotAssignments={handleUpdateSlotAssignments}
              onNext={() => setCurrentStep('overlay')}
              onBack={() => setCurrentStep('filter')}
            />
          )}

          {/* STEP 7: Overlay Frame (PNG layer paling atas & Kustom Teks/Emoji) */}
          {currentStep === 'overlay' && (
            <Step7Overlay
              photos={session.capturedPhotos}
              slotAssignments={session.slotAssignments}
              layout={activeLayout}
              frameUrl={activeFramePngUrl}
              themeName={selectedTheme?.name || 'Photobooth Frame'}
              filter={activeFilter}
              decorations={session.decorations || []}
              onUpdateDecorations={handleUpdateDecorations}
              onNext={() => setCurrentStep('preview-locked')}
              onBack={() => setCurrentStep('slotting')}
            />
          )}

          {/* STEP 8: Pratinjau Terkunci (Watermarked) */}
          {currentStep === 'preview-locked' && (
            <Step8PreviewLocked
              photos={session.capturedPhotos}
              slotAssignments={session.slotAssignments}
              layout={activeLayout}
              frameUrl={activeFramePngUrl}
              filter={activeFilter}
              price={eventConfig.hargaPerFoto}
              decorations={session.decorations || []}
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
