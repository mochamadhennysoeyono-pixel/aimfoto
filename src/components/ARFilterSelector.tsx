import React from 'react';
import { AR_FILTERS, ARFilterId } from '../types/arFilter';
import { Sparkles } from 'lucide-react';

interface ARFilterSelectorProps {
  selectedFilter: ARFilterId;
  onSelectFilter: (filterId: ARFilterId) => void;
  faceDetected?: boolean;
}

export const ARFilterSelector: React.FC<ARFilterSelectorProps> = ({
  selectedFilter,
  onSelectFilter,
  faceDetected = false,
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-1 mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>Live AR Filter Wajah</span>
        </div>
        {selectedFilter !== 'none' && (
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 ${
              faceDetected
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${faceDetected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {faceDetected ? 'Wajah Terlacak' : 'Mencari Wajah...'}
          </span>
        )}
      </div>

      {/* Horizontal Carousel */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {AR_FILTERS.map((item) => {
          const isSelected = selectedFilter === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectFilter(item.id)}
              className={`flex flex-col items-center justify-center min-w-[62px] px-2 py-1.5 rounded-xl border transition-all cursor-pointer select-none shrink-0 ${
                isSelected
                  ? 'bg-gradient-to-b from-amber-500/20 to-amber-500/10 border-amber-500 text-amber-300 shadow-md shadow-amber-500/20 scale-105'
                  : 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
              <span className="text-xl mb-0.5 filter drop-shadow">{item.emoji}</span>
              <span className="text-[10px] font-medium leading-tight whitespace-nowrap text-center">
                {item.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
