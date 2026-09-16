import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Image as ImageIcon,
  CreditCard,
  LogOut,
  ArrowLeft,
  ShieldCheck,
  Menu,
  X,
  ExternalLink,
  Sparkles,
  Settings,
} from 'lucide-react';
import { AdminGate } from './AdminGate';
import { AdminEvents } from './AdminEvents';
import { AdminFrames } from './AdminFrames';
import { AdminLayouts } from './AdminLayouts';
import { AdminOrders } from './AdminOrders';
import { AdminSetup } from './AdminSetup';
import { AdminPaymentFlip } from './AdminPaymentFlip';
import { LayoutGrid, Wallet } from 'lucide-react';

export type AdminTab = 'events' | 'frames' | 'layouts' | 'orders' | 'setup' | 'payment';

interface AdminPortalProps {
  onBackToKiosk: () => void;
  onOpenKioskWithEvent?: (qrCode: string) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  onBackToKiosk,
  onOpenKioskWithEvent,
}) => {
  // Authentication status from sessionStorage
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_authenticated') === 'true';
  });

  // Active admin tab determined from URL path or state
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/admin/payment') || path.includes('/admin/flip')) return 'payment';
    if (path.includes('/admin/layouts')) return 'layouts';
    if (path.includes('/admin/frames')) return 'frames';
    if (path.includes('/admin/orders')) return 'orders';
    if (path.includes('/admin/setup')) return 'setup';
    return 'events';
  });

  // When clicking an event to jump directly to its frames
  const [frameEventFilter, setFrameEventFilter] = useState<string | null>(null);

  // Mobile menu drawer toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sync route in browser address bar without full page reload
  const navigateToTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    try {
      window.history.pushState({}, '', `/admin/${tab}`);
    } catch (e) {
      // Ignore if pushState fails in restricted sandbox
    }
  };

  // Handle browser popstate
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('/admin/layouts')) setActiveTab('layouts');
      else if (path.includes('/admin/frames')) setActiveTab('frames');
      else if (path.includes('/admin/orders')) setActiveTab('orders');
      else if (path.includes('/admin/setup')) setActiveTab('setup');
      else if (path.includes('/admin')) setActiveTab('events');
      else onBackToKiosk();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onBackToKiosk]);

  // Logout handler
  const handleLogout = () => {
    sessionStorage.removeItem('admin_authenticated');
    setIsAuthenticated(false);
  };

  // If not authenticated, render the password gate
  if (!isAuthenticated) {
    return (
      <AdminGate
        onAuthenticated={() => setIsAuthenticated(true)}
        onBackToKiosk={onBackToKiosk}
      />
    );
  }

  const handleSelectEventForFrames = (eventId: string) => {
    setFrameEventFilter(eventId);
    navigateToTab('frames');
  };

  return (
    <div className="min-h-screen bg-[#07080d] text-zinc-100 flex flex-col md:flex-row font-sans selection:bg-amber-500 selection:text-zinc-950">
      {/* Sidebar Navigation (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0a0c13] border-r border-zinc-800/80 p-4 shrink-0">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-zinc-800/60">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shadow-inner">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight leading-tight">
              Admin Kiosk
            </h2>
            <p className="text-[11px] text-zinc-500 font-mono">Photobooth Manager</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1.5 flex-1">
          <button
            onClick={() => navigateToTab('events')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'events'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Kelola Events</span>
          </button>

          <button
            onClick={() => navigateToTab('layouts')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'layouts'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Kelola Layout</span>
          </button>

          <button
            onClick={() => navigateToTab('frames')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'frames'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Kelola Frames</span>
          </button>

          <button
            onClick={() => navigateToTab('orders')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Lihat Transaksi</span>
          </button>

          <button
            onClick={() => navigateToTab('payment')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'payment'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Integrasi Flip</span>
          </button>

          <button
            onClick={() => navigateToTab('setup')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'setup'
                ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Setup Password</span>
          </button>
        </nav>

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-zinc-800/80 space-y-2">
          <button
            onClick={onBackToKiosk}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>Kembali ke App</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Top Mobile Bar */}
      <header className="md:hidden bg-[#0a0c13] border-b border-zinc-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-white">Admin Kiosk</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBackToKiosk}
            className="p-2 rounded-lg bg-zinc-900 text-zinc-300 text-xs flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg bg-zinc-900 text-zinc-300"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#0c0f18] border-b border-zinc-800 p-4 space-y-2 z-40">
          <button
            onClick={() => navigateToTab('events')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
              activeTab === 'events' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Kelola Events</span>
          </button>

          <button
            onClick={() => navigateToTab('layouts')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
              activeTab === 'layouts' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Kelola Layout</span>
          </button>

          <button
            onClick={() => navigateToTab('frames')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
              activeTab === 'frames' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Kelola Frames</span>
          </button>

          <button
            onClick={() => navigateToTab('orders')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
              activeTab === 'orders' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Lihat Transaksi</span>
          </button>

          <button
            onClick={() => navigateToTab('payment')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
              activeTab === 'payment' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Integrasi Flip</span>
          </button>

          <button
            onClick={() => navigateToTab('setup')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
              activeTab === 'setup' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Setup Password</span>
          </button>

          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
            <button
              onClick={onBackToKiosk}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Ke Kiosk</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
        {activeTab === 'events' && (
          <AdminEvents
            onSelectEventForFrames={handleSelectEventForFrames}
            onOpenKioskEvent={onOpenKioskWithEvent}
          />
        )}

        {activeTab === 'layouts' && <AdminLayouts />}

        {activeTab === 'frames' && (
          <AdminFrames initialSelectedEventId={frameEventFilter} />
        )}

        {activeTab === 'orders' && <AdminOrders />}

        {activeTab === 'payment' && <AdminPaymentFlip />}

        {activeTab === 'setup' && <AdminSetup />}
      </main>
    </div>
  );
};
