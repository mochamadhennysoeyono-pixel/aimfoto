import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard,
  RefreshCw,
  Search,
  Filter,
  Download,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Image as ImageIcon,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Loader2,
  Check,
  X,
  Copy,
  Printer,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { AdminEventItem } from './AdminEvents';
import {
  deleteSessionPhotoFromStorage,
  deleteAllSessionPhotosFromStorage,
} from '../services/storageService';
import { openPrintTab, downloadPhotoFile } from './printUtils';
import { sendToPrinter } from '../services/printerService';

export interface AdminOrderItem {
  id: string;
  session_id: string;
  amount: number;
  payment_status: string;
  payment_method?: string;
  paid_at?: string;
  created_at: string;
  // Joined fields
  eventName?: string;
  eventId?: string;
  finalUrl?: string | null;
  previewUrl?: string | null;
}

export const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [events, setEvents] = useState<AdminEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Deletion States
  const [orderToDelete, setOrderToDelete] = useState<AdminOrderItem | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // Print & Download States
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | null>(null);
  const [activePrintNotice, setActivePrintNotice] = useState<{
    orderShort: string;
    blobUrl: string;
    wasBlocked: boolean;
  } | null>(null);

  const handleCopyOrderUrl = async (orderId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedOrderId(orderId);
      setTimeout(() => setCopiedOrderId(null), 2000);
    } catch (e) {
      console.warn('Gagal salin URL:', e);
    }
  };

  const handleDirectPrint = async (ord: AdminOrderItem) => {
    const url = ord.finalUrl || ord.previewUrl;
    if (!url) return;
    setPrintingOrderId(ord.id);
    const orderShort = ord.id.slice(0, 8).toUpperCase();
    try {
      // Rekam di printer service jika terpasang spooler
      sendToPrinter(ord.id, url).catch(() => {});

      const result = openPrintTab(url, {
        title: `Photobooth - ${ord.eventName || 'Order'} #${orderShort} (10x15cm 4R)`,
        orderShort,
      });

      setActivePrintNotice({
        orderShort,
        blobUrl: result.blobUrl,
        wasBlocked: !result.success,
      });

      if (result.success) {
        setSuccessNotice(`Tab cetak 10x15cm (4R) dibuka untuk order #${orderShort}. Dialog cetak browser akan otomatis muncul di tab tersebut.`);
        setTimeout(() => setSuccessNotice(null), 5000);
      }
    } catch (err) {
      console.warn('Gagal membuka dialog cetak:', err);
    } finally {
      setPrintingOrderId(null);
    }
  };

  const handleDirectDownload = async (ord: AdminOrderItem) => {
    const url = ord.finalUrl || ord.previewUrl;
    if (!url) return;
    setDownloadingOrderId(ord.id);
    const orderShort = ord.id.slice(0, 8).toUpperCase();
    const eventSlug = ord.eventName?.replace(/[^a-zA-Z0-9]/g, '_') || 'event';
    const filename = `photobooth-${eventSlug}-${orderShort}.jpg`;
    try {
      await downloadPhotoFile(url, filename);
      setSuccessNotice(`Foto order #${orderShort} berhasil diunduh.`);
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err) {
      console.warn('Gagal unduh foto:', err);
    } finally {
      setDownloadingOrderId(null);
    }
  };

  // Filters
  const [filterEventId, setFilterEventId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch orders, joined with sessions and events
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch events
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .order('name');
      const eventsList = (eventsData as AdminEventItem[]) || [];
      setEvents(eventsList);

      const eventMap = new Map<string, string>();
      eventsList.forEach((ev) => eventMap.set(ev.id, ev.name));

      // 2. Fetch sessions to map session_id -> event_id & final_url
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('id, event_id, final_url, preview_url');
      const sessionMap = new Map<string, { eventId: string; finalUrl?: string | null; previewUrl?: string | null }>();
      if (sessionsData) {
        sessionsData.forEach((s: any) => {
          sessionMap.set(s.id, {
            eventId: s.event_id,
            finalUrl: s.final_url,
            previewUrl: s.preview_url,
          });
        });
      }

      // 3. Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) {
        throw new Error(ordersError.message);
      }

      if (ordersData) {
        const enriched: AdminOrderItem[] = ordersData.map((ord: any) => {
          const sessionInfo = sessionMap.get(ord.session_id);
          const eventId = sessionInfo?.eventId || '';
          const eventName = eventMap.get(eventId) || (eventId ? `Event (${eventId.slice(0, 8)})` : 'Event Photobooth');
          return {
            id: ord.id,
            session_id: ord.session_id,
            amount: Number(ord.amount) || 0,
            payment_status: ord.payment_status || 'pending',
            payment_method: ord.payment_method || 'QRIS',
            paid_at: ord.paid_at,
            created_at: ord.created_at || ord.paid_at || new Date().toISOString(),
            eventId,
            eventName,
            finalUrl: sessionInfo?.finalUrl,
            previewUrl: sessionInfo?.previewUrl,
          };
        });

        setOrders(enriched);
      }
    } catch (err: any) {
      console.warn('Error fetching orders:', err);
      setErrorMsg(err.message || 'Gagal memuat data transaksi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered orders calculation
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Event filter
      if (filterEventId !== 'all' && ord.eventId !== filterEventId) {
        return false;
      }

      // Status filter
      if (filterStatus !== 'all' && ord.payment_status.toLowerCase() !== filterStatus.toLowerCase()) {
        return false;
      }

      // Date Range filter
      if (dateRange !== 'all') {
        const orderDate = new Date(ord.created_at);
        const now = new Date();

        if (dateRange === 'today') {
          const isToday =
            orderDate.getDate() === now.getDate() &&
            orderDate.getMonth() === now.getMonth() &&
            orderDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (dateRange === '7days') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          if (orderDate < sevenDaysAgo) return false;
        } else if (dateRange === '30days') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          if (orderDate < thirtyDaysAgo) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          ord.id.toLowerCase().includes(q) ||
          ord.session_id.toLowerCase().includes(q) ||
          (ord.eventName && ord.eventName.toLowerCase().includes(q)) ||
          (ord.payment_method && ord.payment_method.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [orders, filterEventId, filterStatus, dateRange, searchQuery]);

  // Financial summary calculations
  const totalRevenue = useMemo(() => {
    return filteredOrders
      .filter((o) => o.payment_status === 'success' || o.payment_status === 'settlement')
      .reduce((sum, o) => sum + o.amount, 0);
  }, [filteredOrders]);

  const totalSuccessCount = useMemo(() => {
    return filteredOrders.filter(
      (o) => o.payment_status === 'success' || o.payment_status === 'settlement'
    ).length;
  }, [filteredOrders]);

  const totalPendingCount = useMemo(() => {
    return filteredOrders.filter((o) => o.payment_status === 'pending').length;
  }, [filteredOrders]);

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredOrders.length === 0) return;

    const headers = ['Order ID', 'Tanggal', 'Nama Event', 'Event ID', 'Metode', 'Jumlah Bayar', 'Status'];
    const rows = filteredOrders.map((o) => [
      `"${o.id}"`,
      `"${new Date(o.created_at).toLocaleString('id-ID')}"`,
      `"${o.eventName || '-'}"`,
      `"${o.eventId || '-'}"`,
      `"${o.payment_method || 'QRIS'}"`,
      o.amount,
      `"${o.payment_status}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `photobooth_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Hapus Single Transaksi (termasuk session & storage)
  const handleConfirmDeleteSingle = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      // 1. Hapus dari tabel 'orders' di Supabase
      const { error: ordErr } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderToDelete.id);

      if (ordErr) {
        throw new Error(`Gagal menghapus order di database: ${ordErr.message}`);
      }

      // 2. Hapus dari tabel 'sessions' di Supabase
      if (orderToDelete.session_id) {
        const { error: sessErr } = await supabase
          .from('sessions')
          .delete()
          .eq('id', orderToDelete.session_id);

        if (sessErr) {
          console.warn('Catatan hapus session:', sessErr.message);
        }
      }

      // 3. Hapus foto dari Supabase Storage (Bucket 'photos')
      await deleteSessionPhotoFromStorage(orderToDelete.session_id, orderToDelete.finalUrl);

      // 4. Perbarui state lokal
      setOrders((prev) => prev.filter((o) => o.id !== orderToDelete.id));
      const deletedId = orderToDelete.id.slice(0, 8);
      setOrderToDelete(null);
      setSuccessNotice(`Transaksi #${deletedId}, sesi, dan foto storage berhasil dihapus.`);
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err: any) {
      console.error('Error saat hapus transaksi:', err);
      setDeleteError(err?.message || 'Terjadi kesalahan saat menghapus transaksi.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 2. Hapus Semua Transaksi (termasuk sessions & storage)
  const handleConfirmDeleteAll = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const orderIds = orders.map((o) => o.id);
      const sessionIds = Array.from(new Set(orders.map((o) => o.session_id).filter(Boolean)));

      // 1. Hapus semua data di tabel orders
      if (orderIds.length > 0) {
        const { error: ordErr } = await supabase
          .from('orders')
          .delete()
          .in('id', orderIds);

        if (ordErr) {
          throw new Error(`Gagal menghapus orders di database: ${ordErr.message}`);
        }
      }

      // 2. Hapus sesi terkait di tabel sessions
      if (sessionIds.length > 0) {
        const { error: sessErr } = await supabase
          .from('sessions')
          .delete()
          .in('id', sessionIds);

        if (sessErr) {
          console.warn('Catatan hapus sessions:', sessErr.message);
        }
      }

      // 3. Bersihkan seluruh file foto di Supabase Storage (Bucket 'photos' folder sessions)
      await deleteAllSessionPhotosFromStorage();

      // 4. Perbarui state lokal
      setOrders([]);
      setShowDeleteAllModal(false);
      setSuccessNotice(`Semua transaksi (${orderIds.length}), sesi, dan foto di Supabase Storage berhasil dibersihkan.`);
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err: any) {
      console.error('Error saat hapus semua transaksi:', err);
      setDeleteError(err?.message || 'Terjadi kesalahan saat menghapus seluruh transaksi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-400" />
            Laporan Transaksi & Pendapatan
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Daftar pesanan cetak dan pembayaran foto photobooth dari seluruh kiosk.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Hapus Semua Button */}
          <button
            onClick={() => setShowDeleteAllModal(true)}
            disabled={orders.length === 0 || isLoading || isDeleting}
            className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-colors cursor-pointer"
            title="Hapus semua data transaksi, session, dan foto di storage"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hapus Semua Transaksi</span>
            <span className="sm:hidden">Hapus Semua</span>
          </button>

          <button
            onClick={fetchData}
            disabled={isLoading || isDeleting}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors flex items-center gap-1.5 text-xs"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            <span className="hidden sm:inline">Segarkan</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={filteredOrders.length === 0}
            className="py-2 px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-colors cursor-pointer"
            title="Download file CSV untuk Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Success Notification alert */}
      {successNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <p className="flex-1">{successNotice}</p>
        </div>
      )}

      {/* Active Print Notice Banner (dengan tombol langsung ke lembar cetak tab baru) */}
      {activePrintNotice && (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200 shadow-xl ${
            activePrintNotice.wasBlocked
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
              : 'bg-zinc-900/90 border-amber-500/30 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-2">
                <span>
                  {activePrintNotice.wasBlocked
                    ? `⚠️ Pop-up Browser Terblokir: Order #${activePrintNotice.orderShort}`
                    : `🖨️ Lembar Cetak 10x15cm (4R) Order #${activePrintNotice.orderShort}`}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono">
                  Ready to Print
                </span>
              </p>
              <p className="text-[11px] text-zinc-300 mt-0.5">
                {activePrintNotice.wasBlocked
                  ? 'Karena preview berjalan di dalam iframe, silakan klik tombol di samping untuk membuka lembar cetak di tab baru:'
                  : 'Jika dialog print browser belum otomatis muncul di tab Anda, klik tombol ini:'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <a
              href={activePrintNotice.blobUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Buka Halaman Cetak 10x15cm ↗</span>
            </a>
            <button
              onClick={() => setActivePrintNotice(null)}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Tutup pemberitahuan"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <p className="flex-1">{errorMsg}</p>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Revenue */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121622] to-[#0c0f17] border border-amber-500/25 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-zinc-400">Total Pendapatan (Sukses)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {formatRupiah(totalRevenue)}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            {filterEventId === 'all' ? 'Keseluruhan Event' : `Khusus event terpilih`}
          </p>
        </div>

        {/* Total Transactions Success */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121622] to-[#0c0f17] border border-emerald-500/25 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-zinc-400">Transaksi Berhasil</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tracking-tight">
            {totalSuccessCount} <span className="text-sm font-normal text-zinc-400">foto</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            Status: &apos;success&apos; / settlement
          </p>
        </div>

        {/* Pending Orders */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121622] to-[#0c0f17] border border-zinc-800 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold text-zinc-400">Transaksi Pending</span>
            <div className="w-8 h-8 rounded-xl bg-zinc-800 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-400 tracking-tight">
            {totalPendingCount} <span className="text-sm font-normal text-zinc-400">order</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">
            Menunggu pembayaran via QRIS/VA
          </p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Event Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              Event
            </label>
            <select
              value={filterEventId}
              onChange={(e) => setFilterEventId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">Semua Event ({events.length})</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              Status Pembayaran
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">Semua Status</option>
              <option value="success">Sukses (success)</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              Rentang Waktu
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">Semua Waktu</option>
              <option value="today">Hari Ini</option>
              <option value="7days">7 Hari Terakhir</option>
              <option value="30days">30 Hari Terakhir</option>
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              Pencarian
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ID Order / Metode..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-zinc-800 overflow-hidden bg-[#0d1017]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-900/90 text-zinc-400 uppercase font-mono text-[11px] border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Tanggal & Waktu</th>
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4">ID Transaksi</th>
                <th className="py-3 px-4">Metode</th>
                <th className="py-3 px-4 font-mono">Jumlah Bayar</th>
                <th className="py-3 px-4 text-center">Foto Cloud</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center min-w-[210px]">Aksi & Cetak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500 font-mono">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                    Memuat data transaksi dari Supabase...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    <p className="font-semibold text-zinc-400">Belum ada transaksi yang sesuai filter</p>
                    <p className="text-[11px] text-zinc-600 mt-1">
                      Transaksi baru dari checkout kiosk akan otomatis muncul di sini.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const isSuccess =
                    ord.payment_status === 'success' || ord.payment_status === 'settlement';
                  const dateObj = new Date(ord.created_at);
                  const formattedDate = dateObj.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                  const formattedTime = dateObj.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={ord.id} className="hover:bg-zinc-900/50 transition-colors">
                      {/* Date & Time */}
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-300">
                        <span className="block font-semibold text-white">{formattedDate}</span>
                        <span className="text-zinc-500 text-[10px]">{formattedTime} WIB</span>
                      </td>

                      {/* Event Name */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white block">
                          {ord.eventName}
                        </span>
                        {ord.eventId && (
                          <span className="text-[10px] font-mono text-zinc-500">
                            ID: {ord.eventId.slice(0, 8)}
                          </span>
                        )}
                      </td>

                      {/* Order ID */}
                      <td className="py-3 px-4 font-mono text-zinc-400 text-[11px]">
                        <span className="block text-zinc-300 truncate max-w-[140px]" title={ord.id}>
                          {ord.id}
                        </span>
                        <span className="text-[10px] text-zinc-600 block truncate max-w-[140px]" title={ord.session_id}>
                          sesi: {ord.session_id.slice(0, 8)}...
                        </span>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300">
                          {ord.payment_method || 'QRIS'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 font-mono font-semibold text-white text-xs">
                        {formatRupiah(ord.amount)}
                      </td>

                      {/* Cloud Photo Link */}
                      <td className="py-3 px-4 text-center">
                        {ord.finalUrl ? (
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <a
                              href={ord.finalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 hover:bg-sky-500/25 text-[11px] font-medium transition-colors"
                              title="Buka Foto HD di Supabase Storage"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Foto HD</span>
                              <ExternalLink className="w-3 h-3 opacity-70" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopyOrderUrl(ord.id, ord.finalUrl!)}
                              className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                              title="Salin Link Soft File untuk dikirim ke Tamu via WA"
                            >
                              {copiedOrderId === ord.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : ord.previewUrl ? (
                          <span className="text-[10px] font-mono text-zinc-500">Draft Foto</span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isSuccess
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {isSuccess && <CheckCircle2 className="w-3 h-3" />}
                          {!isSuccess && <Clock className="w-3 h-3" />}
                          <span>{ord.payment_status}</span>
                        </span>
                      </td>

                      {/* Aksi / Print / Download / Hapus */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          {/* Tombol Print Langsung Browser (10x15cm 4R) */}
                          <button
                            type="button"
                            onClick={() => handleDirectPrint(ord)}
                            disabled={(!ord.finalUrl && !ord.previewUrl) || printingOrderId === ord.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 hover:text-amber-300 text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                            title={
                              ord.finalUrl || ord.previewUrl
                                ? 'Cetak langsung ke printer browser (10x15cm / 4R / 1200x1800 borderless)'
                                : 'Foto belum tersedia untuk dicetak'
                            }
                          >
                            {printingOrderId === ord.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Printer className="w-3.5 h-3.5" />
                            )}
                            <span>Print</span>
                          </button>

                          {/* Tombol Download Foto HD */}
                          <button
                            type="button"
                            onClick={() => handleDirectDownload(ord)}
                            disabled={(!ord.finalUrl && !ord.previewUrl) || downloadingOrderId === ord.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-400 hover:text-sky-300 text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                            title={
                              ord.finalUrl || ord.previewUrl
                                ? 'Download file foto (.jpg) asli'
                                : 'Foto belum tersedia untuk diunduh'
                            }
                          >
                            {downloadingOrderId === ord.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span>Unduh</span>
                          </button>

                          {/* Tombol Hapus */}
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setOrderToDelete(ord);
                            }}
                            disabled={isDeleting}
                            className="p-1.5 rounded-xl bg-zinc-900/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/40 transition-colors cursor-pointer disabled:opacity-40"
                            title="Hapus transaksi ini (termasuk session & file storage)"
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

      {/* Modal Hapus Single Transaksi */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Hapus Transaksi?</h3>
                  <p className="text-xs text-zinc-400">Konfirmasi penghapusan data dari Supabase</p>
                </div>
              </div>
              <button
                onClick={() => !isDeleting && setOrderToDelete(null)}
                disabled={isDeleting}
                className="text-zinc-500 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">ID Order:</span>
                <span className="font-mono text-zinc-300 font-semibold">{orderToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">ID Sesi:</span>
                <span className="font-mono text-zinc-400">{orderToDelete.session_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Jumlah Bayar:</span>
                <span className="font-mono font-bold text-white">{formatRupiah(orderToDelete.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Event:</span>
                <span className="text-zinc-300">{orderToDelete.eventName || '-'}</span>
              </div>
              {orderToDelete.finalUrl && (
                <div className="flex justify-between items-center pt-1 border-t border-zinc-800/80">
                  <span className="text-zinc-500">File Storage:</span>
                  <span className="text-sky-400 font-mono text-[11px] flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    sessions/{orderToDelete.session_id.slice(0, 8)}...jpg
                  </span>
                </div>
              )}
            </div>

            <div className="text-xs text-zinc-400 leading-relaxed bg-rose-500/5 border border-rose-500/20 p-3 rounded-xl">
              <span className="font-semibold text-rose-300 block mb-1">Dampak Penghapusan:</span>
              <ul className="list-disc pl-4 space-y-0.5 text-zinc-400 text-[11px]">
                <li>Data order di tabel <code className="text-zinc-300">orders</code> dihapus permanen.</li>
                <li>Data sesi di tabel <code className="text-zinc-300">sessions</code> dihapus.</li>
                <li>File foto HD di bucket <code className="text-zinc-300">photos</code> storage dihapus.</li>
              </ul>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setOrderToDelete(null)}
                disabled={isDeleting}
                className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDeleteSingle}
                disabled={isDeleting}
                className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ya, Hapus Permanen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hapus Semua Transaksi */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/40 shadow-lg shadow-rose-500/10">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Hapus SEMUA Transaksi?</h3>
                  <p className="text-xs text-zinc-400">Peringatan: Tindakan ini bersifat permanen!</p>
                </div>
              </div>
              <button
                onClick={() => !isDeleting && setShowDeleteAllModal(false)}
                disabled={isDeleting}
                className="text-zinc-500 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 grid grid-cols-2 gap-3 text-center">
              <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-500 block">Total Order Dihapus</span>
                <span className="text-xl font-bold font-mono text-rose-400">{orders.length} order</span>
              </div>
              <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                <span className="text-[11px] text-zinc-500 block">Total Nominal</span>
                <span className="text-xl font-bold font-mono text-white">{formatRupiah(totalRevenue)}</span>
              </div>
            </div>

            <div className="text-xs text-zinc-300 leading-relaxed bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl space-y-2">
              <p className="font-semibold text-rose-300">
                Semua data berikut akan dihapus bersih dari Supabase:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-zinc-300 text-[11px]">
                <li>Semua record di tabel <code className="text-rose-200">orders</code>.</li>
                <li>Semua sesi pengguna di tabel <code className="text-rose-200">sessions</code>.</li>
                <li>Seluruh file foto photobooth di folder <code className="text-rose-200">sessions/</code> pada Supabase Storage.</li>
              </ul>
              <p className="text-[11px] text-zinc-400 pt-1">
                Data yang sudah dihapus tidak dapat dipulihkan kembali.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteAllModal(false)}
                disabled={isDeleting}
                className="py-2.5 px-5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDeleteAll}
                disabled={isDeleting}
                className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Membersihkan Semua Data...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Seluruh Data Transaksi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

