import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Lightbulb,
  CheckCircle2,
  Globe,
  Compass,
  ChevronRight
} from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';
import { UI_LANGUAGE_NAMES } from '../i18n';
import { CustomSelect } from './CustomSelect';
import { ZouttyIcon } from './ZouttyIcon';

export interface OnboardingStepConfig {
  stepIndex: number;
  targetSelector?: string;
  titleKey: string;
  descKey: string;
  tipKey?: string;
  sandboxNoticeKey?: string;
  preferredPlacement?: 'top' | 'bottom';
  actionButtonTextKey?: string;
  isCenterModal?: boolean;
}

interface InteractiveOnboardingOverlayProps {
  currentStep: number;
  totalSteps: number;
  stepConfig: OnboardingStepConfig;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onTargetClick?: () => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export function InteractiveOnboardingOverlay({
  currentStep,
  totalSteps,
  stepConfig,
  onNext,
  onPrev,
  onSkip,
  onFinish,
  onTargetClick
}: InteractiveOnboardingOverlayProps) {
  const { t, uiLanguage, setUILanguage } = useTranslation();
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 390,
    height: typeof window !== 'undefined' ? window.innerHeight : 844
  });
  const popoverRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number>(240);

  // Measure target element rect
  const updateTargetRect = useCallback(() => {
    if (!stepConfig.targetSelector) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(stepConfig.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setTargetRect(null);
        return;
      }
      const padding = 6;
      setTargetRect({
        top: Math.max(0, rect.top - padding),
        left: Math.max(0, rect.left - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        bottom: rect.bottom + padding,
        right: rect.right + padding
      });
    } else {
      setTargetRect(null);
    }
  }, [stepConfig.targetSelector]);

  // Keep target rect updated on resize, scroll, or step change
  useEffect(() => {
    updateTargetRect();
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      updateTargetRect();
    };
    const handleScroll = () => {
      updateTargetRect();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    const interval = setInterval(updateTargetRect, 200);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      clearInterval(interval);
    };
  }, [updateTargetRect, currentStep]);

  // Measure card height dynamically
  useLayoutEffect(() => {
    const el = popoverRef.current;
    if (!el) return;

    setMeasuredHeight(el.offsetHeight || 240);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === el) {
          setMeasuredHeight((entry.target as HTMLElement).offsetHeight || 240);
        }
      }
    });
    
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentStep, stepConfig]);

  const isCenter = stepConfig.isCenterModal || !targetRect;
  const isLastStep = currentStep === totalSteps;
  const isFirstStep = currentStep === 0;

  // Calculate coordinates for positioned popover
  const calculatePosition = () => {
    if (isCenter || !targetRect) return null;

    const margin = 12;
    const cardWidth = Math.min(360, windowSize.width - margin * 2);
    const estimatedHeight = measuredHeight || 230; // only used for placement decision
    const clearance = 40; // Generous breathing room above target & tap badge

    // Center horizontally on target, clamped to screen edges
    const targetCenterX = targetRect.left + targetRect.width / 2;
    let left = targetCenterX - cardWidth / 2;
    left = Math.max(margin, Math.min(left, windowSize.width - cardWidth - margin));

    const spaceBelow = windowSize.height - targetRect.bottom;
    const spaceAbove = targetRect.top;
    let placement: 'top' | 'bottom';

    if (stepConfig.preferredPlacement === 'top') {
      placement = (spaceAbove >= estimatedHeight + clearance || spaceAbove > spaceBelow) ? 'top' : 'bottom';
    } else if (stepConfig.preferredPlacement === 'bottom') {
      placement = (spaceBelow >= estimatedHeight + clearance || spaceBelow >= spaceAbove) ? 'bottom' : 'top';
    } else {
      if (spaceBelow > estimatedHeight + clearance) {
        placement = 'bottom';
      } else {
        placement = 'top';
      }
    }

    if (placement === 'top') {
      const bottomPos = Math.max(margin, windowSize.height - targetRect.top + clearance);
      const maxH = Math.max(160, targetRect.top - clearance - margin);
      return { placement, left, width: cardWidth, bottom: bottomPos, maxHeight: maxH };
    } else {
      const topPos = Math.max(margin, targetRect.bottom + clearance);
      const maxH = Math.max(160, windowSize.height - targetRect.bottom - clearance - margin);
      return { placement, left, width: cardWidth, top: topPos, maxHeight: maxH };
    }
  };

  const pos = calculatePosition();

  // Render the card content
  const renderCardContent = () => (
    <div className="flex flex-col gap-3 relative z-10">
      {/* Ambient Glow */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-36 h-16 bg-brand/20 blur-3xl pointer-events-none rounded-full" />

      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        {isFirstStep ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-brand/20 border border-brand/40 flex items-center justify-center text-brand">
              <Compass className="w-3.5 h-3.5" />
            </div>
            <span className="text-[11px] font-black font-logo uppercase tracking-widest text-brand">
              {t('appName')} • {t('onboarding.tourTitleSuffix')}
            </span>
          </div>
        ) : (
          <span className="px-2.5 py-0.5 rounded-lg bg-brand/15 border border-brand/30 text-brand text-[11px] tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {t('onboarding.tourStepIndicator', { current: currentStep, total: totalSteps })}
          </span>
        )}

        {/* Skip Button */}
        {!isLastStep && (
          <button
            onClick={onSkip}
            className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1 cursor-pointer"
            title={t('onboarding.tourSkipBtn')}
          >
            <span>{t('onboarding.tourSkipBtn')}</span>
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Step 0 Graphic / Icon */}
      {isFirstStep && (
        <div className="flex flex-col items-center justify-center text-center pt-1 pb-1">
          <div className="relative mb-1">
            <div className="absolute inset-0 bg-brand/30 blur-xl rounded-full" />
            <ZouttyIcon className="w-12 h-12 text-brand relative z-10 animate-float" />
          </div>
          {/* "Bring it to Zoutty" transformation visual */}
          <div className="flex items-center justify-center gap-2 text-2xl mt-2 mb-1">
            <span>🎥</span>
            <ChevronRight className="w-4 h-4 text-white/30" />
            <span>✨</span>
            <ChevronRight className="w-4 h-4 text-white/30" />
            <span>📋</span>
          </div>
        </div>
      )}

      {/* Main Title and Description */}
      <div className={`space-y-1.5 ${isFirstStep ? 'text-center my-1' : ''}`}>
        <h3
          className={
            isFirstStep
              ? 'text-xl sm:text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-brand via-amber-200 to-brand leading-tight'
              : 'text-base sm:text-lg text-white tracking-tight flex items-center gap-2'
          }
        >
          {t(stepConfig.titleKey)}
        </h3>
        <p className={`${isFirstStep ? 'text-xs sm:text-sm text-zinc-300/90 leading-relaxed max-w-sm mx-auto' : 'text-xs sm:text-sm text-zinc-300 leading-relaxed'}`}>
          {t(stepConfig.descKey)}
        </p>
      </div>

      {/* Step 0 Language Selector */}
      {isFirstStep && (
        <div className="p-2.5 bg-white/5 border border-white/10 rounded-2xl space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-white/50 flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-brand" />
            {t('onboarding.interfaceLanguage')}
          </label>
          <CustomSelect
            value={uiLanguage}
            onChange={setUILanguage}
            options={Object.entries(UI_LANGUAGE_NAMES).map(([val, label]) => ({ value: val, label }))}
          />
        </div>
      )}

      {/* Sandbox Notice (Step 6) */}
      {stepConfig.sandboxNoticeKey && (
        <div className="p-2.5 sm:p-3 bg-brand/10 border border-brand/30 rounded-2xl flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-brand shrink-0 mt-0.5" />
          <p className="text-[11px] sm:text-xs text-brand-light leading-snug">
            {t(stepConfig.sandboxNoticeKey)}
          </p>
        </div>
      )}

      {/* Secondary Pro Tip Card */}
      {stepConfig.tipKey && (
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-start gap-2">
          <div className="w-4 h-4 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <Lightbulb className="w-3 h-3" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] uppercase tracking-wider text-amber-400 block mb-0.5">
              {t('onboarding.tourProTip')}
            </span>
            <p className="text-[11px] sm:text-xs text-zinc-300 leading-snug">
              {t(stepConfig.tipKey)}
            </p>
          </div>
        </div>
      )}

      {/* Navigation Controls */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
        {/* Back Button */}
        {!isFirstStep ? (
          <button
            onClick={onPrev}
            className="px-3.5 py-2 rounded-xl text-xs text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 min-h-[38px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t('onboarding.tourBackBtn')}
          </button>
        ) : (
          <div />
        )}

        {/* Next / Finish Button */}
        {isLastStep ? (
          <button
            onClick={onFinish}
            className="px-5 py-2 rounded-xl text-xs text-black bg-brand hover:brightness-110 shadow-lg shadow-brand/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 min-h-[38px]"
          >
            {t('onboarding.tourFinishBtn')}
            <CheckCircle2 className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onNext}
            className="px-4 py-2 rounded-xl text-xs text-black bg-brand hover:brightness-110 shadow-lg shadow-brand/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 ml-auto min-h-[38px]"
          >
            {isFirstStep
              ? t('onboarding.tourStartBtn')
              : t('onboarding.tourNextBtn')}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[1000] overflow-hidden select-none">
      {/* Layer 1: Dimmed Backdrop & Spotlight Cutout (z-[1000]) */}
      {targetRect ? (
        <div
          style={{
            position: 'absolute',
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: '16px',
            boxShadow: '0 0 0 9999px rgba(5, 5, 8, 0.78)'
          }}
          className="pointer-events-none z-[1000]"
        />
      ) : (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] pointer-events-auto z-[1000]" />
      )}

      {/* Layer 2: Centered Modal Mode (Step 0, Step 6, or no target) (z-[1010]) */}
      {isCenter ? (
        <div className="fixed inset-0 z-[1010] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={`modal-${currentStep}`}
              ref={popoverRef}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="pointer-events-auto w-full max-w-sm sm:max-w-md max-h-[84vh] overflow-y-auto bg-zinc-900/95 border border-brand/30 rounded-3xl p-4 sm:p-5 shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(234,179,8,0.12)] backdrop-blur-xl custom-scrollbar"
            >
              {renderCardContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      ) : pos ? (
        /* Layer 2: Positioned Popover Mode (Steps 1-5, 7) (z-[1010]) */
        <AnimatePresence mode="wait">
          <motion.div
            key={`popover-${currentStep}`}
            ref={popoverRef}
            initial={{ opacity: 0, y: pos.placement === 'top' ? -8 : 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            style={{
              position: 'absolute',
              top: pos.top !== undefined ? `${pos.top}px` : undefined,
              bottom: pos.bottom !== undefined ? `${pos.bottom}px` : undefined,
              left: `${pos.left}px`,
              width: `${pos.width}px`,
              maxHeight: `${pos.maxHeight}px`
            }}
            className="pointer-events-auto z-[1010] bg-zinc-900/95 border border-brand/30 rounded-3xl p-3.5 sm:p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(234,179,8,0.12)] backdrop-blur-xl max-h-[78vh] overflow-y-auto custom-scrollbar"
          >
            {renderCardContent()}
          </motion.div>
        </AnimatePresence>
      ) : null}

      {/* Layer 3: Interactive Spotlight Ring & Tap Badge (z-[1020]) */}
      {targetRect && (
        <div
          style={{
            position: 'absolute',
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: '16px'
          }}
          className="pointer-events-auto cursor-pointer ring-2 ring-brand/90 shadow-[0_0_25px_rgba(234,179,8,0.4)] hover:ring-4 hover:ring-brand transition-all flex items-center justify-center group z-[1020]"
          onClick={() => {
            if (onTargetClick) {
              onTargetClick();
            } else {
              onNext();
            }
          }}
          title={t('onboarding.tourClickTargetPrompt') || 'Tap to continue'}
        >
          {/* Pulsating animation halo */}
          <div className="absolute inset-0 rounded-2xl bg-brand/20 animate-ping opacity-30 pointer-events-none" />

          {/* Action indicator badge on target — placed on bottom if near top of screen to prevent cropping */}
          <div
            className={`absolute ${
              targetRect.top < 38 ? '-bottom-3 -right-2' : '-top-3 -right-2'
            } bg-brand text-black text-[9px] px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1 animate-bounce pointer-events-none uppercase tracking-wider`}
          >
            <Sparkles className="w-3 h-3" />
            {t('onboarding.tourTapBadge') || t('common.tap') || 'Tap'}
          </div>
        </div>
      )}
    </div>
  );
}
