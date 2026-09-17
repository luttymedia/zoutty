import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Sparkles,
  Wand2,
  Mic,
  Upload,
  Edit2,
  Trash2,
  Share2,
  Download,
  Images,
  SlidersHorizontal,
  Music,
  Zap,
  GripHorizontal,
  Tag,
  Play,
  Plus,
  X
} from 'lucide-react';


export type DemoGuideIconType =
  | 'wand'
  | 'mic'
  | 'upload'
  | 'edit'
  | 'trash'
  | 'share'
  | 'download'
  | 'gallery'
  | 'settings'
  | 'glossary'
  | 'zap'
  | 'reorder'
  | 'tag'
  | 'notes'
  | 'play'
  | 'default';

export interface DemoGuideData {
  targetRect: {
    top: number;
    left: number;
    width: number;
    height: number;
    bottom: number;
    right: number;
  };
  tag: string;
  message: string;
  icon?: DemoGuideIconType;
}

interface DemoGuidePopoverProps {
  guide: DemoGuideData | null;
  onClose: () => void;
}

export function DemoGuidePopover({ guide, onClose }: DemoGuidePopoverProps) {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 390,
    height: typeof window !== 'undefined' ? window.innerHeight : 844,
  });

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Track window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-dismiss after 6.5 seconds
  useEffect(() => {
    if (!guide) return;
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, 6500);
    return () => clearTimeout(timer);
  }, [guide]);

  const iconMap: Record<DemoGuideIconType, React.ReactNode> = {
    wand: <Wand2 className="w-4 h-4 text-purple-400" />,
    mic: <Mic className="w-4 h-4 text-brand" />,
    upload: <Upload className="w-4 h-4 text-orange-400" />,
    edit: <Edit2 className="w-4 h-4 text-brand" />,
    trash: <Trash2 className="w-4 h-4 text-rose-400" />,
    share: <Share2 className="w-4 h-4 text-brand" />,
    download: <Download className="w-4 h-4 text-brand" />,
    gallery: <Images className="w-4 h-4 text-purple-400" />,
    settings: <SlidersHorizontal className="w-4 h-4 text-brand" />,
    glossary: <Music className="w-4 h-4 text-brand" />,
    zap: <Zap className="w-4 h-4 text-brand" />,
    reorder: <GripHorizontal className="w-4 h-4 text-brand" />,
    tag: <Tag className="w-4 h-4 text-brand" />,
    notes: <Plus className="w-4 h-4 text-brand" />,
    play: <Play className="w-4 h-4 text-brand fill-brand" />,
    default: <Sparkles className="w-4 h-4 text-brand" />,
  };

  const resolvedIcon = guide?.icon ? iconMap[guide.icon] || iconMap.default : iconMap.default;

  // Geometry computation
  const pos = useMemo(() => {
    if (!guide) return null;
    const { targetRect } = guide;
    const cardWidth = Math.min(340, windowSize.width - 24);
    const targetCenterX = targetRect.left + targetRect.width / 2;

    let left = targetCenterX - cardWidth / 2;
    left = Math.max(12, Math.min(left, windowSize.width - cardWidth - 12));

    const spaceBelow = windowSize.height - targetRect.bottom;
    const spaceAbove = targetRect.top;

    let placement: 'top' | 'bottom';
    // If target is very close to the bottom (e.g. bottom bar), position above
    if (spaceBelow < 200) {
      placement = 'top';
    } else if (spaceAbove < 160) {
      placement = 'bottom';
    } else if (spaceBelow >= spaceAbove) {
      placement = 'bottom';
    } else {
      placement = 'top';
    }

    // Arrow relative offset within card (clamped)
    const arrowLeft = Math.max(20, Math.min(targetCenterX - left, cardWidth - 20));

    if (placement === 'top') {
      const bottom = Math.max(12, windowSize.height - targetRect.top + 10);
      return { placement, left, cardWidth, bottom, arrowLeft };
    } else {
      const top = Math.max(12, targetRect.bottom + 10);
      return { placement, left, cardWidth, top, arrowLeft };
    }
  }, [guide, windowSize]);

  if (!guide || !pos) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[2400] bg-black/20 backdrop-blur-[1px] cursor-pointer"
        onClick={onClose}
      />

      {/* Popover Card — CSS animation only, no motion/react */}
      <div
        style={{
          position: 'fixed',
          left: `${pos.left}px`,
          ...(pos.placement === 'top' ? { bottom: `${pos.bottom}px` } : { top: `${pos.top}px` }),
          width: `${pos.cardWidth}px`,
        }}
        className="z-[2401] rounded-2xl p-4 bg-[#181a20]/95 backdrop-blur-xl border border-brand/40 shadow-2xl shadow-brand/20 text-white select-none animate-in fade-in zoom-in-95 duration-200 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrow Beak */}
        <div
          style={{ left: `${pos.arrowLeft}px` }}
          className={`absolute w-3 h-3 bg-[#181a20] border-brand/40 rotate-45 -translate-x-1/2 ${
            pos.placement === 'top'
              ? '-bottom-1.5 border-b border-r'
              : '-top-1.5 border-t border-l'
          }`}
        />

        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-brand/15 border border-brand/30 flex items-center justify-center shrink-0">
              {resolvedIcon}
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand truncate">
              {guide.tag}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <p className="text-xs sm:text-sm text-stone-200 leading-relaxed font-sans">
          {guide.message}
        </p>
      </div>
    </>
  );
}
