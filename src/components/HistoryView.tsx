import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  ChevronDown,
  Search,
  X,
  Calendar,
  Tag,
  BookOpen
} from 'lucide-react';
import { Session } from '../types';
import { useTranslation } from '../i18n/TranslationContext';

interface HistoryViewProps {
  sessions: Session[];
  onSelectSession: (sessionId: string, groupId: string | null) => void;
  onAddLesson: () => void;
  activeSearch: {
    query: string;
    matchedSessionIds: Set<string>;
  } | null;
  onClearSearch: () => void;
  onOpenSearch: () => void;
}

interface MonthGroup {
  key: string; // e.g. "2026-09"
  label: string; // e.g. "September 2026"
  sessions: Session[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  sessions,
  onSelectSession,
  onAddLesson,
  activeSearch,
  onClearSearch,
  onOpenSearch,
}) => {
  const { t, uiLanguage } = useTranslation();
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('zoutty_collapsed_months');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Filter sessions if search is active
  const filteredSessions = useMemo(() => {
    if (!activeSearch) return sessions;
    return sessions.filter((s) => activeSearch.matchedSessionIds.has(s.id));
  }, [sessions, activeSearch]);

  // Group sessions by Year-Month in descending order
  const monthGroups = useMemo(() => {
    const locale = uiLanguage === 'es' ? 'es-ES' : 'en-US';
    const monthFormatter = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
    });

    // Sort all sessions newest first
    const sorted = [...filteredSessions].sort((a, b) => b.date - a.date);

    const groupMap = new Map<string, { label: string; sessions: Session[] }>();

    for (const s of sorted) {
      const d = new Date(s.date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;

      if (!groupMap.has(key)) {
        const rawLabel = monthFormatter.format(d);
        // Capitalize first letter of month
        const capitalizedLabel =
          rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
        groupMap.set(key, { label: capitalizedLabel, sessions: [] });
      }

      groupMap.get(key)!.sessions.push(s);
    }

    const groups: MonthGroup[] = [];
    for (const [key, val] of groupMap.entries()) {
      groups.push({
        key,
        label: val.label,
        sessions: val.sessions,
      });
    }

    return groups;
  }, [filteredSessions, uiLanguage]);

  const toggleMonthCollapse = (monthKey: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      try {
        localStorage.setItem(
          'zoutty_collapsed_months',
          JSON.stringify(Array.from(next))
        );
      } catch (e) {
        console.error('Failed to save collapsed months', e);
      }
      return next;
    });
  };

  // Format month (e.g. "Sep")
  const formatMonth = (timestamp: number) => {
    const locale = uiLanguage === 'es' ? 'es-ES' : 'en-US';
    const formatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
    });
    return formatter.format(new Date(timestamp));
  };

  // Format day number with leading zero (e.g. "08")
  const formatDayNumber = (timestamp: number) => {
    const d = new Date(timestamp);
    return String(d.getDate()).padStart(2, '0');
  };

  return (
    <div className="space-y-6">
      {/* Action Bar / Search Header */}
      {activeSearch ? (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl bg-purple-500/5 border border-purple-500/10 hover:bg-purple-500/10 transition-colors cursor-pointer group"
          onClick={onOpenSearch}
        >
          <div className="flex items-center gap-3">
            <Search className="w-4 h-4 text-purple-400/80 group-hover:text-purple-400 transition-colors" />
            <span className="text-sm text-white/90">
              {activeSearch.query
                ? t('search.searching', { query: activeSearch.query })
                : t('search.advancedSearch')}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClearSearch();
            }}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
            title={t('search.clearSearch')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex justify-center items-center">
          <button
            id="onboarding-new-session-btn"
            onClick={onAddLesson}
            className="py-2 px-3.5 bg-brand/10 border border-brand/20 text-brand text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-brand/20 transition-all rounded-xl shadow-sm glow-brand min-h-[38px] w-[calc((100%-58px)/2)] sm:w-[calc((100%-62px)/2)] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('home.newLesson')}</span>
          </button>
        </div>
      )}

      {/* Search No Results */}
      {activeSearch && filteredSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in">
          <Search className="w-12 h-12 text-white/20 mb-4" />
          <h3 className="text-lg text-white/60">{t('search.noResults')}</h3>
          <p className="text-sm text-white/40 mt-1">{t('search.tryAdjusting')}</p>
        </div>
      )}

      {/* Empty State when no sessions exist */}
      {!activeSearch && sessions.length === 0 && (
        <div className="glass p-8 sm:p-12 text-center rounded-3xl border border-white/10 flex flex-col items-center justify-center animate-in fade-in">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-5 flex items-center justify-center">
            <div className="absolute inset-0 bg-brand/20 blur-2xl rounded-full animate-pulse" />
            <BookOpen className="w-12 h-12 text-brand drop-shadow-[0_0_15px_rgba(45,212,191,0.4)]" />
          </div>
          <h3 className="text-xl sm:text-2xl text-white mb-2 tracking-tight">
            {t('history.emptyTitle')}
          </h3>
          <p className="text-sm sm:text-base text-white/50 max-w-md leading-relaxed mb-6">
            {t('history.emptyDesc')}
          </p>
          <button
            onClick={onAddLesson}
            className="px-6 py-3.5 bg-brand text-bg-dark rounded-2xl flex items-center gap-2 shadow-lg shadow-brand/20 hover:scale-105 transition-all text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('history.addFirstLessonBtn')}
          </button>
        </div>
      )}

      {/* Chronological Month Sections */}
      {monthGroups.map((group) => {
        const isCollapsed = collapsedMonths.has(group.key);
        const count = group.sessions.length;

        return (
          <div key={group.key} className="space-y-3 animate-in fade-in">
            {/* Collapsible Month Header */}
            <button
              type="button"
              onClick={() => toggleMonthCollapse(group.key)}
              title={isCollapsed ? t('history.expandMonth') : t('history.collapseMonth')}
              className="w-full flex items-center justify-between py-2.5 px-1 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand/70 group-hover:text-brand transition-colors shrink-0" />
                <span className="text-xs sm:text-sm font-medium tracking-wider uppercase text-brand/90 group-hover:text-brand transition-colors">
                  {group.label}
                </span>
                <span className="text-white/30 text-xs">|</span>
                <span className="text-white/40 text-xs font-normal lowercase">
                  {count === 1
                    ? t('history.sessionCountSingular')
                    : t('history.sessionCountPlural', { count })}
                </span>
              </div>

              <ChevronDown
                className={`w-4 h-4 text-white/40 group-hover:text-white transition-transform duration-200 ${
                  isCollapsed ? '-rotate-90' : 'rotate-0'
                }`}
              />
            </button>

            {/* Session Rows in Month */}
            {!isCollapsed && (
              <div className="flex flex-col">
                {group.sessions.map((session) => {
                  const hasReport = Boolean(session.summary);
                  const sessionTags = session.tags || [];

                  return (
                    <div
                      key={session.id}
                      onClick={() => onSelectSession(session.id, session.groupId || null)}
                      className={`flex items-center gap-4 py-3.5 px-1 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group ${
                        session.isDemo && sessions.length === 1
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
                        {sessionTags.length > 0 ? (
                          <div className="flex items-center gap-1.5 text-xs text-white/40 truncate">
                            <Tag className="w-3.5 h-3.5 text-white/30 shrink-0" />
                            <span className="truncate">{sessionTags.join(', ')}</span>
                          </div>
                        ) : !session.subtitle ? (
                          <div className="flex items-center gap-1.5 text-xs text-white/20 italic truncate">
                            <Tag className="w-3.5 h-3.5 opacity-40 shrink-0" />
                            <span>{t('history.noTags')}</span>
                          </div>
                        ) : null}
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
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
