export type Language = 'pt-BR' | 'es' | 'en' | 'auto';

export interface AudioEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  language: Language;
  transcript?: string;
  bulletPoints?: string[];
  audioBlob?: Blob; // The recorded or uploaded audio blob
  type: 'recording' | 'upload';
  filename?: string; // Original filename if uploaded
}

export interface Session {
  id: string;
  title: string;
  date: number;
  summary?: string;
  // Previously we kept an array of ids. Now we query audios by sessionId.
}

export interface FinalReport {
  id: string;
  sessionId: string;
  report: string;
  timestamp: number;
}
