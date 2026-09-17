import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
  maxHeightClass?: string;
  className?: string;
  showHandle?: boolean;
  showCloseButton?: boolean;
  disableScrollLock?: boolean;
  zIndexClass?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  maxWidthClass = 'max-w-lg',
  maxHeightClass = 'max-h-[90vh]',
  className = '',
  showHandle = true,
  showCloseButton = true,
  disableScrollLock = false,
  zIndexClass = 'z-[80]',
}) => {
  // Background scroll lock
  useEffect(() => {
    if (!isOpen || disableScrollLock) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen, disableScrollLock]);

  // Touch drag-to-dismiss gesture state
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isClosing) return;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || isClosing) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 0) {
      setDragY(deltaY);
    } else {
      // Resistance when dragging upwards
      setDragY(deltaY * 0.2);
    }
  };

  const triggerClose = () => {
    setIsClosing(true);
    setDragY(window.innerHeight || 500);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setDragY(0);
      setIsDragging(false);
    }, 220);
  };

  const handleTouchEnd = () => {
    if (touchStartY.current === null || isClosing) return;
    touchStartY.current = null;
    setIsDragging(false);

    // Dismiss threshold: 70px
    if (dragY > 70) {
      triggerClose();
    } else {
      setDragY(0);
    }
  };

  const handleSafeClose = () => {
    if (isClosing) return;
    triggerClose();
  };

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSafeClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center ${zIndexClass} p-0 sm:p-4 transition-opacity duration-200 ${
        isClosing ? 'opacity-0 pointer-events-none' : 'animate-in fade-in duration-200'
      }`}
      onClick={handleSafeClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`glass border border-white/10 p-5 sm:p-6 w-full ${maxWidthClass} ${maxHeightClass} rounded-t-3xl sm:rounded-3xl shadow-2xl relative text-left select-none sm:select-auto flex flex-col overflow-hidden ${
          isDragging ? '' : 'transition-transform duration-200 ease-out'
        } ${!isClosing && !isDragging && dragY === 0 ? 'animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200' : ''} ${className}`}
        style={{
          transform: `translate3d(0, ${Math.max(0, dragY)}px, 0)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle indicator */}
        {showHandle && (
          <div
            className="w-full pt-1 pb-4 flex items-center justify-center cursor-grab active:cursor-grabbing sm:hidden touch-none -mt-2 shrink-0"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <div className="w-12 h-1.5 bg-white/30 hover:bg-white/50 active:bg-white/60 rounded-full transition-colors" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          {children}
        </div>

        {/* Standardized Close Button */}
        {showCloseButton && (
          <button
            onClick={handleSafeClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer z-20"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
