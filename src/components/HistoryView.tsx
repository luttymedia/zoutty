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

  // Format short date for card (e.g. "Sep 8" or "8 sept")
  const formatShortDate = (timestamp: number) => {
    const locale = uiLanguage === 'es' ? 'es-ES' : 'en-US';
    const formatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    });
    return formatter.format(new Date(timestamp));
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
            <span className="text-sm font-medium text-white/90">
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
        <div className="flex gap-4">
          <button
            id="onboarding-new-session-btn"
            onClick={onAddLesson}
            className="py-3.5 glass bg-brand/10 border-brand/20 text-brand font-medium text-sm flex items-center justify-center gap-2 hover:bg-brand/20 transition-all rounded-2xl shadow-lg glow-brand flex-1 min-h-[52px] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('home.addLesson')}
          </button>
        </div>
      )}

      {/* Search No Results */}
      {activeSearch && filteredSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in">
          <Search className="w-12 h-12 text-white/20 mb-4" />
          <h3 className="text-lg font-bold text-white/60">{t('search.noResults')}</h3>
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
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
            {t('history.emptyTitle')}
          </h3>
          <p className="text-sm sm:text-base text-white/50 max-w-md leading-relaxed mb-6">
            {t('history.emptyDesc')}
          </p>
          <button
            onClick={onAddLesson}
            className="px-6 py-3.5 bg-brand text-bg-dark font-bold rounded-2xl flex items-center gap-2 shadow-lg shadow-brand/20 hover:scale-105 transition-all text-sm cursor-pointer"
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
              className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-brand/70 group-hover:text-brand transition-colors" />
                <span className="text-xs sm:text-sm font-medium text-white/80 group-hover:text-white tracking-wide">
                  {group.label}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 font-normal">
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

            {/* Session Cards in Month */}
            {!isCollapsed && (
              <div className="grid grid-cols-1 gap-2.5 pl-1">
                {group.sessions.map((session) => {
                  const hasReport = Boolean(session.summary);
                  const sessionTags: string[] = (session as any).tags || [];

                  return (
                    <div
                      key={session.id}
                      onClick={() => onSelectSession(session.id, session.groupId || null)}
                      className={`glass p-4 sm:p-4.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 group hover:bg-white/5 ${
                        session.isDemo && sessions.length === 1
                          ? 'border-brand/50 shadow-[0_0_20px_rgba(45,212,191,0.2)] animate-pulse'
                          : 'border-white/5 hover:border-brand/30 hover:shadow-lg hover:shadow-brand/5'
                      }`}
                    >
                      {/* Top row: Date + Subtitle/Title + AI Badge */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-baseline gap-2 min-w-0 flex-1">
                          <span className="text-xs font-medium text-brand/90 shrink-0">
                            {formatShortDate(session.date)}
                          </span>
                          <span className="text-white/25 text-xs shrink-0">•</span>
                          <h3 className="text-sm sm:text-base font-medium text-white/90 truncate group-hover:text-brand-light transition-colors">
                            {session.subtitle || session.title}
                          </h3>
                        </div>

                        {/* AI Consolidated Report indicator */}
                        {hasReport && (
                          <div
                            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-[11px] font-normal shrink-0 shadow-xs"
                            title={t('history.hasReportBadge')}
                          >
                            <Sparkles className="w-3 h-3 text-brand" />
                            <span className="hidden sm:inline">{t('history.hasReportBadge')}</span>
                          </div>
                        )}
                      </div>

                      {/* Secondary line: If subtitle was shown above, show title if distinct */}
                      {session.subtitle && session.title !== session.subtitle && (
                        <p className="text-xs font-normal text-white/35 truncate -mt-0.5">
                          {session.title}
                        </p>
                      )}

                      {/* Topic Tags / Chips (Populated in Phase 3) */}
                      {sessionTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {sessionTags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-[11px] font-normal"
                            >
                              <Tag className="w-3 h-3 text-white/40" />
                              {tag}
                            </span>
                          ))}
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
