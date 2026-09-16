import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Image as ImageIcon,
  CreditCard,
  LogOut,
  ArrowLeft,
  ShieldCheck,
  LayoutGrid,
  Wallet,
  Settings,
} from 'lucide-react';
import { AdminGate } from './AdminGate';
import { AdminEvents } from './AdminEvents';
import { AdminFrames } from './AdminFrames';
import { AdminLayouts } from './AdminLayouts';
import { AdminOrders } from './AdminOrders';
import { AdminSetup } from './AdminSetup';
import { AdminPaymentFlip } from './AdminPaymentFlip';

export type AdminTab = 'events' | 'frames' | 'layouts' | 'orders' | 'setup' | 'payment';

interface NavItem {
  tab: AdminTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { tab: 'events', label: 'Kelola Events', shortLabel: 'Events', icon: Calendar },
  { tab: 'layouts', label: 'Kelola Layout', shortLabel: 'Layout', icon: LayoutGrid },
  { tab: 'frames', label: 'Kelola Frames', shortLabel: 'Frames', icon: ImageIcon },
  { tab: 'orders', label: 'Lihat Transaksi', shortLabel: 'Transaksi', icon: CreditCard },
  { tab: 'payment', label: 'Integrasi Flip', shortLabel: 'Flip', icon: Wallet },
  { tab: 'setup', label: 'Setup Password', shortLabel: 'Sandi', icon: Settings },
];

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

  // Sync route in browser address bar without full page reload
  const navigateToTab = (tab: AdminTab) => {
    setActiveTab(tab);
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
      else if (path.includes('/admin/payment') || path.includes('/admin/flip')) setActiveTab('payment');
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

  const currentTabMeta = navItems.find((n) => n.tab === activeTab);

  return (
    <div className="min-h-screen bg-[#07080d] text-zinc-100 flex flex-col md:flex-row font-sans selection:bg-amber-500 selection:text-zinc-950">
      {/* Sidebar Navigation (Desktop only: md:flex & sticky) */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0a0c13] border-r border-zinc-800/80 p-4 shrink-0 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
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
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            const Icon = item.icon;
            return (
              <button
                key={item.tab}
                onClick={() => navigateToTab(item.tab)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions Desktop */}
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

      {/* Top Mobile Bar (Header ringkas & STICKY/FIXED di atas pada layar HP) */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#0a0c13]/95 backdrop-blur-md border-b border-zinc-800/80 px-3.5 py-2.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-white tracking-tight leading-none truncate">
              Admin Kiosk
            </h1>
            <span className="text-[10px] text-amber-400 font-medium">
              {currentTabMeta?.label || 'Panel Admin'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onBackToKiosk}
            className="py-1.5 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
            title="Kembali ke Kiosk Tamu"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-medium">Kiosk</span>
          </button>

          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:text-rose-300 active:scale-95 transition-all cursor-pointer"
            title="Keluar dari Admin"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area (Dengan padding top untuk header sticky & padding bottom untuk bottom nav sticky) */}
      <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto pt-16 pb-24 md:pt-6 md:pb-8">
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

      {/* Mobile Bottom Navigation (Tampilan HP: Bottom Bar pengganti Sidebar) */}
      <nav
        id="admin-mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0c13]/95 backdrop-blur-xl border-t border-zinc-800/90 shadow-2xl px-1.5 py-1"
        style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-6 items-center gap-0.5 max-w-md mx-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            const Icon = item.icon;
            return (
              <button
                key={item.tab}
                onClick={() => navigateToTab(item.tab)}
                className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all cursor-pointer min-h-[48px] relative ${
                  isActive
                    ? 'text-amber-400 bg-amber-500/10 font-bold'
                    : 'text-zinc-400 hover:text-zinc-200 active:scale-90'
                }`}
              >
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute top-1 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                )}
                <Icon
                  className={`w-4 h-4 mb-1 transition-transform ${
                    isActive ? 'stroke-[2.5] text-amber-400 scale-110' : 'text-zinc-400'
                  }`}
                />
                <span
                  className={`text-[10px] tracking-tight leading-none truncate max-w-full ${
                    isActive ? 'text-amber-300 font-semibold' : 'text-zinc-400'
                  }`}
                >
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
