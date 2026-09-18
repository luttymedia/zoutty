import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  format,
} from 'date-fns';
import { Session } from '../types';
import { useTranslation } from '../i18n/TranslationContext';
import { HistorySessionRow } from './HistorySessionRow';

interface HistoryCalendarViewProps {
  sessions: Session[];
  onSelectSession: (sessionId: string, groupId: string | null) => void;
  onAddLesson: (targetDate?: Date) => void;
}

export const HistoryCalendarView: React.FC<HistoryCalendarViewProps> = ({
  sessions,
  onSelectSession,
  onAddLesson,
}) => {
  const { t, uiLanguage } = useTranslation();
  const locale = uiLanguage === 'es' ? 'es-ES' : 'en-US';

  // Week starts on Sunday (0) for EN, Monday (1) for ES
  const weekStartsOn = uiLanguage === 'es' ? 1 : 0;

  // Track currently viewed month and selected day
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // Index sessions by 'yyyy-MM-dd' for O(1) cell lookup
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const key = format(new Date(s.date), 'yyyy-MM-dd');
      const list = map.get(key) || [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [sessions]);

  // Generate calendar days for current month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth, weekStartsOn]);

  // Generate localized weekday column headers (e.g. SUN, MON... or LUN, MAR...)
  const weekdayHeaders = useMemo(() => {
    const sampleWeek = calendarDays.slice(0, 7);
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return sampleWeek.map((day) => formatter.format(day).toUpperCase());
  }, [calendarDays, locale]);

  // Formatted Month and Year title (e.g. "September 2026")
  const formattedMonthTitle = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
    });
    const str = formatter.format(currentMonth);
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, [currentMonth, locale]);

  // Formatted Selected Date label (e.g. "Monday, September 8, 2026")
  const formattedSelectedDate = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const str = formatter.format(selectedDate);
    return str.charAt(0).toUpperCase() + str.slice(1);
  }, [selectedDate, locale]);

  // Sessions for the currently selected date
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDateSessions = sessionsByDate.get(selectedDateKey) || [];

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const handleSelectDay = (day: Date) => {
    setSelectedDate(day);
    // If clicked day is in adjacent month, automatically switch view to that month
    if (!isSameMonth(day, currentMonth)) {
      setCurrentMonth(startOfMonth(day));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Calendar Card */}
      <div className="glass p-4 sm:p-6 rounded-3xl border border-white/10 space-y-4">
        {/* Month Navigation Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-brand/80 shrink-0" />
            <h2 className="text-base sm:text-lg font-semibold text-white/90">
              {formattedMonthTitle}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleGoToToday}
              className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              {t('history.calendarToday')}
            </button>

            <button
              type="button"
              onClick={handlePrevMonth}
              title={t('history.prevMonth')}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              type="button"
              onClick={handleNextMonth}
              title={t('history.nextMonth')}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Weekday Column Headers */}
        <div className="grid grid-cols-7 gap-1 text-center border-b border-white/5 pb-2">
          {weekdayHeaders.map((header, idx) => (
            <div
              key={idx}
              className="text-[11px] sm:text-xs font-semibold text-white/30 uppercase tracking-wider py-1"
            >
              {header}
            </div>
          ))}
        </div>

        {/* Calendar Day Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 pt-1">
          {calendarDays.map((day) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);
            const isSelected = isSameDay(day, selectedDate);
            const dayKey = format(day, 'yyyy-MM-dd');
            const daySessions = sessionsByDate.get(dayKey) || [];
            const sessionCount = daySessions.length;

            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => handleSelectDay(day)}
                className={`group relative w-full h-11 sm:h-12 flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-brand text-bg-dark font-bold shadow-lg shadow-brand/20 scale-105 z-10'
                    : isCurrentDay
                    ? 'border border-brand/60 text-brand font-semibold hover:bg-brand/10'
                    : isCurrentMonth
                    ? 'text-white/80 hover:bg-white/5 hover:text-white'
                    : 'text-white/20 hover:text-white/40'
                }`}
              >
                <span className="text-xs sm:text-sm leading-none">
                  {day.getDate()}
                </span>

                {/* Session Indicator Dots */}
                {sessionCount > 0 && (
                  <div className="absolute bottom-1.5 flex items-center justify-center gap-0.5">
                    {sessionCount === 1 && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected
                            ? 'bg-bg-dark/80'
                            : 'bg-brand shadow-[0_0_5px_rgba(45,212,191,0.8)]'
                        }`}
                      />
                    )}
                    {sessionCount === 2 && (
                      <>
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected
                              ? 'bg-bg-dark/80'
                              : 'bg-brand shadow-[0_0_5px_rgba(45,212,191,0.8)]'
                          }`}
                        />
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isSelected
                              ? 'bg-bg-dark/80'
                              : 'bg-brand shadow-[0_0_5px_rgba(45,212,191,0.8)]'
                          }`}
                        />
                      </>
                    )}
                    {sessionCount >= 3 && (
                      <>
                        <span
                          className={`w-1 h-1 rounded-full ${
                            isSelected
                              ? 'bg-bg-dark/80'
                              : 'bg-brand shadow-[0_0_5px_rgba(45,212,191,0.8)]'
                          }`}
                        />
                        <span
                          className={`w-1 h-1 rounded-full ${
                            isSelected
                              ? 'bg-bg-dark/80'
                              : 'bg-brand shadow-[0_0_5px_rgba(45,212,191,0.8)]'
                          }`}
                        />
                        <span
                          className={`w-1 h-1 rounded-full ${
                            isSelected
                              ? 'bg-bg-dark/80'
                              : 'bg-brand shadow-[0_0_5px_rgba(45,212,191,0.8)]'
                          }`}
                        />
                      </>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Inspector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1 border-b border-white/5 pb-2">
          <h3 className="text-sm sm:text-base font-medium text-white/90">
            {formattedSelectedDate}
          </h3>
          <span className="text-xs text-white/40 font-normal">
            {selectedDateSessions.length === 1
              ? t('history.lessonsOnDateSingular')
              : t('history.lessonsOnDateCount', { count: selectedDateSessions.length })}
          </span>
        </div>

        {selectedDateSessions.length > 0 ? (
          <div className="divide-y-2 divide-bg-dark rounded-2xl bg-white/[0.05] overflow-hidden">
            {selectedDateSessions.map((session) => (
              <HistorySessionRow
                key={session.id}
                session={session}
                isSingleDemoSession={session.isDemo && sessions.length === 1}
                onSelectSession={onSelectSession}
              />
            ))}
          </div>
        ) : (
          <div className="py-10 px-4 text-center rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center animate-in fade-in">
            <p className="text-xs sm:text-sm text-white/40 mb-3">
              {t('history.noLessonsOnDate')}
            </p>
            <button
              type="button"
              onClick={() => onAddLesson(selectedDate)}
              className="px-4 py-2 bg-brand/10 hover:bg-brand/20 text-brand text-xs font-semibold rounded-full border border-brand/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{t('history.logLessonOnDate')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
