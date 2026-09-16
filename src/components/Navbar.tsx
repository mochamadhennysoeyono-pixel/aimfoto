import React from 'react';
import {
  Camera,
  Sparkles,
  LayoutGrid,
  Lock,
  CreditCard,
  CheckCircle2,
  RotateCcw,
  Layers,
  Palette,
  Info,
} from 'lucide-react';
import { StepKey } from '../types';

interface NavbarProps {
  currentStep: StepKey;
  eventName: string;
  onReset: () => void;
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

export const Navbar: React.FC<NavbarProps> = ({ currentStep, eventName, onReset }) => {
  // If at the very first step, hide top bar for cleaner landing experience
  if (currentStep === 'event-info' || currentStep === 'landing') return null;

  const currentIdx = STEPS.findIndex(
    (s) => s.key === currentStep || (currentStep === 'landing' && s.key === 'event-info')
  );
  const currentStepObj = STEPS[currentIdx] || STEPS[0];

  return (
    <header className="w-full bg-[#0d0f17]/90 backdrop-blur-md border-b border-zinc-800/80 sticky top-0 z-40 px-3 py-2.5">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Brand & Event Title */}
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Camera className="w-4 h-4 text-amber-400" />
          </div>
          <div className="truncate">
            <h1 className="text-xs font-semibold text-white tracking-wide truncate">
              {eventName || 'SnapMoment Photobooth'}
            </h1>
            <p className="text-[10px] text-amber-400/90 font-mono tracking-wider truncate">
              Step {currentStepObj.number}/10: {currentStepObj.label}
            </p>
          </div>
        </div>

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
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Ulangi dari awal"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
