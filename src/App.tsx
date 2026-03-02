import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Mic,
  Square,
  Upload,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  FileAudio,
  Wand2,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  Sparkles,
  Edit2,
  Globe,
  Download,
  Zap,
  GripHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import { db } from './lib/db';
import { callZoukAudioProcessor } from './lib/mcp';
import { Session, AudioEntry, Language, StrictSummary, ExpandedInsights } from './types';
import { ZouttyIcon } from './components/ZouttyIcon';
import Markdown from 'react-markdown';
import { exportDocx } from './lib/exportDocx';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { version } from './version';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        const b64 = (reader.result as string).split(',')[1];
        resolve(b64);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- Toast & Spinner Components ---
function Toast({ message, isError, actionText, onAction, onClose }: { message: string, isError: boolean, actionText?: string, onAction?: () => void, onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000); // 5s for undo
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white font-medium text-sm z-50 shadow-lg flex items-center gap-3 transition-all animate-in slide-in-from-bottom-5 ${isError ? 'bg-red-600' : 'bg-green-600'}`}>
      <span>{message}</span>
      {actionText && onAction && (
        <button onClick={() => { onAction(); onClose(); }} className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shrink-0">
          {actionText}
        </button>
      )}
    </div>
  );
}

function Spinner({ text }: { text: string }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-white font-sans">
      <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
      <span className="mt-4 font-medium">{text}</span>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [audioEntries, setAudioEntries] = useState<Record<string, AudioEntry>>({});

  const [toastMessage, setToastMessage] = useState<{ text: string, isError: boolean, actionText?: string, onAction?: () => void } | null>(null);
  const [spinnerText, setSpinnerText] = useState<string | null>(null);

  const [deleteModal, setDeleteModal] = useState<{ id: string, type: 'session' | 'audio', title: string } | null>(null);
  const [reprocessModal, setReprocessModal] = useState<string | null>(null);
  const [showVersionModal, setShowVersionModal] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Listen for beforeinstallprompt for PWA install button
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('beforeinstallprompt event fired');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Load from IndexedDB on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const loadedSessions = await db.getSessions();
        const loadedAudios = await db.getAudioEntries();

        // Sort sessions by date descending
        loadedSessions.sort((a, b) => b.date - a.date);
        setSessions(loadedSessions);

        // Convert audio entries array to record for easy lookup
        const audioRecord: Record<string, AudioEntry> = {};
        loadedAudios.forEach(a => audioRecord[a.id] = a);
        setAudioEntries(audioRecord);
      } catch (err) {
        console.error("Failed to load IndexedDB", err);
        showToast("Failed to load app data", true);
      }
    };
    loadData();
  }, []);

  const showToast = (text: string, isError = false, actionText?: string, onAction?: () => void) => setToastMessage({ text, isError, actionText, onAction });
  const showSpinner = (text: string) => setSpinnerText(text);
  const hideSpinner = () => setSpinnerText(null);

  // Migration: Update old session titles to new format
  useEffect(() => {
    const migrateTitles = async () => {
      // Matches "Fri, Feb 27, 2026"
      const oldFormatRegex = /^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}, \d{4}$/;
      const needsMigration = sessions.filter(s => oldFormatRegex.test(s.title));

      if (needsMigration.length > 0) {
        console.log(`[Migration] Updating ${needsMigration.length} session titles to new format`);
        const updatedSessions = [...sessions];
        let changed = false;

        for (const session of needsMigration) {
          const newTitle = format(new Date(session.date), "EEE dd/MM/yy");
          const idx = updatedSessions.findIndex(s => s.id === session.id);
          if (idx !== -1) {
            updatedSessions[idx] = { ...updatedSessions[idx], title: newTitle };
            await db.saveSession(updatedSessions[idx]);
            changed = true;
          }
        }

        if (changed) {
          setSessions(updatedSessions);
        }
      }
    };
    if (sessions.length > 0) {
      migrateTitles();
    }
  }, [sessions.length > 0]); // Run once when sessions are loaded

  // Migration 2: Retroactively clean up old technical summaries from audio clips
  // Now that consolidation handles all summaries, we want old individual clips to just show transcripts
  useEffect(() => {
    const cleanOldAudioEntries = async () => {
      const keys = Object.keys(audioEntries);
      if (keys.length === 0) return;

      let changedCount = 0;
      const updatedEntries = { ...audioEntries };

      for (const id of keys) {
        const entry: any = updatedEntries[id];
        let needsSave = false;

        // Remove old shape keys if present
        if (entry.strictSummary) { delete entry.strictSummary; needsSave = true; }
        if (entry.expandedInsights) { delete entry.expandedInsights; needsSave = true; }
        if (entry.processedData) { delete entry.processedData; needsSave = true; }
        if (entry.bulletPoints) { delete entry.bulletPoints; needsSave = true; }

        if (needsSave) {
          await db.saveAudioEntry(entry);
          changedCount++;
        }
      }

      if (changedCount > 0) {
        console.log(`[Migration] Cleaned up legacy summary data from ${changedCount} audio entries`);
        setAudioEntries(updatedEntries);
      }
    };

    cleanOldAudioEntries();
  }, [Object.keys(audioEntries).length > 0]); // Trigger once entries load


  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  // --- Actions ---

  const createSession = async () => {
    const newSession: Session = {
      id: crypto.randomUUID(),
      title: format(new Date(), "EEE dd/MM/yy"),
      subtitle: '',
      date: Date.now(),
    };

    await db.saveSession(newSession);

    setSessions(prev => [newSession, ...prev]);
    setSelectedSessionId(newSession.id);
    setView('detail');
  };

  const updateSession = async (id: string, changes: Partial<Pick<Session, 'title' | 'subtitle' | 'notes'>>) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    const updated = { ...session, ...changes };
    await db.saveSession(updated);
    setSessions(prev => prev.map(s => s.id === id ? updated : s));
  };

  const updateAudioEntry = async (id: string, changes: Partial<AudioEntry>) => {
    const entry = audioEntries[id];
    if (!entry) return;
    const updated = { ...entry, ...changes };
    await db.saveAudioEntry(updated);
    setAudioEntries(prev => ({ ...prev, [id]: updated }));
  };

  const handleUndo = (id: string, type: 'session' | 'audio', data: any, extraData: any, timeoutId: NodeJS.Timeout) => {
    clearTimeout(timeoutId);
    if (type === 'session') {
      setSessions(prev => [data, ...prev].sort((a, b) => b.date - a.date));
      const audios = extraData as AudioEntry[];
      if (audios) {
        setAudioEntries(prev => {
          const copy = { ...prev };
          audios.forEach(a => copy[a.id] = a);
          return copy;
        });
      }
    } else {
      setAudioEntries(prev => ({ ...prev, [id]: data }));
    }
    showToast('Action undone');
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    const { id, type, title } = deleteModal;
    setDeleteModal(null);

    if (type === 'session') {
      const sessionToDelete = sessions.find(s => s.id === id);
      if (!sessionToDelete) return;

      const sessionAudios = await db.getSessionAudios(id);

      setSessions(prev => prev.filter(s => s.id !== id));
      const newEntries = { ...audioEntries };
      sessionAudios.forEach(a => delete newEntries[a.id]);
      setAudioEntries(newEntries);

      if (selectedSessionId === id) {
        setView('list');
        setSelectedSessionId(null);
      }

      const timeoutId = setTimeout(async () => {
        for (const audio of sessionAudios) await db.deleteAudioEntry(audio.id);
        await db.deleteSession(id);
      }, 5000);

      showToast('Session deleted', false, 'Undo', () => handleUndo(id, type, sessionToDelete, sessionAudios, timeoutId));

    } else {
      const audioToDelete = audioEntries[id];
      if (!audioToDelete) return;

      setAudioEntries(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      const timeoutId = setTimeout(async () => {
        await db.deleteAudioEntry(id);
      }, 5000);

      showToast('Audio deleted', false, 'Undo', () => handleUndo(id, type, audioToDelete, null, timeoutId));
    }
  };

  const requestDeleteSession = (id: string, title: string) => setDeleteModal({ id, type: 'session', title });
  const requestDeleteAudio = (id: string, title: string) => setDeleteModal({ id, type: 'audio', title });

  const confirmReprocess = () => {
    if (!reprocessModal) return;
    const idToProcess = reprocessModal;
    setReprocessModal(null);
    handleProcessEntry(idToProcess);
  };

  const addAudioEntry = async (sessionId: string, blob: Blob, language: Language, type: 'recording' | 'upload', filename?: string) => {
    const entryId = crypto.randomUUID();

    const newEntry: AudioEntry = {
      id: entryId,
      sessionId,
      timestamp: Date.now(),
      language,
      type,
      filename,
      audioBlob: blob,
    };

    // Save to IndexedDB and update UI
    await db.saveAudioEntry(newEntry);
    setAudioEntries(prev => ({ ...prev, [entryId]: newEntry }));
    showToast(filename ? `[${filename}] added!` : 'Audio added!');
  };

  const handleProcessEntry = async (entryId: string) => {
    const entry = audioEntries[entryId];
    if (!entry || !entry.audioBlob) return;

    try {
      setProcessingIds(prev => new Set(prev).add(entryId));
      showSpinner(`Processing ${entry.filename || 'audio'}...`);

      // Call MCP Skill
      const result: any = await callZoukAudioProcessor({
        audio: entry.audioBlob,
        language: entry.language,
        sessionId: entry.sessionId,
        filename: entry.filename
      });

      // Update entry with result
      const finalizedEntry: any = {
        ...entry,
        ...result
      };

      console.log('[handleProcessEntry] Finalized entry structure - hasStrictSummary:', !!(finalizedEntry as any).strictSummary, '| hasTranscript:', !!(finalizedEntry as any).transcript);
      await db.saveAudioEntry(finalizedEntry);
      setAudioEntries(prev => ({ ...prev, [entryId]: finalizedEntry }));

      showToast(entry.filename ? `[${entry.filename}] processed!` : 'Audio processed!');
    } catch (error) {
      console.error('Processing failed:', error);
      showToast(entry.filename ? `[${entry.filename}] failed to process` : 'Processing failed', true);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
      hideSpinner();
    }
  };

  // `deleteAudioEntry` has moved to `requestDeleteAudio` & `confirmDelete`.

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, language: Language) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedSession) return;

    for (const file of files) {
      await addAudioEntry(selectedSession.id, file, language, 'upload', file.name);
    }
    // reset input
    e.target.value = '';
  };

  const handleConsolidate = async () => {
    if (!selectedSession) return;
    showSpinner('Consolidating session...');
    try {
      const sessionAudios = await db.getSessionAudios(selectedSession.id);

      if (sessionAudios.length === 0) {
        showToast('No audio data found for current session', true);
        return;
      }

      // Prepare payload: send transcript if available, otherwise send base64 audio
      const audiosPayload = await Promise.all(
        sessionAudios.map(async (a) => {
          if (a.transcript) {
            return {
              audioId: a.id,
              transcript: a.transcript
            };
          }
          const b64 = await blobToBase64(a.audioBlob);
          return {
            audioId: a.id,
            base64: b64,
            language: a.language,
            mimeType: a.audioBlob.type || 'audio/webm'
          };
        })
      );

      const response = await fetch('/api/gemini/process-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          audios: audiosPayload
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to process audio on backend. Status: ${response.status}`);
      }

      const { report: reportResult, newTranscripts } = await response.json();
      console.log('[handleConsolidate] API response:', {
        hasReport: !!reportResult,
        newTranscriptsCount: newTranscripts ? Object.keys(newTranscripts).length : 0
      });

      // Update individual entries if new transcripts were generated
      if (newTranscripts && Object.keys(newTranscripts).length > 0) {
        for (const [audioId, text] of Object.entries(newTranscripts)) {
          const entry = audioEntries[audioId];
          if (entry) {
            const updated = { ...entry, transcript: text as string };
            await db.saveAudioEntry(updated);
            setAudioEntries(prev => ({ ...prev, [audioId]: updated }));
          }
        }
      }

      await db.saveFinalReport({
        id: crypto.randomUUID(),
        sessionId: selectedSession.id,
        report: reportResult,
        timestamp: Date.now()
      });

      // Update session summary
      const updatedSession = { ...selectedSession, summary: reportResult };
      await db.saveSession(updatedSession);
      setSessions(prev => prev.map(s => s.id === selectedSession.id ? updatedSession : s));

      showToast('Session consolidated!');
    } catch (error) {
      console.error('Consolidation failed:', error);
      showToast('Consolidation failed', true);
    } finally {
      hideSpinner();
    }
  };

  // --- Renderers ---
  return (
    <div className="min-h-screen font-sans selection:bg-brand/30">
      {spinnerText && <Spinner text={spinnerText} />}
      {toastMessage && <Toast message={toastMessage.text} isError={toastMessage.isError} actionText={toastMessage.actionText} onAction={toastMessage.onAction} onClose={() => setToastMessage(null)} />}

      {/* Delete Modal */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold">Confirm Deletion</h3>
            <p className="text-white/70">
              Are you sure you want to delete {deleteModal.type === 'session' ? 'the session' : 'this audio'}: <strong className="text-white">{deleteModal.title}</strong>?
            </p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button onClick={() => setDeleteModal(null)} className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]">Cancel</button>
              <button onClick={confirmDelete} className="px-5 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 text-white min-h-[44px]">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Reprocess Modal */}
      {reprocessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-6 h-6 text-brand" />
              Confirm Reprocess
            </h3>
            <p className="text-white/70">
              Are you sure you want to reprocess this audio clip? This will overwrite the previous processing.
            </p>
            <div className="flex gap-3 justify-end items-center mt-6">
              <button onClick={() => setReprocessModal(null)} className="px-5 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]">Cancel</button>
              <button onClick={confirmReprocess} className="px-5 py-2.5 rounded-xl font-bold bg-brand hover:bg-brand/90 transition-colors shadow-lg shadow-brand/30 text-black min-h-[44px]">Reprocess</button>
            </div>
          </div>
        </div>
      )}

      {/* Version Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6">
          <div className="glass p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95 text-center relative">
            <ZouttyIcon className="w-16 h-16 text-brand mx-auto" />
            <h3 className="text-xs uppercase tracking-[0.2em] text-brand font-bold mt-2">ZOUTTY</h3>
            <p className="inline-block mt-2 px-4 py-1 bg-white/10 text-white/70 font-mono font-medium rounded-full border border-white/20 text-sm tracking-widest">
              v{version}
            </p>
            <div className="flex justify-center mt-8">
              <button
                onClick={() => setShowVersionModal(false)}
                className="px-8 py-2.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header className="px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view === 'detail' && (
            <button
              onClick={() => setView('list')}
              className="w-10 h-10 flex items-center justify-center glass rounded-full hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <button
            onClick={() => setShowVersionModal(true)}
            className="hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-xl"
            title="Show App Version"
          >
            <ZouttyIcon className="w-10 h-10 text-brand shrink-0" />
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand font-bold">Zoutty</p>
            <h1 className="text-lg font-bold tracking-tight">
              Session Notes
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {view === 'detail' && selectedSession && (
            <button
              onClick={async () => {
                showSpinner('Generating document...');
                try {
                  const report = await db.getSessionFinalReport(selectedSession.id);
                  const sessionEntries = Object.values(audioEntries).filter(e => e.sessionId === selectedSession.id).sort((a, b) => b.timestamp - a.timestamp);
                  await exportDocx(selectedSession, sessionEntries, report);
                  showToast('Document exported successfully!');
                } catch (err) {
                  console.error(err);
                  showToast('Failed to export document', true);
                } finally {
                  hideSpinner();
                }
              }}
              className="w-10 h-10 flex items-center justify-center glass rounded-full hover:bg-brand/20 text-brand transition-colors"
              title="Export to Word"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
          {deferredPrompt && (
            <button
              onClick={async () => {
                if (!deferredPrompt) return;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                if (outcome === 'accepted') {
                  setDeferredPrompt(null);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-brand/10 hover:bg-brand/20 text-brand font-bold rounded-xl border border-brand/20 transition-all font-sans text-sm shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pb-32">
        {view === 'list' ? (
          <div className="space-y-8">
            <button
              onClick={createSession}
              className="w-full py-6 glass bg-brand/10 border-brand/20 text-brand font-bold text-lg flex items-center justify-center gap-3 hover:bg-brand/20 transition-all shadow-lg glow-brand"
            >
              <Plus className="w-6 h-6" />
              New Session
            </button>

            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white/30">Recent Sessions</h2>
              {sessions.length === 0 ? (
                <div className="glass p-12 text-center text-white/20">
                  <FileAudio className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No sessions yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {sessions.map(session => (
                    <div
                      key={session.id}
                      onClick={() => {
                        setSelectedSessionId(session.id);
                        setView('detail');
                      }}
                      className="glass p-5 flex items-center gap-4 hover:bg-white/5 transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                        <FileAudio className="w-6 h-6 text-brand" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold truncate text-white">{session.title}</h3>
                        <p className="text-xs text-white/40 mt-1 truncate">{session.subtitle || 'Zouk Lesson'}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteSession(session.id, session.title);
                        }}
                        className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors flex items-center gap-2 min-h-[44px] min-w-[44px]"
                      >
                        <Trash2 className="w-5 h-5 shrink-0" />
                        <span className="text-sm font-bold hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : selectedSession && (
          <SessionDetail
            session={selectedSession}
            entries={Object.values(audioEntries).filter(e => e.sessionId === selectedSession.id).sort((a, b) => b.timestamp - a.timestamp)}
            processingIds={processingIds}
            onRecording={(blob, lang) => addAudioEntry(selectedSession.id, blob, lang, 'recording')}
            onUpload={(e, lang) => handleFileUpload(e, lang)}
            onConsolidate={handleConsolidate}
            onUpdateSession={(changes) => updateSession(selectedSession.id, changes)}
            onUpdateEntry={updateAudioEntry}
            onDeleteEntry={(id) => requestDeleteAudio(id, 'Audio Entry')}
            onProcessEntry={handleProcessEntry}
            onRequestReprocess={(id) => setReprocessModal(id)}
            onError={(msg) => showToast(msg, true)}
          />
        )}
      </main>
    </div>
  );
}

// --- Sub-Components ---

function SessionDetail({
  session,
  entries,
  processingIds,
  onRecording,
  onUpload,
  onConsolidate,
  onUpdateSession,
  onUpdateEntry,
  onDeleteEntry,
  onProcessEntry,
  onRequestReprocess,
  onError
}: {
  session: Session;
  entries: AudioEntry[];
  processingIds: Set<string>;
  onRecording: (blob: Blob, lang: Language) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, lang: Language) => void;
  onConsolidate: () => void;
  onUpdateSession: (changes: Partial<Pick<Session, 'title' | 'subtitle' | 'notes' | 'cardOrder'>>) => void;
  onUpdateEntry: (id: string, changes: Partial<AudioEntry>) => void;
  onDeleteEntry: (entryId: string) => void;
  onProcessEntry: (entryId: string) => Promise<void>;
  onRequestReprocess: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0); // 0..1 live mic energy
  const [language, setLanguage] = useState<Language>('auto');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(session.title);
  const [isEditingSubtitle, setIsEditingSubtitle] = useState(false);
  const [tempSubtitle, setTempSubtitle] = useState(session.subtitle ?? '');
  const [isReordering, setIsReordering] = useState(false);
  const [isNoteVisible, setIsNoteVisible] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 }
      });

      // Live mic level meter via AudioContext analyser
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setMicLevel(Math.min(1, rms * 6)); // scale so normal speech hits 0.4–0.8
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      animFrameRef.current = requestAnimationFrame(updateLevel);

      // Pick the best supported MIME type so the Blob type is accurate
      const preferredMime = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ].find(t => MediaRecorder.isTypeSupported(t)) || '';
      console.log('[MediaRecorder] Preferred mimeType:', preferredMime || '(browser default)');

      mediaRecorder.current = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : {});
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
          console.log('[MediaRecorder] chunk received, size:', event.data.size, 'total chunks:', audioChunks.current.length);
        }
      };

      mediaRecorder.current.onstop = () => {
        const actualMime = mediaRecorder.current?.mimeType || preferredMime || 'audio/webm';
        // Use plain audio/webm for blob type — codec specifier can confuse some browsers during playback
        const blobType = actualMime.split(';')[0] || 'audio/webm';
        console.log('[MediaRecorder] Actual mimeType after stop:', actualMime);
        console.log('[MediaRecorder] Total chunks:', audioChunks.current.length);
        const audioBlob = new Blob(audioChunks.current, { type: blobType });
        console.log('[MediaRecorder] Blob size:', audioBlob.size, 'type:', audioBlob.type);
        onRecording(audioBlob, language);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start(250); // 250ms timeslice — guarantees chunks are written regularly
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      onError('Microphone access denied or not available.');
    }
  };

  const stopRecording = () => {
    if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    setMicLevel(0);
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  const handleSubtitleSubmit = () => {
    onUpdateSession({ subtitle: tempSubtitle.trim() });
    setIsEditingSubtitle(false);
  };

  const handleTitleSubmit = () => {
    if (tempTitle.trim() && tempTitle.trim() !== session.title) {
      onUpdateSession({ title: tempTitle.trim() });
    } else {
      setTempTitle(session.title);
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Session Header: date (white) + optional editable subtitle */}
      <div>
        {/* Date line — always shown, white, bold */}
        {isEditingTitle ? (
          <input
            autoFocus
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSubmit(); if (e.key === 'Escape') { setTempTitle(session.title); setIsEditingTitle(false); } }}
            className="bg-transparent text-xl font-bold text-white outline-none w-full py-0.5"
          />
        ) : (
          <p
            className="text-xl font-bold text-white cursor-text hover:text-white/80 transition-colors flex items-center gap-2 group w-max"
            onClick={() => { setTempTitle(session.title); setIsEditingTitle(true); }}
            title="Edit title"
          >
            {session.title}
            <Edit2 className="w-4 h-4 text-brand opacity-0 group-hover:opacity-80 transition-opacity shrink-0 cursor-pointer" />
          </p>
        )}

        {/* Subtitle line — editable, optional */}
        {isEditingSubtitle ? (
          <div className="flex items-center gap-2 mt-2">
            <input
              autoFocus
              placeholder="Add a subtitle…"
              value={tempSubtitle}
              onChange={(e) => setTempSubtitle(e.target.value)}
              onBlur={handleSubtitleSubmit}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubtitleSubmit(); if (e.key === 'Escape') setIsEditingSubtitle(false); }}
              className="bg-transparent text-sm text-white/40 outline-none border-b border-brand/50 w-full py-0.5 placeholder:text-white/20"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between mt-1.5">
            <button
              onClick={() => setIsEditingSubtitle(true)}
              className="text-sm text-white/40 hover:text-white/60 transition-colors text-left flex items-center gap-2 group"
            >
              {session.subtitle ? (
                <span>{session.subtitle}</span>
              ) : (
                <span className="italic text-white/20 group-hover:text-white/40">Zouk Lesson</span>
              )}
              <Edit2 className="w-3.5 h-3.5 text-brand opacity-0 group-hover:opacity-80 transition-opacity shrink-0" />
            </button>
            <button
              onClick={() => setIsReordering(!isReordering)}
              className={`p-2 rounded-xl border transition-colors flex items-center justify-center ${isReordering ? 'bg-brand/20 border-brand text-brand shadow-sm shadow-brand/20' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/80'}`}
              title={isReordering ? "Disable reorder mode" : "Enable reorder mode"}
            >
              <GripHorizontal className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div id="sessionDetailContent" className="mt-8">
        <SessionStructuredData
          sessionId={session.id}
          entries={entries}
          processingIds={processingIds}
          isReordering={isReordering}
          onUpdateEntry={onUpdateEntry}
          onDeleteEntry={onDeleteEntry}
          onProcessEntry={onProcessEntry}
          onRequestReprocess={onRequestReprocess}
          cardOrder={session.cardOrder}
          onUpdateOrder={(newOrder) => onUpdateSession({ cardOrder: newOrder })}
          sessionNotes={session.notes}
          onUpdateNotes={(newNotes) => onUpdateSession({ notes: newNotes })}
        />
      </div>

      {/* Notes Section moved into SessionStructuredData for reorderability */}

      {/* Controls - Floating at bottom */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 glass p-4 rounded-full flex items-center justify-center gap-4 sm:gap-6 shadow-2xl z-40 border border-white/10 bg-black/60 backdrop-blur-md">

        <CustomLanguagePicker language={language} setLanguage={setLanguage} />

        <label
          className="cursor-pointer flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded-full transition-colors shadow-sm"
        >
          <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
          <input id="uploadBtn" type="file" accept="audio/*" multiple className="hidden" onChange={(e) => onUpload(e, language)} />
        </label>

        <button
          id="recordBtn"
          onClick={isRecording ? stopRecording : startRecording}
          style={isRecording ? {
            boxShadow: `0 0 0 ${4 + micLevel * 16}px rgba(239,68,68,${0.3 + micLevel * 0.6})`
          } : {}}
          className={`flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full font-bold transition-all shadow-lg ${isRecording
            ? 'bg-red-500 text-white'
            : 'bg-brand text-bg-dark hover:bg-brand/90 glow-brand scale-110'
            }`}
          title={isRecording ? `Mic level: ${Math.round(micLevel * 100)}%` : 'Start recording'}
        >
          {isRecording ? <Square className="w-6 h-6 sm:w-8 sm:h-8 fill-current" /> : <Mic className="w-7 h-7 sm:w-10 sm:h-10" />}
        </button>

        <button
          id="consolidateBtn"
          onClick={onConsolidate}
          disabled={entries.length === 0}
          className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-20 transition-colors rounded-full shadow-sm disabled:cursor-not-allowed"
        >
          <Wand2 className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>
    </div>
  );
}

