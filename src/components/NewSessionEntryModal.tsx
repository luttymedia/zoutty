import React, { useEffect, useRef } from 'react';
import { Video, FileAudio, Mic, FileText, ChevronRight, X } from 'lucide-react';
import { useTranslation } from '../i18n/TranslationContext';

export type EntryOption = 'video' | 'audio' | 'record' | 'blank';

interface NewSessionEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOption: (option: EntryOption) => void;
  onSelectFile?: (option: 'video' | 'audio', file: File) => void;
}

export const NewSessionEntryModal: React.FC<NewSessionEntryModalProps> = ({
  isOpen,
  onClose,
  onSelectOption,
  onSelectFile,
}) => {
  const { t } = useTranslation();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const options: Array<{
    id: EntryOption;
    title: string;
    description: string;
    icon: React.ReactNode;
    colorClass: string;
    hoverBorderClass: string;
  }> = [
    {
      id: 'video',
      title: t('entry.uploadVideo'),
      description: t('entry.uploadVideoDesc'),
      icon: <Video className="w-5 h-5 text-amber-400" />,
      colorClass: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
      hoverBorderClass: 'hover:border-amber-500/40 hover:bg-amber-500/5',
    },
    {
      id: 'audio',
      title: t('entry.uploadAudio'),
      description: t('entry.uploadAudioDesc'),
      icon: <FileAudio className="w-5 h-5 text-blue-400" />,
      colorClass: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
      hoverBorderClass: 'hover:border-blue-500/40 hover:bg-blue-500/5',
    },
    {
      id: 'record',
      title: t('entry.recordNow'),
      description: t('entry.recordNowDesc'),
      icon: <Mic className="w-5 h-5 text-red-400" />,
      colorClass: 'bg-red-500/15 border-red-500/30 text-red-400',
      hoverBorderClass: 'hover:border-red-500/40 hover:bg-red-500/5',
    },
    {
      id: 'blank',
      title: t('entry.startBlank'),
      description: t('entry.startBlankDesc'),
      icon: <FileText className="w-5 h-5 text-brand" />,
      colorClass: 'bg-brand/15 border-brand/30 text-brand',
      hoverBorderClass: 'hover:border-brand/40 hover:bg-brand/5',
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-[80] p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="glass border border-white/10 p-5 sm:p-6 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle indicator */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
              {t('entry.modalTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-white/40 mt-0.5 font-normal">
              {t('entry.modalSubtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 -mt-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors cursor-pointer"
            title={t('entry.cancel')}
            aria-label={t('entry.cancel')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden inputs for direct file picking */}
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onSelectFile) {
              onSelectFile('video', file);
            }
            e.target.value = '';
          }}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onSelectFile) {
              onSelectFile('audio', file);
            }
            e.target.value = '';
          }}
        />

        {/* Options List */}
        <div className="space-y-2.5">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                if (option.id === 'video' && onSelectFile) {
                  videoInputRef.current?.click();
                } else if (option.id === 'audio' && onSelectFile) {
                  audioInputRef.current?.click();
                } else {
                  onSelectOption(option.id);
                }
              }}
              className={`w-full p-3.5 sm:p-4 glass rounded-2xl border border-white/5 ${option.hoverBorderClass} transition-all duration-150 flex items-center gap-3.5 sm:gap-4 text-left group cursor-pointer`}
            >
              <div
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${option.colorClass}`}
              >
                {option.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm sm:text-base font-medium text-white/90 group-hover:text-white transition-colors">
                  {option.title}
                </div>
                <div className="text-[11px] sm:text-xs text-white/45 mt-0.5 leading-snug font-normal">
                  {option.description}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
