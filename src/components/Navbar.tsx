import React, { useState, useRef } from 'react';
import {
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { StepKey } from '../types';

interface NavbarProps {
  currentStep: StepKey;
  eventName: string;
  onReset: () => void;
  onOpenAdmin?: () => void;
  onStepClick?: (step: StepKey) => void;
}

const STEPS: { key: StepKey; label: string; number: number }[] = [
  { key: 'event-info', label: 'Info Event', number: 1 },
  { key: 'theme-select', label: 'Pilih Tema', number: 2 },
  { key: 'layout-select', label: 'Pilih Layout', number: 3 },
  { key: 'camera', label: 'Kamera', number: 4 },
  { key: 'filter', label: 'Filter Warna', number: 5 },
  { key: 'slotting', label: 'Tata ke Slot', number: 6 },
  { key: 'overlay', label: 'Overlay Frame', number: 7 },
  { key: 'preview-locked', label: 'Pratinjau', number: 8 },
  { key: 'checkout', label: 'Pembayaran', number: 9 },
  { key: 'final', label: 'Selesai', number: 10 },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentStep,
  eventName,
  onReset,
  onOpenAdmin,
}) => {
  // Secret gesture tap count (5 tap cepat pada nama event / status dot untuk buka portal admin)
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSecretAdminTap = () => {
    if (!onOpenAdmin) return;
    const next = tapCount + 1;
    setTapCount(next);

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    tapTimeoutRef.current = setTimeout(() => {
      setTapCount(0);
    }, 2000);

    if (next >= 5) {
      setTapCount(0);
      onOpenAdmin();
    }
  };

  const isStep1 = currentStep === 'event-info' || currentStep === 'landing';

  const currentIdx = STEPS.findIndex(
    (s) => s.key === currentStep || (currentStep === 'landing' && s.key === 'event-info')
  );
  const currentStepObj = STEPS[currentIdx] || STEPS[0];

  return (
    <header className="w-full bg-[#0b0d13]/95 backdrop-blur-md border-b border-zinc-800/80 sticky top-0 z-40 px-3.5 py-2.5 shrink-0 shadow-sm">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Left: Secret Tap 5x untuk Operator Kiosk + Pulsing Dot + Nama Event */}
        <button
          type="button"
          onClick={handleSecretAdminTap}
          title={eventName || 'Photobooth Event'}
          className="flex items-center gap-2 text-left select-none cursor-default bg-transparent border-0 p-0 focus:outline-none min-w-0"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-mono font-bold text-zinc-100 tracking-tight truncate block max-w-[170px] sm:max-w-[220px]">
              {eventName || 'SnapMoment Photobooth'}
            </span>
            {!isStep1 && (
              <span className="text-[10px] text-amber-400 font-mono tracking-wider truncate block leading-tight">
                Step {currentStepObj.number}/10: {currentStepObj.label}
              </span>
            )}
          </div>
        </button>

        {/* Right side: On Step 1 show golden badge, on other steps show progress & reset */}
        {isStep1 ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-semibold text-amber-400 font-mono shrink-0">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Self-Service Photobooth</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            {/* Mini Step Badges Progress Indicator */}
            <div className="flex items-center gap-1">
              {STEPS.map((step, idx) => {
                const isActive = idx === currentIdx;
                const isDone = currentIdx > idx;

                return (
                  <div
                    key={step.key}
                    title={`Step ${step.number}: ${step.label}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isActive
                        ? 'w-4 bg-amber-400'
                        : isDone
                        ? 'w-1.5 bg-zinc-400'
                        : 'w-1 bg-zinc-800'
                    }`}
                  />
                );
              })}
            </div>

            {/* Reset / Home button */}
            <button
              id="btn-nav-reset"
              onClick={onReset}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer ml-1"
              title="Ulangi dari awal"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
