import React, { useState, useMemo } from 'react';
import {
  Plus,
  ChevronDown,
  Search,
  X,
  Calendar,
  BookOpen,
  Loader2,
  Download
} from 'lucide-react';
import { Session } from '../types';
import { useTranslation } from '../i18n/TranslationContext';
import { HistoryCalendarView } from './HistoryCalendarView';
import { HistorySessionRow } from './HistorySessionRow';

interface HistoryViewProps {
  sessions: Session[];
  onSelectSession: (sessionId: string, groupId: string | null) => void;
  onAddLesson: (targetDate?: Date) => void;
  onImportSession?: () => void;
  activeSearch: {
    query: string;
    matchedSessionIds: Set<string>;
  } | null;
  onClearSearch: () => void;
  onOpenSearch: () => void;
  isLoading?: boolean;
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
  onImportSession,
  activeSearch,
  onClearSearch,
  onOpenSearch,
  isLoading = false,
}) => {
  const { t, uiLanguage } = useTranslation();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(() => {
    try {
      const saved = localStorage.getItem('zoutty_history_view_mode');
      return saved === 'calendar' ? 'calendar' : 'list';
    } catch {
      return 'list';
    }
  });

  const handleToggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === 'list' ? 'calendar' : 'list';
      try {
        localStorage.setItem('zoutty_history_view_mode', next);
      } catch (e) {
        console.error('Failed to save history view mode', e);
      }
      return next;
    });
  };

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

  return (
    <div className="space-y-6">
      {/* Action Bar / Search Header */}
      {activeSearch && (
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
      )}

      {/* Floating Action Buttons (FAB) */}
      <div 
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
        className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center justify-center gap-2.5 sm:gap-3 pointer-events-auto !m-0"
      >
        <button
          id="onboarding-new-session-btn"
          onClick={() => onAddLesson()}
          className="h-11 sm:h-12 px-5 sm:px-6 rounded-full bg-brand text-bg-dark font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-brand/90 active:scale-95 transition-all shadow-xl shadow-black/40 cursor-pointer"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          <span>{t('home.newLesson')}</span>
        </button>
        {onImportSession && (
          <button
            onClick={onImportSession}
            className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-500 active:scale-95 transition-all shadow-xl shadow-black/40 shrink-0 cursor-pointer"
            title={t('home.importBtnTitle')}
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Search No Results */}
      {activeSearch && filteredSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in">
          <Search className="w-12 h-12 text-white/20 mb-4" />
          <h3 className="text-lg text-white/60">{t('search.noResults')}</h3>
          <p className="text-sm text-white/40 mt-1">{t('search.tryAdjusting')}</p>
        </div>
      )}

      {/* Loading State while fetching data */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in">
          <Loader2 className="w-8 h-8 text-brand animate-spin mb-3" />
        </div>
      )}

      {/* Empty State when no sessions exist */}
      {!activeSearch && !isLoading && sessions.length === 0 && (
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
            onClick={() => onAddLesson()}
            className="px-6 py-3.5 bg-brand text-bg-dark font-semibold rounded-full flex items-center gap-2 shadow-xl shadow-black/30 hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            {t('history.addFirstLessonBtn')}
          </button>
        </div>
      )}

      {/* Text-only View Mode Toggle above the list/calendar */}
      {!isLoading && sessions.length > 0 && (
        <div className={`flex items-center justify-end px-1 ${activeSearch ? 'mt-0 mb-2' : '-mt-3 mb-2.5'}`}>
          <button
            type="button"
            onClick={handleToggleViewMode}
            className="text-xs font-semibold uppercase tracking-wider text-white/50 hover:text-brand transition-all cursor-pointer py-1 px-3 rounded-full hover:bg-white/5 active:scale-95"
          >
            {viewMode === 'list' ? t('history.toggleCalendar') : t('history.toggleList')}
          </button>
        </div>
      )}

      {/* Calendar View Mode */}
      {viewMode === 'calendar' ? (
        <HistoryCalendarView
          sessions={filteredSessions}
          onSelectSession={onSelectSession}
          onAddLesson={onAddLesson}
        />
      ) : (
        /* Chronological Month Sections */
        monthGroups.map((group) => {
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
                  {group.sessions.map((session) => (
                    <HistorySessionRow
                      key={session.id}
                      session={session}
                      isSingleDemoSession={session.isDemo && sessions.length === 1}
                      onSelectSession={onSelectSession}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
