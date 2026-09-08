import React, { useState, useMemo } from 'react';
import {
  Tag,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Layers,
  Search,
  X,
} from 'lucide-react';
import { Session } from '../types';
import { useTranslation } from '../i18n/TranslationContext';

interface TopicsViewProps {
  sessions: Session[];
  onSelectSession: (sessionId: string, groupId: string | null) => void;
  activeSearch?: {
    query: string;
    matchedSessionIds: Set<string>;
  } | null;
  onClearSearch?: () => void;
  onOpenSearch?: () => void;
}

interface TopicAggregate {
  name: string;
  count: number;
  lastDate: number;
  sessions: Session[];
}

export const TopicsView: React.FC<TopicsViewProps> = ({
  sessions,
  onSelectSession,
  activeSearch,
  onClearSearch,
  onOpenSearch,
}) => {
  const { t, uiLanguage } = useTranslation();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Filter sessions if search is active
  const filteredSessions = useMemo(() => {
    if (!activeSearch) return sessions;
    return sessions.filter((s) => activeSearch.matchedSessionIds.has(s.id));
  }, [sessions, activeSearch]);

  // Filter out deleted sessions and aggregate tags based on filtered sessions
  const topicsList = useMemo<TopicAggregate[]>(() => {
    const tagMap = new Map<string, TopicAggregate>();

    const activeSessions = filteredSessions.filter((s) => !s.deleted);

    for (const session of activeSessions) {
      if (!session.tags || !Array.isArray(session.tags)) continue;

      for (const rawTag of session.tags) {
        const trimmed = rawTag.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();

        if (!tagMap.has(key)) {
          tagMap.set(key, {
            name: trimmed,
            count: 0,
            lastDate: session.date,
            sessions: [],
          });
        }

        const entry = tagMap.get(key)!;
        entry.count += 1;
        entry.sessions.push(session);
        if (session.date > entry.lastDate) {
          entry.lastDate = session.date;
        }
      }
    }

    // Sort matching sessions newest first for each topic
    for (const topic of tagMap.values()) {
      topic.sessions.sort((a, b) => b.date - a.date);
    }

    // Sort topics: highest session count first, then most recently practiced
    return Array.from(tagMap.values()).sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return b.lastDate - a.lastDate;
    });
  }, [filteredSessions]);

  // Selected topic object (if any)
  const activeTopicData = useMemo(() => {
    if (!selectedTopic) return null;
    return topicsList.find(
      (topic) => topic.name.toLowerCase() === selectedTopic.toLowerCase()
    );
  }, [selectedTopic, topicsList]);

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

  // Format relative recency
  const formatRelativeTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return t('topics.relativeToday');
    if (diffDays === 1) return t('topics.relativeYesterday');
    if (diffDays < 7) return t('topics.relativeDaysAgo', { count: diffDays });
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) return t('topics.relativeWeeksAgo', { count: diffWeeks });
    const diffMonths = Math.floor(diffDays / 30);
    return t('topics.relativeMonthsAgo', { count: diffMonths });
  };

  // Search Header Banner component
  const renderSearchBanner = () => {
    if (!activeSearch || !onOpenSearch || !onClearSearch) return null;

    return (
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
    );
  };

  // ─── Sub-view 2: Topic Drill-Down (sessions tagged with selected topic) ─────
  if (selectedTopic) {
    const count = activeTopicData ? activeTopicData.sessions.length : 0;

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Search header if active */}
        {renderSearchBanner()}

        {/* Back navigation bar */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedTopic(null)}
            className="flex items-center gap-1.5 text-xs sm:text-sm text-brand hover:text-brand-light transition-colors py-1 px-1 -ml-1 cursor-pointer group"
          >
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            <span>{t('topics.backToTopics')}</span>
          </button>
        </div>

        {/* Topic Header Card */}
        <div className="glass p-5 sm:p-6 rounded-2xl border border-white/10 relative overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-brand shrink-0" />
                <h2 className="text-lg sm:text-xl font-medium text-white tracking-tight">
                  {activeTopicData ? activeTopicData.name : selectedTopic}
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50">
                <span>
                  {count === 1
                    ? t('topics.sessionCountSingular')
                    : t('topics.sessionCountPlural', { count })}
                </span>
                {activeTopicData && (
                  <>
                    <span>•</span>
                    <span>
                      {t('topics.lastWorkedOn', {
                        relative: formatRelativeTime(activeTopicData.lastDate),
                      })}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search No Results within this topic */}
        {count === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in">
            <Search className="w-12 h-12 text-white/20 mb-4" />
            <h3 className="text-lg text-white/60">{t('search.noResults')}</h3>
            <p className="text-sm text-white/40 mt-1">{t('search.tryAdjusting')}</p>
          </div>
        )}

        {/* Sessions List */}
        {activeTopicData && count > 0 && (
          <div className="flex flex-col">
            {activeTopicData.sessions.map((session) => {
              const hasReport = Boolean(session.summary);
              const sessionTags = session.tags || [];

              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id, session.groupId || null)}
                  className="flex items-center gap-4 py-3.5 px-1 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer group"
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

                    {/* Tags Row */}
                    {sessionTags.length > 0 ? (
                      <div className="flex items-center gap-1.5 text-xs text-white/40 truncate">
                        <Tag className="w-3.5 h-3.5 text-white/30 shrink-0" />
                        <div className="flex items-center gap-1 overflow-hidden">
                          {sessionTags.map((tag) => {
                            const isCurrent =
                              tag.trim().toLowerCase() ===
                              selectedTopic.toLowerCase();
                            return (
                              <span
                                key={tag}
                                className={`px-1.5 py-0.5 rounded text-[11px] leading-tight truncate ${
                                  isCurrent
                                    ? 'bg-brand/15 text-brand font-medium'
                                    : 'text-white/40'
                                }`}
                              >
                                {tag}
                              </span>
                            );
                          })}
                        </div>
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
  }

  // ─── Sub-view 1: Full Topics List ──────────────────────────────────────────
  const totalTopics = topicsList.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Search header if active */}
      {renderSearchBanner()}

      {/* Search No Results */}
      {activeSearch && totalTopics === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in">
          <Search className="w-12 h-12 text-white/20 mb-4" />
          <h3 className="text-lg text-white/60">{t('search.noResults')}</h3>
          <p className="text-sm text-white/40 mt-1">{t('search.tryAdjusting')}</p>
        </div>
      )}

      {/* Empty State when no topics exist without search */}
      {!activeSearch && totalTopics === 0 && (
        <div className="glass p-8 sm:p-12 text-center rounded-3xl border border-white/10 flex flex-col items-center justify-center animate-in fade-in">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-5 flex items-center justify-center">
            <div className="absolute inset-0 bg-brand/20 blur-2xl rounded-full animate-pulse" />
            <Tag className="w-12 h-12 text-brand drop-shadow-[0_0_15px_rgba(45,212,191,0.4)]" />
          </div>
          <h3 className="text-xl sm:text-2xl text-white mb-2 tracking-tight">
            {t('topics.emptyTitle')}
          </h3>
          <p className="text-sm sm:text-base text-white/50 max-w-md leading-relaxed">
            {t('topics.emptyDesc')}
          </p>
        </div>
      )}

      {/* Topics List Items */}
      {totalTopics > 0 && (
        <div className="space-y-4">
          {/* Section Summary Header */}
          <div className="flex items-center justify-between px-1 text-xs text-white/40 uppercase tracking-wider">
            <span>
              {totalTopics === 1
                ? t('topics.topicsCountSingular')
                : t('topics.topicsCountPlural', { count: totalTopics })}
            </span>
          </div>

          <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
            {topicsList.map((topic) => {
              const count = topic.count;

              return (
                <div
                  key={topic.name.toLowerCase()}
                  onClick={() => setSelectedTopic(topic.name)}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-white/[0.04] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shrink-0 group-hover:scale-105 group-hover:bg-brand/20 transition-all">
                      <Tag className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm sm:text-base font-medium text-white/90 truncate group-hover:text-brand transition-colors">
                        {topic.name}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                        <span className="shrink-0">
                          {count === 1
                            ? t('topics.sessionCountSingular')
                            : t('topics.sessionCountPlural', { count })}
                        </span>
                        <span>•</span>
                        <span className="truncate">
                          {t('topics.lastWorkedOn', {
                            relative: formatRelativeTime(topic.lastDate),
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
