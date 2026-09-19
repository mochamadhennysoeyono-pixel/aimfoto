import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Power,
  RefreshCw,
  Search,
  QrCode,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
  Database,
  Trash2,
  X,
  Star,
  Edit2,
  MapPin,
  Banknote,
  Gift,
  Tag,
  Smartphone,
  Printer,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { generateUuid } from '../utils/uuid';
import { fetchEventsMetadata, saveEventMetadata } from '../services/eventMetaService';

export interface AdminEventItem {
  id: string;
  name: string;
  qr_code: string;
  lokasi?: string;
  default_price?: number;
  is_active?: boolean;
  is_default?: boolean;
  created_at?: string;
  is_free_event?: boolean;
  harga_digital?: number;
  harga_print?: number;
  promo_badge?: string;
  promo_description?: string;
}

interface AdminEventsProps {
  onSelectEventForFrames?: (eventId: string) => void;
  onOpenKioskEvent?: (qrCode: string) => void;
}

export const AdminEvents: React.FC<AdminEventsProps> = ({
  onSelectEventForFrames,
  onOpenKioskEvent,
}) => {
  const [events, setEvents] = useState<AdminEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedQrCode, setCopiedQrCode] = useState<string | null>(null);

  // Delete modal state
  const [eventToDelete, setEventToDelete] = useState<AdminEventItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // RLS blocked guidance modal state
  const [rlsBlockedEvent, setRlsBlockedEvent] = useState<AdminEventItem | null>(null);
  const [hasCopiedSql, setHasCopiedSql] = useState(false);
  const [isDeactivatingInstead, setIsDeactivatingInstead] = useState(false);

  // Default event tracking
  const [defaultEventId, setDefaultEventId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('photobooth_default_event_id');
    } catch (e) {
      return null;
    }
  });

  // Form states for creating a new event
  const [showAddForm, setShowAddForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formQrCode, setFormQrCode] = useState('');
  const [formLokasi, setFormLokasi] = useState('');
  const [formDefaultPrice, setFormDefaultPrice] = useState('10000');
  const [formIsFreeEvent, setFormIsFreeEvent] = useState(false);
  const [formHargaDigital, setFormHargaDigital] = useState('10000');
  const [formHargaPrint, setFormHargaPrint] = useState('25000');
  const [formPromoBadge, setFormPromoBadge] = useState('');
  const [formPromoDescription, setFormPromoDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [createdEventLink, setCreatedEventLink] = useState<{ name: string; link: string } | null>(null);

  // Edit event modal states
  const [editingEvent, setEditingEvent] = useState<AdminEventItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editQrCode, setEditQrCode] = useState('');
  const [editLokasi, setEditLokasi] = useState('');
  const [editDefaultPrice, setEditDefaultPrice] = useState('10000');
  const [editIsFreeEvent, setEditIsFreeEvent] = useState(false);
  const [editHargaDigital, setEditHargaDigital] = useState('10000');
  const [editHargaPrint, setEditHargaPrint] = useState('25000');
  const [editPromoBadge, setEditPromoBadge] = useState('');
  const [editPromoDescription, setEditPromoDescription] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Fetch all events from Supabase
  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // Ambil events dan metadata lokasi secara bersamaan
      const [eventsResult, metaMap] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false }),
        fetchEventsMetadata(),
      ]);

      const { data, error } = eventsResult;

      if (error) {
        console.warn('Error fetching events:', error.message);
        setErrorMsg(`Gagal memuat events: ${error.message}`);
      } else if (data) {
        // Filter out any internal diagnostic or config rows
        const cleanedData = (data as AdminEventItem[]).filter(
          (ev) =>
            ev.name !== 'ADMIN_CONFIG' &&
            !ev.name?.toUpperCase().includes('ADMIN_CONFIG') &&
            !ev.name?.startsWith('__') &&
            ev.id !== '11111111-2222-3333-4444-555555555555' &&
            ev.id !== '00000000-0000-0000-0000-000000000001' &&
            !ev.qr_code?.startsWith('__')
        ).map((ev) => {
          const meta = metaMap[ev.id] || {};
          const isFree = meta.isFreeEvent ?? (ev.default_price === 0);
          const defaultPr = ev.default_price !== undefined && ev.default_price !== null ? Number(ev.default_price) : 10000;
          return {
            ...ev,
            lokasi: meta.lokasi || (ev as any).lokasi || '',
            is_free_event: isFree,
            harga_digital: meta.hargaDigital !== undefined ? meta.hargaDigital : (isFree ? 0 : defaultPr),
            harga_print: meta.hargaPrint !== undefined ? meta.hargaPrint : (isFree ? 0 : (defaultPr > 0 ? defaultPr : 25000)),
            promo_badge: meta.promoBadge || '',
            promo_description: meta.promoDescription || '',
          };
        });

        setEvents(cleanedData);
        // Cari event yang memiliki is_default = true di Supabase
        const foundDefault = cleanedData.find((ev) => ev.is_default);
        if (foundDefault) {
          setDefaultEventId(foundDefault.id);
          try {
            localStorage.setItem('photobooth_default_event_id', foundDefault.id);
          } catch (e) {}
        }
      }
    } catch (err: any) {
      console.warn('Network error fetching events:', err);
      setErrorMsg(err.message || 'Gagal tersambung ke Supabase');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Generate full link for QR code
  const getEventLink = (qrCode: string) => {
    const origin = window.location.origin;
    return `${origin}/?event=${encodeURIComponent(qrCode)}`;
  };

  const handleCopyLink = async (qrCode: string) => {
    const link = getEventLink(qrCode);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedQrCode(qrCode);
      setTimeout(() => setCopiedQrCode(null), 2500);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  // Create new event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formQrCode.trim()) {
      setErrorMsg('Nama event dan kode QR wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const newId = generateUuid();
    const cleanQr = formQrCode.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const parsedPrice = parseInt(formDefaultPrice, 10) || 10000;

    const payload: Record<string, any> = {
      id: newId,
      name: formName.trim(),
      qr_code: cleanQr,
      default_price: parsedPrice,
      is_active: formIsActive,
      is_default: formIsDefault,
      created_at: new Date().toISOString(),
    };

    try {
      let { data, error } = await supabase
        .from('events')
        .insert([payload])
        .select();

      // Jika kolom is_default belum ada di database Supabase, fallback insert tanpa kolom tersebut
      if (error && (error.code === '42703' || error.message?.includes('is_default'))) {
        delete payload.is_default;
        const retryResult = await supabase
          .from('events')
          .insert([payload])
          .select();
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) {
        if (error.code === '42501') {
          // Supabase RLS error explanation
          setErrorMsg(
            `Supabase RLS Error: Row-Level Security menolak insert. Jalankan SQL ini di Supabase SQL Editor: ALTER TABLE events DISABLE ROW LEVEL SECURITY; atau buat policy INSERT publik.`
          );
        } else {
          setErrorMsg(`Gagal menambah event: ${error.message}`);
        }
      } else {
        const parsedDigital = formIsFreeEvent ? 0 : (parseInt(formHargaDigital, 10) || parsedPrice);
        const parsedPrint = formIsFreeEvent ? 0 : (parseInt(formHargaPrint, 10) || parsedPrice);

        // Simpan metadata lokasi, tarif paket, dan promo
        await saveEventMetadata(newId, {
          lokasi: formLokasi.trim(),
          isFreeEvent: formIsFreeEvent,
          hargaDigital: parsedDigital,
          hargaPrint: parsedPrint,
          promoBadge: formPromoBadge.trim(),
          promoDescription: formPromoDescription.trim(),
        });

        // Jika dicentang sebagai default event
        if (formIsDefault) {
          try {
            localStorage.setItem('photobooth_default_event_id', newId);
            setDefaultEventId(newId);
            // Simpan cache event utama
            const fullConfig = {
              id: newId,
              nama: formName.trim(),
              lokasi: formLokasi.trim() || 'Photobooth Station',
              hargaPerFoto: parsedPrice,
              isFreeEvent: formIsFreeEvent,
              hargaDigital: parsedDigital,
              hargaPrint: parsedPrint,
              promoBadge: formPromoBadge.trim(),
              promoDescription: formPromoDescription.trim(),
            };
            localStorage.setItem(
              'photobooth_cached_event_config',
              JSON.stringify(fullConfig)
            );
            window.dispatchEvent(
              new CustomEvent('photobooth-event-config-updated', {
                detail: fullConfig,
              })
            );
            window.dispatchEvent(
              new CustomEvent('photobooth_event_updated', {
                detail: {
                  id: newId,
                  price: parsedPrice,
                  name: formName.trim(),
                  lokasi: formLokasi.trim() || 'Photobooth Station',
                  hargaDigital: parsedDigital,
                  hargaPrint: parsedPrint,
                  isFreeEvent: formIsFreeEvent,
                },
              })
            );
            // Coba un-default event lain di Supabase jika kolom is_default ada
            await supabase.from('events').update({ is_default: false }).neq('id', newId);
          } catch (storageErr) {
            console.log('Catatan simpan default event:', storageErr);
          }
        }

        const link = getEventLink(cleanQr);
        setCreatedEventLink({ name: formName.trim(), link });
        setSuccessMsg(
          `Event "${formName.trim()}" berhasil dibuat${
            formIsDefault ? ' dan dijadikan Default Event halaman awal' : ''
          }!`
        );
        setFormName('');
        setFormQrCode('');
        setFormLokasi('');
        setFormIsDefault(false);
        setShowAddForm(false);
        fetchEvents();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan event');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (ev: AdminEventItem) => {
    const nextStatus = !ev.is_active;
    // Optimistic update
    setEvents((prev) =>
      prev.map((item) => (item.id === ev.id ? { ...item, is_active: nextStatus } : item))
    );

    try {
      const { error } = await supabase
        .from('events')
        .update({ is_active: nextStatus })
        .eq('id', ev.id);

      if (error) {
        console.warn('Gagal toggle event status:', error.message);
        // Revert
        setEvents((prev) =>
          prev.map((item) => (item.id === ev.id ? { ...item, is_active: ev.is_active } : item))
        );
        setErrorMsg(`Gagal mengubah status: ${error.message}`);
      } else {
        setSuccessMsg(`Status event "${ev.name}" diperbarui.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengubah status');
    }
  };

  // Simpan perubahan edit event (nama, qr_code, harga per sesi, status aktif)
  const handleSaveEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    if (!editName.trim() || !editQrCode.trim()) {
      setErrorMsg('Nama event dan kode QR tidak boleh kosong.');
      return;
    }

    setIsSavingEdit(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanQr = editQrCode.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const parsedPrice = parseInt(editDefaultPrice, 10) || 10000;

    try {
      const { error } = await supabase
        .from('events')
        .update({
          name: editName.trim(),
          qr_code: cleanQr,
          default_price: parsedPrice,
          is_active: editIsActive,
        })
        .eq('id', editingEvent.id);

      if (error) throw error;

      const parsedDigital = editIsFreeEvent ? 0 : (parseInt(editHargaDigital, 10) || 0);
      const parsedPrint = editIsFreeEvent ? 0 : (parseInt(editHargaPrint, 10) || 0);

      // Simpan metadata lokasi, tarif paket, dan promo ke row __EVENTS_META__
      await saveEventMetadata(editingEvent.id, {
        lokasi: editLokasi.trim(),
        isFreeEvent: editIsFreeEvent,
        hargaDigital: parsedDigital,
        hargaPrint: parsedPrint,
        promoBadge: editPromoBadge.trim(),
        promoDescription: editPromoDescription.trim(),
      });

      // Update state event di tabel
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === editingEvent.id
            ? {
                ...ev,
                name: editName.trim(),
                qr_code: cleanQr,
                lokasi: editLokasi.trim(),
                default_price: parsedPrice,
                is_active: editIsActive,
                is_free_event: editIsFreeEvent,
                harga_digital: parsedDigital,
                harga_print: parsedPrint,
                promo_badge: editPromoBadge.trim(),
                promo_description: editPromoDescription.trim(),
              }
            : ev
        )
      );

      // Sinkronkan ke cache localStorage & dispatch event untuk update realtime
      try {
        const cached = localStorage.getItem('photobooth_cached_event_config');
        let shouldUpdate = false;
        let baseObj: any = {};

        if (cached) {
          baseObj = JSON.parse(cached);
          if (
            baseObj.id === editingEvent.id ||
            editingEvent.id === 'f1723176-eaa7-4c1d-bfc9-2c112677bb38' ||
            editingEvent.id === defaultEventId ||
            editingEvent.is_default
          ) {
            shouldUpdate = true;
          }
        } else {
          shouldUpdate = true;
        }

        if (shouldUpdate) {
          localStorage.setItem(
            'photobooth_cached_event_config',
            JSON.stringify({
              ...baseObj,
              id: editingEvent.id,
              nama: editName.trim(),
              lokasi: editLokasi.trim() || 'AIM SPACE Studio',
              hargaPerFoto: parsedPrice,
              isFreeEvent: editIsFreeEvent,
              hargaDigital: parsedDigital,
              hargaPrint: parsedPrint,
              promoBadge: editPromoBadge.trim(),
              promoDescription: editPromoDescription.trim(),
            })
          );
        }

        window.dispatchEvent(
          new CustomEvent('photobooth_event_updated', {
            detail: {
              id: editingEvent.id,
              price: parsedPrice,
              name: editName.trim(),
              lokasi: editLokasi.trim(),
              isFreeEvent: editIsFreeEvent,
              hargaDigital: parsedDigital,
              hargaPrint: parsedPrint,
              promoBadge: editPromoBadge.trim(),
              promoDescription: editPromoDescription.trim(),
            },
          })
        );
        window.dispatchEvent(
          new CustomEvent('photobooth-event-config-updated', {
            detail: {
              id: editingEvent.id,
              isFreeEvent: editIsFreeEvent,
              hargaDigital: parsedDigital,
              hargaPrint: parsedPrint,
              promoBadge: editPromoBadge.trim(),
              promoDescription: editPromoDescription.trim(),
            },
          })
        );
      } catch (e) {
        // ignore
      }

      setSuccessMsg(`Perubahan event "${editName.trim()}" (Harga: Rp ${parsedPrice.toLocaleString('id-ID')}, Lokasi: "${editLokasi.trim() || 'Default'}") berhasil disimpan.`);
      setEditingEvent(null);
    } catch (err: any) {
      setErrorMsg(`Gagal menyimpan perubahan event: ${err.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Confirm delete event from Supabase
  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;

    setIsDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Delete associated frames for this event first to avoid foreign key issues
      try {
        await supabase
          .from('frames')
          .delete()
          .eq('event_id', eventToDelete.id);
      } catch (frameErr) {
        console.log('Frames cleanup note:', frameErr);
      }

      // 2. Delete event from Supabase 'events' table and inspect returned data
      const { data, error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventToDelete.id)
        .select();

      if (error) {
        console.warn('Gagal menghapus event dari Supabase:', error);
        if (error.code === '42501') {
          // Explicit permission denied by Supabase RLS
          setRlsBlockedEvent(eventToDelete);
          setEventToDelete(null);
        } else if (error.code === '23503') {
          setErrorMsg(
            'Event ini memiliki riwayat transaksi/sesi foto yang tersimpan di Supabase. Database mencegah penghapusan agar data riwayat tidak rusak. Silakan ubah status event menjadi Nonaktif.'
          );
        } else {
          setErrorMsg(`Gagal menghapus event: ${error.message}`);
        }
      } else if (!data || data.length === 0) {
        // PostgREST RLS silently returned 0 rows because DELETE policy is missing!
        console.warn('Supabase RLS memblokir operasi DELETE (0 baris terhapus):', eventToDelete.name);
        setRlsBlockedEvent(eventToDelete);
        setEventToDelete(null);
      } else {
        setSuccessMsg(`Event "${eventToDelete.name}" (${eventToDelete.qr_code}) berhasil dihapus permanen dari Supabase.`);
        setEvents((prev) => prev.filter((item) => item.id !== eventToDelete.id));
        setEventToDelete(null);
      }
    } catch (err: any) {
      console.warn('Exception deleting event:', err);
      setErrorMsg(err.message || 'Gagal menghapus event');
    } finally {
      setIsDeleting(false);
    }
  };

  // Alternative action: Deactivate event instead of delete when RLS blocks deletion
  const handleDeactivateInstead = async (ev: AdminEventItem) => {
    setIsDeactivatingInstead(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({ is_active: false })
        .eq('id', ev.id);

      if (error) throw error;

      setEvents((prev) =>
        prev.map((item) => (item.id === ev.id ? { ...item, is_active: false } : item))
      );
      setSuccessMsg(
        `Event "${ev.name}" berhasil dinonaktifkan. Pengunjung kiosk tidak dapat lagi mengakses event ini.`
      );
      setRlsBlockedEvent(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menonaktifkan event');
    } finally {
      setIsDeactivatingInstead(false);
    }
  };

  // Set event as default public event
  const handleSetAsDefault = async (ev: AdminEventItem) => {
    try {
      const selectedPrice = ev.default_price !== undefined && ev.default_price !== null ? Number(ev.default_price) : 10000;
      const isFree = Boolean(ev.is_free_event || selectedPrice === 0);
      const digitalPrice = isFree ? 0 : (ev.harga_digital !== undefined && ev.harga_digital !== null ? Number(ev.harga_digital) : selectedPrice);
      const printPrice = isFree ? 0 : (ev.harga_print !== undefined && ev.harga_print !== null ? Number(ev.harga_print) : (selectedPrice > 0 ? selectedPrice : 25000));

      localStorage.setItem('photobooth_default_event_id', ev.id);
      try {
        const fullDefaultConfig = {
          id: ev.id,
          nama: ev.name,
          subtitle: (ev as any).description || 'Simpan kenangan indah Anda di booth digital',
          tanggal: (ev as any).date || '',
          lokasi: ev.lokasi || (ev as any).location || 'AIM SPACE Studio',
          hargaPerFoto: selectedPrice,
          isFreeEvent: isFree,
          hargaDigital: digitalPrice,
          hargaPrint: printPrice,
          promoBadge: ev.promo_badge || '',
          promoDescription: ev.promo_description || '',
          tipeEvent: (ev as any).event_type || '',
        };

        localStorage.setItem(
          'photobooth_cached_event_config',
          JSON.stringify(fullDefaultConfig)
        );
        window.dispatchEvent(
          new CustomEvent('photobooth_event_updated', {
            detail: {
              id: ev.id,
              price: selectedPrice,
              name: ev.name,
              lokasi: ev.lokasi || 'AIM SPACE Studio',
              hargaDigital: digitalPrice,
              hargaPrint: printPrice,
              isFreeEvent: isFree,
            },
          })
        );
        window.dispatchEvent(
          new CustomEvent('photobooth-event-config-updated', {
            detail: fullDefaultConfig,
          })
        );
      } catch (e) {
        // ignore
      }
      setDefaultEventId(ev.id);

      // Optimistic update
      setEvents((prev) =>
        prev.map((item) => ({
          ...item,
          is_default: item.id === ev.id,
        }))
      );

      // Update kolom is_default di Supabase
      try {
        await supabase.from('events').update({ is_default: false }).neq('id', ev.id);
        await supabase.from('events').update({ is_default: true }).eq('id', ev.id);
      } catch (dbErr) {
        console.log('Update is_default Supabase catatan:', dbErr);
      }

      setSuccessMsg(`Event "${ev.name}" dijadikan Default Event untuk halaman awal!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengubah default event');
    }
  };

  // Filtered list by search
  const filteredEvents = events.filter((ev) => {
    const q = searchQuery.toLowerCase();
    return (
      ev.name.toLowerCase().includes(q) ||
      (ev.qr_code && ev.qr_code.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            Kelola Events
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Daftar semua acara, kode QR akses kiosk, dan pengaturan harga per sesi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchEvents}
            disabled={isLoading}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors flex items-center gap-1.5 text-xs"
            title="Refresh tabel"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>

          <button
            id="btn-add-new-event"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setCreatedEventLink(null);
            }}
            className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Event Baru</span>
          </button>
        </div>
      </div>

      {/* Alert notifications */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold">Terjadi Kesalahan</p>
            <p className="text-zinc-400 text-[11px] mt-0.5 break-words">{errorMsg}</p>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-zinc-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-zinc-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Highlight Box for newly created event link */}
      {createdEventLink && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 to-zinc-900 border border-amber-500/40 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
            <Sparkles className="w-4 h-4" />
            <span>Link Siap Pakai untuk QR Code Event: &quot;{createdEventLink.name}&quot;</span>
          </div>
          <p className="text-xs text-zinc-300">
            Gunakan tautan berikut untuk membuat QR code di undangan atau banner acara:
          </p>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              readOnly
              value={createdEventLink.link}
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-amber-300 font-mono select-all focus:outline-none"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdEventLink.link);
                setCopiedQrCode('newly-created');
                setTimeout(() => setCopiedQrCode(null), 2500);
              }}
              className="py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedQrCode === 'newly-created' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Form Tambah Event Baru */}
      {showAddForm && (
        <div className="p-5 rounded-2xl bg-[#0f121a] border border-zinc-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              Formulir Tambah Event Baru
            </h2>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Batal
            </button>
          </div>

          <form onSubmit={handleCreateEvent} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Nama Event *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  // Auto-generate QR code slug if empty
                  if (!formQrCode) {
                    const slug = e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, '-')
                      .replace(/[^a-z0-9-]/g, '');
                    setFormQrCode(slug);
                  }
                }}
                placeholder="Contoh: Wedding of Maya & Rian"
                required
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Kode QR (Slug URL) *
              </label>
              <input
                type="text"
                value={formQrCode}
                onChange={(e) => setFormQrCode(e.target.value)}
                placeholder="Contoh: maya-rian-2026"
                required
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Link QR: <code className="text-zinc-400 font-mono">?event={formQrCode || 'kode-qr'}</code>
              </p>
            </div>

            {/* Pengaturan Harga & Paket */}
            <div className="sm:col-span-2 p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-amber-400" />
                  Tarif Paket & Promo Khusus Event Ini
                </span>
                <label className="flex items-center gap-2 text-xs text-emerald-400 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsFreeEvent}
                    onChange={(e) => {
                      setFormIsFreeEvent(e.target.checked);
                      if (e.target.checked) setFormDefaultPrice('0');
                    }}
                    className="w-4 h-4 rounded text-emerald-500 bg-zinc-950 border-zinc-700 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Event Gratis (Rp 0)</span>
                </label>
              </div>

              {!formIsFreeEvent ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-cyan-300 mb-1 flex items-center gap-1">
                      <Smartphone className="w-3 h-3" />
                      Harga Paket Digital Softfile (IDR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={formHargaDigital}
                      onChange={(e) => setFormHargaDigital(e.target.value)}
                      placeholder="10000"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-amber-300 mb-1 flex items-center gap-1">
                      <Printer className="w-3 h-3" />
                      Harga Paket Cetak Fisik + HD (IDR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={formHargaPrint}
                      onChange={(e) => {
                        setFormHargaPrint(e.target.value);
                        setFormDefaultPrice(e.target.value);
                      }}
                      placeholder="25000"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
                  <Gift className="w-4 h-4 shrink-0" />
                  <span>Mode Gratis Aktif: Tamu dapat langsung foto dan unduh/cetak tanpa ditagih pembayaran kasir.</span>
                </div>
              )}

              {/* Promo Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-zinc-800/80">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3 text-amber-400" />
                    Badge Promo (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formPromoBadge}
                    onChange={(e) => setFormPromoBadge(e.target.value)}
                    placeholder="Contoh: Promo Hajatan / Grand Opening"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    Deskripsi Promo (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formPromoDescription}
                    onChange={(e) => setFormPromoDescription(e.target.value)}
                    placeholder="Contoh: Dapatkan gratis softfile HD untuk setiap sesi!"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Lokasi / Venue Acara
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formLokasi}
                  onChange={(e) => setFormLokasi(e.target.value)}
                  placeholder="Contoh: AIM SPACE Studio / Grand Ballroom Lt. 2"
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
                <MapPin className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Ditampilkan di layar utama kiosk sebagai tempat/venue event photobooth.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-zinc-900 border-zinc-700 focus:ring-amber-500 cursor-pointer"
                />
                <span>Langsung aktifkan event ini</span>
              </label>
            </div>

            {/* Checklist: Jadikan Default Event Halaman Awal */}
            <div className="sm:col-span-2 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
              <label className="flex items-center gap-2.5 text-xs text-zinc-100 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  id="checkbox-is-default-event"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 bg-zinc-900 border-zinc-700 focus:ring-amber-500 cursor-pointer"
                />
                <span className="flex items-center gap-1.5 text-amber-300">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  Jadikan Default Event (Halaman Utama / Public Kiosk)
                </span>
              </label>
              <p className="text-[11px] text-zinc-400 pl-6.5">
                Event ini akan otomatis langsung dimuat saat pengunjung membuka halaman utama photobooth tanpa kode QR.
              </p>
            </div>

            <div className="sm:col-span-2 pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="py-2 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Event</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama event atau kode QR..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="text-xs text-zinc-400 self-end sm:self-center font-mono">
          Total: <span className="text-white font-bold">{events.length}</span> event
        </div>
      </div>

      {/* Events Table */}
      <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-[#0d1017]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-900/90 text-zinc-400 uppercase font-mono text-[11px] border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Nama Event</th>
                <th className="py-3 px-4">Kode QR & Link</th>
                <th className="py-3 px-4">Tarif Paket & Promo</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Tanggal Dibuat</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500 font-mono">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                    Memuat data events dari Supabase...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    <p className="font-semibold text-zinc-400">Belum ada event ditemukan</p>
                    <p className="text-[11px] text-zinc-600 mt-1">
                      Klik &quot;Tambah Event Baru&quot; untuk membuat acara pertama.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => {
                  const link = getEventLink(ev.qr_code);
                  const isCopied = copiedQrCode === ev.qr_code;
                  const isDefault = Boolean(ev.is_default || ev.id === defaultEventId);
                  const formattedPrice = new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    maximumFractionDigits: 0,
                  }).format(ev.default_price ?? 10000);

                  const formattedDate = ev.created_at
                    ? new Date(ev.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '-';

                  return (
                    <tr
                      key={ev.id}
                      className={`hover:bg-zinc-900/50 transition-colors group ${
                        isDefault ? 'bg-amber-500/5 border-l-2 border-l-amber-500' : ''
                      }`}
                    >
                      {/* Name & ID */}
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{ev.name}</span>
                          {isDefault && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                              <Star className="w-2.5 h-2.5 fill-amber-400" />
                              <span>Default Kiosk</span>
                            </span>
                          )}
                        </div>
                        {ev.lokasi && (
                          <div className="flex items-center gap-1 text-[11px] text-zinc-400 mt-0.5">
                            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{ev.lokasi}</span>
                          </div>
                        )}
                        <span className="text-[10px] font-mono text-zinc-500 block truncate max-w-[180px] mt-0.5">
                          ID: {ev.id}
                        </span>
                      </td>

                      {/* QR Code & Copy */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-amber-400 font-mono">
                            {ev.qr_code}
                          </code>
                          <button
                            onClick={() => handleCopyLink(ev.qr_code)}
                            className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
                            title="Copy link lengkap untuk QR code"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-mono block mt-0.5 truncate max-w-[200px]">
                          {link}
                        </span>
                      </td>

                      {/* Tarif Paket & Promo */}
                      <td className="py-3.5 px-4 text-xs">
                        {ev.is_free_event || ev.default_price === 0 ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                              <Gift className="w-3 h-3" />
                              <span>Gratis (Rp 0)</span>
                            </span>
                            {ev.promo_badge && (
                              <div className="text-[10px] text-amber-300 flex items-center gap-1 font-sans">
                                <Tag className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                <span className="truncate max-w-[130px]">{ev.promo_badge}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1 text-[11px] font-mono">
                            <div className="flex items-center gap-1.5 text-cyan-300">
                              <Smartphone className="w-3 h-3 shrink-0 text-cyan-400" />
                              <span>Digital: Rp {(ev.harga_digital ?? 10000).toLocaleString('id-ID')}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-amber-300">
                              <Printer className="w-3 h-3 shrink-0 text-amber-400" />
                              <span>Cetak: Rp {(ev.harga_print ?? ev.default_price ?? 25000).toLocaleString('id-ID')}</span>
                            </div>
                            {ev.promo_badge && (
                              <div className="text-[10px] text-zinc-300 flex items-center gap-1 font-sans font-medium bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                <Tag className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                <span className="truncate max-w-[120px]">{ev.promo_badge}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Active Toggle Switch */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(ev)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                            ev.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                          }`}
                          title="Klik untuk aktifkan / nonaktifkan event"
                        >
                          <Power className="w-3 h-3" />
                          <span>{ev.is_active ? 'Aktif' : 'Nonaktif'}</span>
                        </button>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          {formattedDate}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Tombol Jadikan Default Event */}
                          <button
                            onClick={() => handleSetAsDefault(ev)}
                            className={`p-1.5 rounded-lg border text-xs transition-all cursor-pointer ${
                              isDefault
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 border-zinc-800'
                            }`}
                            title={
                              isDefault
                                ? 'Event ini saat ini adalah Default Event halaman awal'
                                : 'Klik untuk jadikan event ini Default Event halaman awal'
                            }
                          >
                            <Star className={`w-3.5 h-3.5 ${isDefault ? 'fill-amber-400' : ''}`} />
                          </button>

                          {onSelectEventForFrames && (
                            <button
                              onClick={() => onSelectEventForFrames(ev.id)}
                              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-amber-400 border border-zinc-800 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                              title="Kelola frame untuk event ini"
                            >
                              <span>Frames</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}

                          {/* Tombol Edit Event & Tarif */}
                          <button
                            onClick={() => {
                              setEditingEvent(ev);
                              setEditName(ev.name);
                              setEditQrCode(ev.qr_code);
                              setEditLokasi(ev.lokasi || '');
                              setEditDefaultPrice(String(ev.default_price ?? 10000));
                              setEditIsFreeEvent(Boolean(ev.is_free_event || ev.default_price === 0));
                              setEditHargaDigital(String(ev.harga_digital ?? ev.default_price ?? 10000));
                              setEditHargaPrint(String(ev.harga_print ?? ev.default_price ?? 25000));
                              setEditPromoBadge(ev.promo_badge || '');
                              setEditPromoDescription(ev.promo_description || '');
                              setEditIsActive(ev.is_active ?? true);
                            }}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
                            title="Edit Event, Tarif Paket & Promo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                            title="Buka kiosk event di tab baru"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          <button
                            onClick={() => setEventToDelete(ev)}
                            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-900 transition-colors cursor-pointer"
                            title="Hapus event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="w-full max-w-lg bg-[#0f121a] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[82vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header (Fixed at top) */}
            <div className="px-4 sm:px-5 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-[#0f121a]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-400" />
                <span>Edit Event, Tarif Paket & Promo</span>
              </h3>
              <button
                onClick={() => setEditingEvent(null)}
                disabled={isSavingEdit}
                className="text-zinc-500 hover:text-zinc-300 disabled:opacity-50 cursor-pointer p-1 rounded-lg hover:bg-zinc-800/60 transition-colors"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              id="edit-event-form"
              onSubmit={handleSaveEditEvent}
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 text-xs overscroll-contain"
            >
              {/* Row 1: Nama Event & Kode QR Slug berdampingan agar lebih pendek */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Nama Event *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Kode QR / Slug URL *</label>
                  <input
                    type="text"
                    value={editQrCode}
                    onChange={(e) => setEditQrCode(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Pengaturan Harga, Paket & Promo */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-amber-400" />
                    Tarif Paket & Promo Khusus Event
                  </span>
                  <label className="flex items-center gap-2 text-xs text-emerald-400 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsFreeEvent}
                      onChange={(e) => {
                        setEditIsFreeEvent(e.target.checked);
                        if (e.target.checked) setEditDefaultPrice('0');
                      }}
                      className="w-4 h-4 rounded text-emerald-500 bg-zinc-950 border-zinc-700 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>Event Gratis (Rp 0)</span>
                  </label>
                </div>

                {!editIsFreeEvent ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                    <div>
                      <label className="block text-[11px] font-medium text-cyan-300 mb-1 flex items-center gap-1">
                        <Smartphone className="w-3 h-3" />
                        Harga Paket Digital Softfile (IDR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={editHargaDigital}
                        onChange={(e) => setEditHargaDigital(e.target.value)}
                        placeholder="10000"
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-amber-300 mb-1 flex items-center gap-1">
                        <Printer className="w-3 h-3" />
                        Harga Paket Cetak Fisik + HD (IDR)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={editHargaPrint}
                        onChange={(e) => {
                          setEditHargaPrint(e.target.value);
                          setEditDefaultPrice(e.target.value);
                        }}
                        placeholder="25000"
                        className="w-full px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
                    <Gift className="w-4 h-4 shrink-0" />
                    <span>Mode Gratis Aktif: Tamu dapat langsung foto dan unduh/cetak tanpa tagihan kasir.</span>
                  </div>
                )}

                {/* Promo Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-800/80">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-300 mb-1 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-amber-400" />
                      Badge Promo
                    </label>
                    <input
                      type="text"
                      value={editPromoBadge}
                      onChange={(e) => setEditPromoBadge(e.target.value)}
                      placeholder="Contoh: Promo Spesial Event"
                      className="w-full px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                      Deskripsi Promo
                    </label>
                    <input
                      type="text"
                      value={editPromoDescription}
                      onChange={(e) => setEditPromoDescription(e.target.value)}
                      placeholder="Contoh: Gratis cetak frame ke-2!"
                      className="w-full px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">
                  Lokasi / Tempat Acara (Venue)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editLokasi}
                    onChange={(e) => setEditLokasi(e.target.value)}
                    placeholder="Contoh: AIM SPACE Studio / Ballroom Lt. 2"
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                  <MapPin className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  Lokasi ini akan langsung tampil di kolom &quot;Lokasi&quot; pada halaman utama publik / kiosk.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-zinc-900 border-zinc-700 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>Event aktif (dapat diakses tamu)</span>
                </label>
              </div>
            </form>

            {/* Modal Footer (Pinned/Fixed at bottom) */}
            <div className="px-4 sm:px-5 py-3 border-t border-zinc-800 flex justify-end gap-2 bg-[#0f121a] shrink-0">
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                disabled={isSavingEdit}
                className="py-2 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                form="edit-event-form"
                disabled={isSavingEdit}
                className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSavingEdit ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan Perubahan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (In-App, safe for iframes) */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="w-full max-w-sm bg-[#0f121a] border border-rose-500/30 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Konfirmasi Hapus Event</span>
              </h3>
              <button
                onClick={() => !isDeleting && setEventToDelete(null)}
                disabled={isDeleting}
                className="text-zinc-500 hover:text-zinc-300 disabled:opacity-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-white text-sm truncate">{eventToDelete.name}</p>
                <code className="text-[11px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-amber-400 font-mono shrink-0">
                  {eventToDelete.qr_code}
                </code>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono truncate">
                ID: {eventToDelete.id}
              </p>
              {typeof eventToDelete.default_price === 'number' && (
                <p className="text-[11px] text-zinc-400">
                  Harga Per Sesi: <span className="text-zinc-200 font-mono font-medium">Rp {eventToDelete.default_price.toLocaleString('id-ID')}</span>
                </p>
              )}
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Apakah Anda yakin ingin menghapus event ini? Menghapus event juga akan menghapus konfigurasi frame yang terhubung dengan event ini.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setEventToDelete(null)}
                className="py-2 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Event</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Panduan Supabase RLS Saat Penghapusan Diblokir */}
      {rlsBlockedEvent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="w-full max-w-lg bg-zinc-900 border border-amber-500/40 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
                    Row Level Security (RLS) pada tabel events membatasi izin DELETE
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRlsBlockedEvent(null)}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto">
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                <p className="text-xs text-zinc-300">
                  Event yang ingin dihapus:{' '}
                  <span className="font-bold text-white">{rlsBlockedEvent.name}</span>{' '}
                  <span className="font-mono text-amber-400 text-[11px]">({rlsBlockedEvent.qr_code})</span>
                </p>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Tabel <code className="text-zinc-200 font-mono">events</code> di Supabase mengaktifkan RLS dan belum memiliki hak izin operasi <code className="text-amber-400 font-mono">DELETE</code> untuk public/anon. Oleh karena itu, Supabase menolak penghapusan baris dan saat Anda merefresh halaman, data tersebut ditarik kembali.
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
                      const sql = `ALTER TABLE events DISABLE ROW LEVEL SECURITY;\nALTER TABLE frames DISABLE ROW LEVEL SECURITY;`;
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
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE frames DISABLE ROW LEVEL SECURITY;`}
                </pre>

                <ol className="text-[11px] text-zinc-400 list-decimal list-inside space-y-0.5 pt-1">
                  <li>Buka dashboard Supabase project Anda</li>
                  <li>Pilih tab <strong>SQL Editor</strong> di sidebar kiri</li>
                  <li>Tempel (Paste) perintah di atas lalu klik tombol <strong>Run</strong></li>
                  <li>Setelah itu, event akan langsung terhapus permanen saat tombol hapus diklik</li>
                </ol>
              </div>
            </div>

            {/* Tindakan Alternatif Instan */}
            <div className="p-4 sm:p-5 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 bg-zinc-900">
              <button
                type="button"
                disabled={isDeactivatingInstead}
                onClick={() => handleDeactivateInstead(rlsBlockedEvent)}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Status event akan diubah ke nonaktif sehingga tidak muncul di kiosk"
              >
                {isDeactivatingInstead ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Power className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Nonaktifkan Saja Event Ini</span>
              </button>

              <button
                type="button"
                onClick={() => setRlsBlockedEvent(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
