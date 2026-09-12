import React from 'react';
import { Sparkles, Tag } from 'lucide-react';
import { Session } from '../types';
import { useTranslation } from '../i18n/TranslationContext';

interface HistorySessionRowProps {
  session: Session;
  isSingleDemoSession?: boolean;
  onSelectSession: (sessionId: string, groupId: string | null) => void;
}

export const HistorySessionRow: React.FC<HistorySessionRowProps> = ({
  session,
  isSingleDemoSession = false,
  onSelectSession,
}) => {
  const { t, uiLanguage } = useTranslation();

  const formatMonth = (timestamp: number) => {
    const locale = uiLanguage === 'es' ? 'es-ES' : 'en-US';
    const formatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
    });
    return formatter.format(new Date(timestamp));
  };

  const formatDayNumber = (timestamp: number) => {
    const d = new Date(timestamp);
    return String(d.getDate()).padStart(2, '0');
  };

  const hasReport = Boolean(session.summary);
  const sessionTags = session.tags || [];

  return (
    <div
      onClick={() => onSelectSession(session.id, session.groupId || null)}
      className={`flex items-center gap-4 py-3.5 px-1 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group ${
        isSingleDemoSession
          ? 'border-brand/40 shadow-[0_0_15px_rgba(45,212,191,0.15)] animate-pulse'
          : ''
      }`}
    >
      {/* Left stacked date column */}
      <div className="w-14 shrink-0 text-left flex flex-col justify-center">
        <span className="text-[11px] text-white/40 leading-none truncate">
          {formatMonth(session.date)}
        </span>
        <span className="text-base sm:text-lg text-white/80 font-medium leading-tight mt-0.5">
          {formatDayNumber(session.date)}
        </span>
      </div>

      {/* Main Title & Topics Column */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <h3 className="text-sm sm:text-base text-white/90 truncate group-hover:text-brand transition-colors">
          {session.title}
        </h3>

        {/* Subtitle */}
        {session.subtitle && (
          <p className="text-xs text-white/40 truncate">
            {session.subtitle}
          </p>
        )}

        {/* Topics Row */}
        {sessionTags.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-white/40 truncate">
            <Tag className="w-3.5 h-3.5 text-white/30 shrink-0" />
            <span className="truncate">{sessionTags.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Right AI Sparkles Indicator */}
      {hasReport && (
        <div
          className="shrink-0 pl-1"
          title={t('history.hasReportBadge')}
        >
          <Sparkles className="w-4 h-4 text-brand/70 group-hover:text-brand transition-colors" />
        </div>
      )}
    </div>
  );
};