// ─── New display helpers ───────────────────────────────────────────────────

function EditableText({ value, onChange, className, multiline = false }: { value: string, onChange: (v: string) => void, className?: string, multiline?: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleSubmit = () => {
    if (tempValue.trim() !== value.trim()) {
      onChange(tempValue);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleSubmit}
          className={`w-full bg-black/40 text-white/90 p-3 rounded-xl border border-brand/50 outline-none focus:border-brand transition-colors resize-y min-h-[100px] text-sm ${className || ''}`}
        />
      );
    }
    return (
      <input
        autoFocus
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') { setTempValue(value); setIsEditing(false); }
        }}
        className={`w-full bg-black/40 text-white/90 p-2 rounded-lg border border-brand/50 outline-none focus:border-brand transition-colors text-sm ${className || ''}`}
      />
    );
  }

  return (
    <div
      onClick={(e) => { e.stopPropagation(); setTempValue(value); setIsEditing(true); }}
      className={`cursor-text hover:bg-white/5 rounded px-1 -mx-1 transition-colors group relative w-full ${className || ''}`}
      title="Click to edit"
    >
      <div className="whitespace-pre-wrap w-full">{value}</div>
      <Edit2 className="w-3.5 h-3.5 text-brand opacity-0 group-hover:opacity-60 absolute top-1 right-1" />
    </div>
  );
}

