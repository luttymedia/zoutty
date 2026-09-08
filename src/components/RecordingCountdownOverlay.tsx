import React, { useState, useEffect } from 'react';
import { X, Mic } from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';

interface RecordingCountdownOverlayProps {
  isOpen: boolean;
  onComplete: () => void;
  onCancel: () => void;
  seconds?: number;
}

export const RecordingCountdownOverlay: React.FC<RecordingCountdownOverlayProps> = ({
  isOpen,
  onComplete,
  onCancel,
  seconds = 3,
}) => {
  const { t } = useTranslation();
  const [count, setCount] = useState(seconds);

  // Reset count when opened
  useEffect(() => {
    if (isOpen) {
      setCount(seconds);
    }
  }, [isOpen, seconds]);

  // Handle countdown interval
  useEffect(() => {
    if (!isOpen) return;

    if (count <= 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCount((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isOpen, count, onComplete]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={t('session.recordingCountdown')}
    >
      <div className="flex flex-col items-center justify-center max-w-sm w-full text-center">
        {/* Camera Timer Status Badge */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/90 text-sm font-medium mb-10 shadow-lg backdrop-blur-md">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span>{t('session.recordingCountdown')}</span>
        </div>

        {/* Central Camera-Style Timer Circle */}
        <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center">
          {/* Outer Pulsing Rings */}
          <div
            key={`ring-${count}`}
            className="absolute inset-0 rounded-full border-2 border-red-500/50 animate-ping opacity-70 pointer-events-none"
          />
          <div className="absolute -inset-3 rounded-full border border-white/10 pointer-events-none" />

          {/* Shutter Circle Background */}
          <div className="w-full h-full rounded-full bg-black/60 border-4 border-red-500/80 shadow-[0_0_50px_rgba(239,68,68,0.35)] flex items-center justify-center backdrop-blur-xl">
            {/* Animated Large Countdown Number */}
            <span
              key={count}
              className="text-8xl sm:text-9xl font-black text-white tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.7)] animate-in zoom-in-50 duration-300 select-none"
            >
              {count > 0 ? count : <Mic className="w-20 h-20 text-red-400 animate-pulse" />}
            </span>
          </div>
        </div>

        {/* Cancel Button */}
        <button
          onClick={onCancel}
          className="mt-12 px-5 py-2.5 rounded-full glass border border-white/20 hover:bg-white/15 text-white/80 hover:text-white transition-all text-sm font-medium flex items-center gap-2 cursor-pointer shadow-xl active:scale-95"
          title={t('session.cancelCountdown')}
        >
          <X className="w-4 h-4" />
          <span>{t('session.cancelCountdown')}</span>
        </button>
      </div>
    </div>
  );
};
