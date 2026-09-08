import { Session, SessionGroup, AudioEntry, FinalReport, SessionMedia } from '../types';

export interface SearchFilters {
  all: boolean;
  folders: boolean;
  sessions: boolean;
  entries: boolean;
  transcriptions: boolean;
  reports: boolean;
  notes: boolean;
  topics: boolean;
  hasGalleryItems: boolean;
  hasAudioRecordings: boolean;
  hasConsolidatedReport: boolean;
  glossaryUsed: string | 'all';
}

export const defaultSearchFilters: SearchFilters = {
  all: true,
  folders: false,
  sessions: false,
  entries: false,
  transcriptions: false,
  reports: false,
  notes: false,
  topics: false,
  hasGalleryItems: false,
  hasAudioRecordings: false,
  hasConsolidatedReport: false,
  glossaryUsed: 'all'
};

export const normalizeSearchText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

export function performSearch(
  query: string,
  filters: SearchFilters,
  sessions: Session[],
  groups: SessionGroup[],
  audios: AudioEntry[],
  reports: FinalReport[],
  media: SessionMedia[]
): { matchedSessionIds: Set<string>, matchedGroupIds: Set<string> } {
  const matchedSessionIds = new Set<string>();
  const matchedGroupIds = new Set<string>();
  
  const normQ = normalizeSearchText(query);
  const checkQuery = (text?: any) => {
    if (!text) return false;
    if (typeof text === 'string') return normalizeSearchText(text).includes(normQ);
    if (Array.isArray(text)) return text.some(t => typeof t === 'string' && normalizeSearchText(t).includes(normQ));
    if (typeof text === 'object') return normalizeSearchText(JSON.stringify(text)).includes(normQ);
    return false;
  };

  // Pre-calculate mappings for advanced filters
  const sessionToMediaCount = new Map<string, number>();
  media.forEach(m => {
    sessionToMediaCount.set(m.sessionId, (sessionToMediaCount.get(m.sessionId) || 0) + 1);
  });

  const sessionToAudioCount = new Map<string, number>();
  audios.forEach(a => {
    sessionToAudioCount.set(a.sessionId, (sessionToAudioCount.get(a.sessionId) || 0) + 1);
  });

  const sessionToReport = new Set<string>();
  reports.forEach(r => {
    sessionToReport.add(r.sessionId);
  });

  // Basic Group matching (Folders)
  groups.forEach(group => {
    let matches = false;
    
    const hasAdvancedFilter = filters.hasGalleryItems || filters.hasAudioRecordings || filters.hasConsolidatedReport || filters.glossaryUsed !== 'all';
    
    if (normQ && (filters.all || filters.folders)) {
      if (checkQuery(group.name)) {
        if (!hasAdvancedFilter) {
          matches = true;
        }
      }
    } else if (!normQ && filters.folders && !hasAdvancedFilter) {
       matches = true;
    }

    if (matches) {
      matchedGroupIds.add(group.id);
    }
  });

  // Session matching
  sessions.forEach(session => {
    let matches = false;

    // Advanced filters (MUST match if active)
    if (filters.hasGalleryItems && (sessionToMediaCount.get(session.id) || 0) === 0) return;
    if (filters.hasAudioRecordings && (sessionToAudioCount.get(session.id) || 0) === 0) return;
    if (filters.hasConsolidatedReport && !session.summary && !sessionToReport.has(session.id)) return;
    if (filters.glossaryUsed !== 'all' && session.glossaryId !== filters.glossaryUsed) return;

    if (!normQ) {
      matches = true;
    } else {
      if (filters.all || filters.sessions) {
        if (checkQuery(session.title) || checkQuery(session.subtitle)) matches = true;
      }
      if (!matches && (filters.all || filters.topics)) {
        if (session.tags && session.tags.some(t => checkQuery(t))) matches = true;
      }
      if (!matches && (filters.all || filters.notes)) {
        if (checkQuery(session.notes)) matches = true;
      }
      
      if (!matches) {
        const sessionAudios = audios.filter(a => a.sessionId === session.id);
        const sessionReport = reports.find(r => r.sessionId === session.id);

        if (filters.all || filters.entries) {
          if (sessionAudios.some(a => checkQuery(a.filename))) matches = true;
        }
        if (!matches && (filters.all || filters.transcriptions)) {
          if (sessionAudios.some(a => checkQuery(a.transcript))) matches = true;
        }
        if (!matches && (filters.all || filters.reports)) {
          if (checkQuery(session.summary)) matches = true;
          if (sessionReport) {
            const reportData = sessionReport.report;
            if (reportData?.strictSummary && reportData.strictSummary.some((s: string) => checkQuery(s))) {
              matches = true;
            }
          }
        }
      }
    }

    if (matches) {
      matchedSessionIds.add(session.id);
      if (session.groupId) {
        matchedGroupIds.add(session.groupId);
      }
    }
  });

  return { matchedSessionIds, matchedGroupIds };
}