function CollapsiblePanel({ title, children, defaultOpen = true, accent = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean; accent?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border overflow-hidden ${accent ? 'border-brand/30' : 'border-white/10'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${accent ? 'bg-brand/10 hover:bg-brand/15' : 'bg-white/5 hover:bg-white/10'}`}
      >
        <span className={`text-xs font-bold uppercase tracking-widest ${accent ? 'text-brand' : 'text-white/50'}`}>{title}</span>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-2">{children}</div>}
    </div>
  );
}

function BulletList({ items, onChange }: { items: string[], onChange?: (newItems: string[]) => void }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="space-y-2 mt-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-white/80">
          <div className="w-4 h-4 rounded-full bg-brand/20 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-3 h-3 text-brand" />
          </div>
          <div className="flex-1 w-full min-w-0 pr-2">
            {onChange ? (
              <EditableText
                value={item}
                multiline={true}
                onChange={(newVal) => {
                  const copy = [...items];
                  if (!newVal.trim()) {
                    copy.splice(i, 1);
                  } else {
                    copy[i] = newVal;
                  }
                  onChange(copy);
                }}
              />
            ) : (
              <span>{item}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StrictSummaryBlock({ data, onChange }: { data: string[], onChange?: (newItems: string[]) => void }) {
  if (!data || data.length === 0) return <p className="text-white/30 italic text-sm">No strict summary content extracted.</p>;
  return <BulletList items={data} onChange={onChange} />;
}

function ExpandedInsightsBlock({ data, onChange }: { data: ExpandedInsights, onChange?: (newData: ExpandedInsights) => void }) {
  const allEmpty =
    (data.drills?.length ?? 0) === 0 &&
    (data.homework?.length ?? 0) === 0 &&
    (data.technicalExpansion?.length ?? 0) === 0 &&
    (data.emotionalNotes?.length ?? 0) === 0;
  if (allEmpty) return null;

  const handleChange = (key: keyof ExpandedInsights, newItems: string[]) => {
    if (onChange) onChange({ ...data, [key]: newItems });
  };

  return (
    <div className="border border-purple-500/20 rounded-2xl overflow-hidden">
      <details>
        <summary className="px-5 py-3 cursor-pointer flex items-center gap-3 bg-purple-500/10 hover:bg-purple-500/15 transition-colors list-none">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="font-bold text-purple-300 text-sm">Expanded Insights (AI Enhanced)</span>
          <ChevronDown className="w-4 h-4 text-purple-400/50 ml-auto" />
        </summary>
        <div className="p-4 space-y-3 bg-black/20">
          {(data.drills?.length ?? 0) > 0 && <CollapsiblePanel title="Drills" defaultOpen={false}><BulletList items={data.drills} onChange={onChange ? (arr) => handleChange('drills', arr) : undefined} /></CollapsiblePanel>}
          {(data.homework?.length ?? 0) > 0 && <CollapsiblePanel title="Homework" defaultOpen={false}><BulletList items={data.homework} onChange={onChange ? (arr) => handleChange('homework', arr) : undefined} /></CollapsiblePanel>}
          {(data.technicalExpansion?.length ?? 0) > 0 && <CollapsiblePanel title="Technical Expansion" defaultOpen={false}><BulletList items={data.technicalExpansion} onChange={onChange ? (arr) => handleChange('technicalExpansion', arr) : undefined} /></CollapsiblePanel>}
          {(data.emotionalNotes?.length ?? 0) > 0 && <CollapsiblePanel title="Emotional Notes" defaultOpen={false}><BulletList items={data.emotionalNotes} onChange={onChange ? (arr) => handleChange('emotionalNotes', arr) : undefined} /></CollapsiblePanel>}
        </div>
      </details>
    </div>
  );
}

function TranscriptBlock({ text, onChange }: { text: string, onChange?: (newText: string) => void }) {
  if (!text) return null;
  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden">
      <details>
        <summary className="px-5 py-3 cursor-pointer flex items-center gap-3 bg-white/5 hover:bg-white/8 transition-colors list-none">
          <FileAudio className="w-4 h-4 text-white/40 shrink-0" />
          <span className="font-bold text-white/50 text-sm">View Transcript</span>
          <ChevronDown className="w-4 h-4 text-white/20 ml-auto" />
        </summary>
        <div className="p-4 bg-black/20 text-white/50 text-sm italic leading-relaxed">
          {onChange ? (
            <EditableText value={text} onChange={onChange} multiline={true} className="whitespace-pre-wrap block" />
          ) : (
            <span className="whitespace-pre-wrap">{text}</span>
          )}
        </div>
      </details>
    </div>
  );
}

function SortableCard({ id, children, isDraggable = true, isReordering = false }: { id: string; children: React.ReactNode; isDraggable?: boolean; isReordering?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isDraggable || !isReordering });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.9 : 1,
    position: 'relative' as const,
    ...(isReordering ? { touchAction: 'none' } : {})
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDraggable && isReordering ? attributes : {})}
      {...(isDraggable && isReordering ? listeners : {})}
      className={isDragging ? 'shadow-2xl scale-[1.02] cursor-grabbing ring-2 ring-brand rounded-2xl bg-[#141414]' : (isDraggable && isReordering ? 'cursor-grab touch-none active:scale-[0.99] transition-all ring-2 ring-brand/40 bg-brand/5 rounded-2xl' : 'transition-all')}
    >
      <div className={isDraggable && isReordering && !isDragging ? 'opacity-80 pointer-events-none' : ''}>
        {children}
      </div>
    </div>
  );
}

// ─── Session Structured Data ────────────────────────────────────────────────

function SessionStructuredData({ sessionId, entries, processingIds, isReordering, onUpdateEntry, onDeleteEntry, onProcessEntry, onRequestReprocess, cardOrder, onUpdateOrder, sessionNotes, onUpdateNotes }: { sessionId: string; entries: AudioEntry[]; processingIds: Set<string>; isReordering: boolean; onUpdateEntry: (id: string, changes: Partial<AudioEntry>) => void; onDeleteEntry: (id: string) => void; onProcessEntry: (id: string) => Promise<void>; onRequestReprocess: (id: string) => void; cardOrder?: string[]; onUpdateOrder: (newOrder: string[]) => void; sessionNotes?: string; onUpdateNotes: (newNotes: string) => void }) {
  const [report, setReport] = useState<any | null>(null);
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [isConsolidatedOpen, setIsConsolidatedOpen] = useState(false);
  const [isNoteVisible, setIsNoteVisible] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const dbReport = await db.getSessionFinalReport(sessionId);
        setReport(dbReport || null);
      } catch (err) {
        console.error('Failed to load generic content for session', err);
      }
    };
    load();
    const intervalId = setInterval(load, 2000);
    return () => clearInterval(intervalId);
  }, [sessionId]);

  const isEntryOpen = (id: string) => openStates[id] ?? false;
  const toggleEntry = (id: string) => setOpenStates(prev => ({ ...prev, [id]: !prev[id] }));

  // Parse consolidated report — new shape takes priority, falls back to legacy
  let consolidatedStrictSummary: string[] | null = null;
  let consolidatedExpanded: ExpandedInsights | null = null;
  let consolidatedTranscripts: string | null = null;
  let legacyReportContent: any = null;

  if (report?.report) {
    let r = report.report;
    if (typeof r === 'string') {
      try { r = JSON.parse(r); } catch (e) { r = { RawSummary: r }; }
    }
    if (typeof r === 'object' && r !== null) {
      if (Array.isArray(r.strictSummary)) {
        consolidatedStrictSummary = r.strictSummary as string[];
        consolidatedExpanded = (r.expandedInsights ?? { drills: [], homework: [], technicalExpansion: [], emotionalNotes: [] }) as ExpandedInsights;
        if (r.transcripts && Array.isArray(r.transcripts)) {
          consolidatedTranscripts = r.transcripts.map((t: any) => t.text || '').join('\n\n---\n\n');
        }
      } else {
        // Legacy shape
        const legacyKeys = ['summary', 'homework', 'drills', 'coreConcepts', 'emotionalThemes', 'crossSessionPatterns', 'prioritiesNextLesson'];
        const contentToRender: any = {};
        if (r.transcripts) consolidatedTranscripts = r.transcripts.map((t: any) => t.text || '').join('\n\n---\n\n');
        legacyKeys.forEach(k => {
          if (r[k]) {
            if (Array.isArray(r[k]) && r[k].length > 0 && r[k][0]?.bullet) {
              contentToRender[k] = r[k].map((item: any) => item.bullet);
            } else {
              contentToRender[k] = r[k];
            }
          }
        });
        if (Object.keys(contentToRender).length === 0 && !r.transcripts) Object.assign(contentToRender, r);
        if (Object.keys(contentToRender).length > 0) legacyReportContent = contentToRender;
      }
    }
  }

  const hasConsolidated = consolidatedStrictSummary || legacyReportContent;

  const handleUpdateConsolidated = async (key: string, newValue: any) => {
    if (!report || !report.report || typeof report.report !== 'object') return;
    const newReportData = { ...report.report, [key]: newValue };
    const newDbReport = { ...report, report: newReportData };
    setReport(newDbReport);
    try { await db.saveFinalReport(newDbReport); } catch (e) { console.error(e); }
  };

  const handleUpdateConsolidatedTranscripts = async (newText: string) => {
    if (!report || !report.report || typeof report.report !== 'object') return;
    const newReportData = { ...report.report, transcripts: [{ text: newText }] };
    const newDbReport = { ...report, report: newReportData };
    setReport(newDbReport);
    try { await db.saveFinalReport(newDbReport); } catch (e) { console.error(e); }
  };

  const handleUpdateLegacyConsolidated = async (newObj: any) => {
    if (!report || !report.report || typeof report.report !== 'object') return;
    const newReportData = { ...report.report, ...newObj };
    const newDbReport = { ...report, report: newReportData };
    setReport(newDbReport);
    try { await db.saveFinalReport(newDbReport); } catch (e) { console.error(e); }
  };

  // Determine items to render in sortable list
  const reportId = `report-${sessionId}`;

  // Create an array to map sortable block components
  const availableItems = new Map<string, React.ReactNode>();

  if (hasConsolidated) {
    availableItems.set(reportId, (
      <div className={`border rounded-2xl overflow-hidden shadow-sm ${consolidatedStrictSummary ? 'border-brand/40 bg-brand/5' : 'border-white/10 glass'}`}>
        <div
          className="px-5 py-3 flex items-center gap-3 bg-brand/10 cursor-pointer select-none transition-colors hover:bg-brand/20"
          onClick={() => setIsConsolidatedOpen(o => !o)}
        >
          <Sparkles className="w-5 h-5 text-brand" />
          <span className="font-bold text-base">Consolidated Session Report</span>
        </div>
        {isConsolidatedOpen && (
          <div className="p-4 space-y-4 bg-black/20 border-t border-brand/20">
            {consolidatedStrictSummary && (
              <>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-brand mb-3">Strict Summary</p>
                  <StrictSummaryBlock data={consolidatedStrictSummary} onChange={(s) => handleUpdateConsolidated('strictSummary', s)} />
                </div>
                {consolidatedExpanded && <ExpandedInsightsBlock data={consolidatedExpanded} onChange={(ei) => handleUpdateConsolidated('expandedInsights', ei)} />}
              </>
            )}
            {legacyReportContent && (
              <>
                <StructuredBullets contentObj={legacyReportContent} isReport={true} onChange={handleUpdateLegacyConsolidated} />
              </>
            )}
          </div>
        )}
      </div>
    ));
  }

  // Build audio card maps
  entries.forEach((audio, index) => {
    const time = new Date(audio.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const displayTitle = audio.filename || `Audio Entry ${entries.length - index}`;
    const isOpen = isEntryOpen(audio.id);
    const isProcessing = processingIds.has(audio.id);

    const hasNewShape = Array.isArray(audio.strictSummary);
    const legacyContent: any = {};
    if (!hasNewShape) {
      const keys = ['concepts', 'drills', 'homework', 'mechanics', 'emotionalNotes'];
      const src = (audio as any).processedData || audio;
      keys.forEach(k => { if ((src as any)[k]) legacyContent[k] = (src as any)[k]; });
      if (Object.keys(legacyContent).length === 0 && audio.transcript) {
        try {
          const pd = JSON.parse(audio.transcript);
          keys.forEach(k => { if (pd[k]) legacyContent[k] = pd[k]; });
        } catch (_) { }
      }
      if (Object.keys(legacyContent).length === 0 && audio.bulletPoints?.length) {
        legacyContent.bulletPoints = audio.bulletPoints;
      }
    }

    const cardId = `audio-${audio.id}`;
    availableItems.set(cardId, (
      <AudioEntryCard
        key={audio.id}
        displayTitle={displayTitle}
        time={time}
        audio={audio}
        isOpen={isOpen}
        isProcessing={isProcessing}
        hasNewShape={hasNewShape}
        legacyContent={legacyContent}
        onToggle={() => toggleEntry(audio.id)}
        onUpdateTitle={(newTitle) => onUpdateEntry(audio.id, { filename: newTitle })}
        onDelete={() => onDeleteEntry(audio.id)}
        onProcess={() => onProcessEntry(audio.id)}
        onRequestReprocess={() => onRequestReprocess(audio.id)}
        onUpdateContent={(changes) => onUpdateEntry(audio.id, changes)}
      />
    ));
  });

  // Add the Notes Card
  const notesId = `notes-${sessionId}`;
  if (sessionNotes || isNoteVisible || entries.length > 0) {
    availableItems.set(notesId, (
      <div className="glass p-6 rounded-2xl border border-white/10 shadow-sm relative w-full box-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/30">Notes</h3>
          {!isNoteVisible && !sessionNotes && (
            <button
              onClick={() => setIsNoteVisible(true)}
              className="text-brand hover:text-brand/80 font-bold text-sm transition-colors"
            >
              + Add note
            </button>
          )}
        </div>
        {(isNoteVisible || !!sessionNotes) && (
          <textarea
            autoFocus={isNoteVisible && !sessionNotes}
            placeholder="Add your session notes here..."
            value={sessionNotes || ''}
            onChange={(e) => {
              onUpdateNotes(e.target.value);
              if (e.target.value.trim().length === 0) {
                setIsNoteVisible(false);
              }
            }}
            onBlur={(e) => {
              if (e.target.value.trim().length === 0) {
                setIsNoteVisible(false);
              }
            }}
            className="w-full min-h-[150px] bg-black/20 text-white/80 p-4 rounded-xl border border-white/5 outline-none focus:border-brand/50 transition-colors resize-y overflow-hidden box-border"
          />
        )}
      </div>
    ));
  }

  // Calculate sorted order 
  const currentKeys = Array.from(availableItems.keys());
  let sortedKeys = cardOrder || [];

  // Add new items that aren't in the saved order yet
  const missingKeys = currentKeys.filter(k => !sortedKeys.includes(k));
  if (missingKeys.length > 0) {
    if (!cardOrder) {
      // Original default logic: Report first, then entries backwards, then notes
      sortedKeys = [];
      if (hasConsolidated) sortedKeys.push(reportId);
      entries.forEach(e => sortedKeys.push(`audio-${e.id}`));
      // Show notes at the bottom by default if visible or if entries > 0 (old behavior logic)
      if (availableItems.has(notesId)) sortedKeys.push(notesId);
    } else {
      // Appended new items
      sortedKeys = [...sortedKeys, ...missingKeys];
    }
  }

  // Filter out items that no longer exist (deleted audios)
  sortedKeys = sortedKeys.filter(k => availableItems.has(k));

  // --- DndKit setup ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,      // "Tap and hold" on mobile
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id && over) {
      const oldIndex = sortedKeys.indexOf(active.id as string);
      const newIndex = sortedKeys.indexOf(over.id as string);
      const newOrder = arrayMove(sortedKeys, oldIndex, newIndex);
      onUpdateOrder(newOrder); // pass bubbling up
    }
  };

  return (
    <div className="space-y-4 relative mt-2">
      {isReordering && (
        <div className="flex items-center justify-center mb-6">
          <div className="bg-brand/10 text-brand border border-brand/20 text-xs uppercase font-bold tracking-widest px-4 py-2 rounded-full shadow-sm flex items-center gap-2">
            <GripHorizontal className="w-4 h-4" /> Reorder Mode Active
          </div>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedKeys} strategy={verticalListSortingStrategy}>
          {sortedKeys.map((key) => (
            <SortableCard key={key} id={key} isReordering={isReordering}>
              {availableItems.get(key)}
            </SortableCard>
          ))}
        </SortableContext>
      </DndContext>

      {!hasConsolidated && entries.length === 0 && (
        <div className="p-8 text-center text-white/40 text-sm border border-white/10 border-dashed rounded-xl glass">
          No structured data available for this session yet.
        </div>
      )}
    </div>
  );
}

function AudioEntryCard({ displayTitle, time, audio, isOpen, isProcessing, hasNewShape, legacyContent, onToggle, onUpdateTitle, onDelete, onProcess, onRequestReprocess, onUpdateContent }: {
  displayTitle: string;
  time: string;
  audio: AudioEntry;
  isOpen: boolean;
  isProcessing: boolean;
  hasNewShape: boolean;
  legacyContent: any;
  onToggle: () => void;
  onUpdateTitle: (newTitle: string) => void;
  onDelete: () => void;
  onProcess: () => void;
  onRequestReprocess: () => void;
  onUpdateContent: (changes: Partial<AudioEntry>) => void;
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(displayTitle);

  const handleTitleSubmit = () => {
    if (tempTitle.trim() && tempTitle.trim() !== displayTitle) {
      onUpdateTitle(tempTitle.trim());
    } else {
      setTempTitle(displayTitle);
    }
    setIsEditingTitle(false);
  };

  useEffect(() => {
    if (audio.audioBlob) {
      const url = URL.createObjectURL(audio.audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audio.audioBlob]);

  return (
    <div className="border border-white/10 glass rounded-2xl overflow-hidden shadow-sm">
      <div
        onClick={(e) => {
          if (!isEditingTitle) onToggle();
        }}
        className="p-4 sm:p-5 cursor-pointer flex justify-between items-center hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            {isEditingTitle ? (
              <input
                autoFocus
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSubmit(); if (e.key === 'Escape') { setTempTitle(displayTitle); setIsEditingTitle(false); } }}
                className="bg-transparent font-bold text-sm text-white outline-none w-full"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="font-bold text-sm text-white cursor-text hover:text-white/80 transition-colors flex items-center gap-2 group w-max"
                onClick={(e) => { e.stopPropagation(); setTempTitle(displayTitle); setIsEditingTitle(true); }}
                title="Edit clip name"
              >
                {displayTitle}
                <Edit2 className="w-3 h-3 text-brand opacity-0 group-hover:opacity-80 transition-opacity shrink-0 cursor-pointer" />
              </span>
            )}
            <span className="text-xs text-white/40">{time}h - {audio.type === 'recording' ? 'Live' : 'Clip'}</span>
          </div>
          {isProcessing && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-brand animate-pulse bg-brand/10 px-3 py-1.5 rounded-lg border border-brand/20">PROCESSING...</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isProcessing && !audio.transcript && !audio.strictSummary && !audio.bulletPoints && (
            <button
              onClick={(e) => { e.stopPropagation(); onProcess(); }}
              className="p-3 bg-brand/20 hover:bg-brand/30 text-brand rounded-xl border border-brand/30 transition-all shadow-lg shadow-brand/10 flex items-center justify-center min-h-[44px] min-w-[44px]"
              title="Process audio"
            >
              <Zap className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Trash2 className="w-5 h-5 shrink-0" />
          </button>
          <ChevronUp className={`w-5 h-5 text-white/40 transition-transform ${isOpen ? '' : 'rotate-180'}`} />
        </div>
      </div>

      {isOpen && (
        <div className="p-4 sm:p-5 bg-black/20 border-t border-white/5 space-y-4">
          {audioUrl && (
            <audio controls src={audioUrl} className="w-full h-10 opacity-90 rounded-xl bg-black/20" />
          )}

          {hasNewShape ? (
            <>
              {audio.strictSummary && (audio.strictSummary as string[]).length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-brand mb-3">Strict Summary</p>
                  <StrictSummaryBlock data={audio.strictSummary as string[]} onChange={(s) => onUpdateContent({ strictSummary: s })} />
                </div>
              )}
              {audio.expandedInsights && <ExpandedInsightsBlock data={audio.expandedInsights} onChange={(ei) => onUpdateContent({ expandedInsights: ei })} />}
              <TranscriptBlock text={audio.transcript ?? ''} onChange={(t) => onUpdateContent({ transcript: t })} />
            </>
          ) : (
            <>
              {Object.keys(legacyContent).length > 0 ? (
                <StructuredBullets contentObj={legacyContent} onChange={(newObj) => {
                  if ((audio as any).processedData) {
                    onUpdateContent({ processedData: { ...(audio as any).processedData, ...newObj } } as any);
                  } else if (audio.transcript && typeof legacyContent === 'object') {
                    try {
                      onUpdateContent({ transcript: JSON.stringify({ ...JSON.parse(audio.transcript), ...newObj }) });
                    } catch (e) { }
                  } else {
                    onUpdateContent(newObj as any);
                  }
                }} />
              ) : isProcessing ? (
                <p className="text-white/40 italic text-sm">Waiting for content generation...</p>
              ) : null}
              {audio.transcript && !hasNewShape && (
                <div className="mt-4 pt-4 border-t border-white/5 text-sm">
                  <span className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2 block">Raw Transcript</span>
                  <EditableText value={audio.transcript} onChange={(t) => onUpdateContent({ transcript: t })} multiline className="text-white/60 italic leading-relaxed whitespace-pre-wrap block" />
                </div>
              )}
            </>
          )}

          {!isProcessing && (audio.transcript || audio.strictSummary || audio.bulletPoints || Object.keys(legacyContent).length > 0) && (
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestReprocess();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-brand/10 hover:bg-brand/20 text-brand rounded-xl border border-brand/20 transition-all text-sm font-bold shadow-sm"
              >
                <Zap className="w-4 h-4" />
                Reprocess Clip
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({ title, contentObj, isReport = false, isOpen, onToggle, audioData, onDelete }: any) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (audioData?.audioBlob) {
      const url = URL.createObjectURL(audioData.audioBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audioData?.audioBlob]);

  if (!contentObj || (Object.keys(contentObj).length === 0 && !audioData)) return null;

  return (
    <div className={`mb-4 border rounded-2xl overflow-hidden shadow-sm transition-all ${isReport ? 'border-brand/40 bg-brand/5' : 'border-white/10 glass'}`}>
      <div
        onClick={onToggle}
        className={`p-4 sm:p-5 cursor-pointer flex justify-between items-center transition-colors ${isReport ? 'bg-brand/10 hover:bg-brand/20' : 'hover:bg-white/5'}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isReport ? 'bg-brand/20 text-brand' : 'bg-white/10 text-white/60'}`}>
            {isReport ? <Sparkles className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          </div>
          <span className="font-bold text-base sm:text-lg">{title}</span>
        </div>

        <div className="flex items-center gap-4">
          {audioData && !audioData.transcript && Object.keys(contentObj).length === 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-brand animate-pulse bg-brand/10 px-3 py-1.5 rounded-lg border border-brand/20">
              PROCESSING...
            </div>
          )}
          {audioData && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Trash2 className="w-5 h-5 shrink-0" />
            </button>
          )}
          <ChevronUp className={`w-5 h-5 text-white/40 transition-transform ${isOpen ? '' : 'rotate-180'}`} />
        </div>
      </div>

      {isOpen && (
        <div className="p-4 sm:p-5 bg-black/20 border-t border-white/5">
          {audioUrl && (
            <audio controls src={audioUrl} className="w-full h-10 mb-5 opacity-90 transition-opacity rounded-xl bg-black/20" />
          )}

          {Object.keys(contentObj).length > 0 ? (
            <StructuredBullets contentObj={contentObj} isReport={isReport} />
          ) : (
            <p className="text-white/40 italic text-sm">Waiting for content generation...</p>
          )}

          {audioData?.transcript && (
            <div className="mt-6 pt-4 border-t border-white/5 text-sm">
              <span className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2 block">Raw Transcript</span>
              <p className="text-white/60 italic leading-relaxed">"{audioData.transcript}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StructuredBullets({ contentObj, isReport, onChange }: { contentObj: any, isReport?: boolean, onChange?: (newObj: any) => void }) {
  if (!contentObj || typeof contentObj !== 'object') return null;

  const processBulletItem = (origItem: any, key: React.Key, path?: (string | number)[]) => {
    const text = typeof origItem === 'string' ? origItem : JSON.stringify(origItem);
    const lowerText = text.toLowerCase();
    const isHighlight = lowerText.includes('homework') ||
      lowerText.includes('priorit') ||
      lowerText.includes('tarefa') ||
      lowerText.includes('tarea');

    return (
      <li
        key={key}
        className={`flex gap-3 text-sm sm:text-base leading-relaxed mb-3 ${isHighlight ? 'font-bold text-red-300 bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20 shadow-inner' : 'text-white/80'
          }`}
      >
        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${isHighlight ? 'bg-red-500/20' : 'bg-brand/20'}`}>
          <CheckCircle2 className={`w-3.5 h-3.5 ${isHighlight ? 'text-red-400' : 'text-brand'}`} />
        </div>
        <div className="flex-1 w-full min-w-0 pr-2">
          {onChange && path ? (
            <EditableText
              value={text}
              multiline={true}
              onChange={(newVal) => {
                const copy = JSON.parse(JSON.stringify(contentObj));
                let curr = copy;
                for (let i = 0; i < path.length - 1; i++) curr = curr[path[i]];
                const last = path[path.length - 1];

                if (!newVal.trim()) {
                  if (typeof last === 'number' && Array.isArray(curr)) {
                    curr.splice(last, 1);
                  } else {
                    delete curr[last];
                  }
                } else {
                  if (typeof origItem === 'string') {
                    curr[last] = newVal;
                  } else {
                    try { curr[last] = JSON.parse(newVal); } catch (e) { curr[last] = newVal; }
                  }
                }
                onChange(copy);
              }}
            />
          ) : (
            <span>{text}</span>
          )}
        </div>
      </li>
    );
  };

  const listItems: React.ReactNode[] = [];
  let keyIdx = 0;

  for (const [key, value] of Object.entries(contentObj)) {
    if (!value || (Array.isArray(value) && value.length === 0)) continue;
    if (typeof value === 'object' && Object.keys(value).length === 0) continue;

    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

    listItems.push(
      <li key={`header-${keyIdx++}`} className={`font-bold mt-6 mb-3 uppercase text-xs tracking-widest ${isReport ? 'text-brand' : 'text-white/50'}`}>
        {formattedKey}
      </li>
    );

    if (Array.isArray(value)) {
      value.forEach((item, i) => listItems.push(processBulletItem(item, `arr-${keyIdx}-${i}`, [key, i])));
    } else if (typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value)) {
        if (Array.isArray(subValue)) {
          subValue.forEach((item, i) => {
            listItems.push(processBulletItem(`${subKey}: ${item}`, `obj-arr-${keyIdx}-${i}`));
          });
        } else {
          listItems.push(processBulletItem(`${subKey}: ${subValue}`, `obj-${keyIdx}`));
        }
        keyIdx++;
      }
    } else {
      listItems.push(processBulletItem(value, `val-${keyIdx}`, [key]));
    }
    keyIdx++;
  }

  if (listItems.length === 0) return null;
  return <ul className="m-0 p-0 list-none">{listItems}</ul>;
}

function CustomLanguagePicker({ language, setLanguage }: { language: Language, setLanguage: (l: Language) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const options: { value: Language, label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'pt-BR', label: 'PT-BR' },
    { value: 'es', label: 'ES' },
    { value: 'en', label: 'EN' }
  ];

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === language);

  return (
    <div className="relative" ref={pickerRef} id="languagePicker">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-full transition-colors shadow-sm"
      >
        <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-3 bg-[#2a2a2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200 min-w-[120px]">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setLanguage(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-white/5 last:border-0 ${language === option.value
                ? 'bg-brand/20 text-brand font-bold'
                : 'text-white/80 hover:bg-white/10'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
