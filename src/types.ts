export type Language = 'pt-BR' | 'es' | 'en' | 'auto';

// strictSummary is now a flat array of bullet point strings
export type StrictSummary = string[];

export interface ExpandedInsights {
  drills: string[];
  homework: string[];
  technicalExpansion: string[];
  emotionalNotes: string[];
}

export interface AudioEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  language: Language;
  transcript?: string;
  bulletPoints?: string[];
  strictSummary?: StrictSummary;
  expandedInsights?: ExpandedInsights;
  audioBlob?: Blob; // The recorded or uploaded audio blob
  type: 'recording' | 'upload';
  filename?: string; // Original filename if uploaded
}

export interface Session {
  id: string;
  title: string;
  subtitle?: string; // Optional subtitle (editable by user)
  date: number;
  summary?: string;
  notes?: string; // Optional user notes
  cardOrder?: string[]; // IDs of cards in preferred order
  groupId?: string; // Optional group folder ID
  glossaryId?: string; // Optional active glossary ID (or 'auto' or 'other')
  customGlossaryStyle?: string; // Optional custom style name if glossaryId is 'other'
}

export interface SessionGroup {
  id: string;
  name: string;
  dateCreated: number;
  sessionOrder?: string[]; // IDs of sessions in preferred order in this folder
  folderOrder?: string[]; // IDs of folders in preferred order
}

export interface GlossaryItem {
  canonicalTerm: string;
  variants: string[];
  category: string;
}

export interface DanceGlossary {
  id: string;
  name: string;
  terms: GlossaryItem[];
  isSystem?: boolean;
}

export interface FinalReport {
  id: string;
  sessionId: string;
  report: any; // Stored as an object from /api/gemini/process-audio, or legacy string
  timestamp: number;
}

