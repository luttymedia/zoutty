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
  Globe
} from 'lucide-react';
import { format } from 'date-fns';
import { db } from './lib/db';
import { callZoukAudioProcessor, callZoukSessionConsolidator } from './lib/mcp';
import { Session, AudioEntry, Language } from './types';
import Markdown from 'react-markdown';

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

  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  // --- Actions ---

  const createSession = async () => {
    const newSession: Session = {
      id: crypto.randomUUID(),
      title: `Lesson ${format(new Date(), 'MMM d, yyyy')}`,
      date: Date.now(),
    };

    await db.saveSession(newSession);

    setSessions(prev => [newSession, ...prev]);
    setSelectedSessionId(newSession.id);
    setView('detail');
  };

  const updateSessionTitle = async (id: string, title: string) => {
    const session = sessions.find(s => s.id === id);
    if (!session) return;
    const updated = { ...session, title };
    await db.saveSession(updated);
    setSessions(prev => prev.map(s => s.id === id ? updated : s));
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

    // Optimistically update UI
    setAudioEntries(prev => ({ ...prev, [entryId]: newEntry }));

    try {
      showSpinner(`Processing ${type}...`);

      // Call MCP Skill
      const result: any = await callZoukAudioProcessor({
        audio: blob,
        language,
        sessionId,
        filename
      });

      // Update entry with result
      const finalizedEntry: any = {
        ...newEntry,
        ...result
      };

      await db.saveAudioEntry(finalizedEntry);
      setAudioEntries(prev => ({ ...prev, [entryId]: finalizedEntry }));

      showToast(filename ? `[${filename}] processed!` : 'Audio processed!');
    } catch (error) {
      console.error('Processing failed:', error);
      showToast(filename ? `[${filename}] failed to process` : 'Recording failed', true);
      // Remove failed optimistic entry
      setAudioEntries(prev => {
        const copy = { ...prev };
        delete copy[entryId];
        return copy;
      });
    } finally {
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

      // Look for previous report
      const allReports = await db.getFinalReports();
      allReports.sort((a, b) => b.timestamp - a.timestamp);
      // Get the newest report that isn't from the current session
      const previousReport = allReports.find(r => r.sessionId !== selectedSession.id);

      const reportResult: any = await callZoukSessionConsolidator({
        sessionId: selectedSession.id,
        audios: sessionAudios,
        previousReport: previousReport
      });

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
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand font-bold">Zoutty</p>
            <h1 className="text-xl font-bold tracking-tight">
              {view === 'list' ? 'My Sessions' : selectedSession?.title}
            </h1>
          </div>
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
                        <h3 className="font-semibold truncate">{session.title}</h3>
                        <p className="text-xs text-white/40 mt-1">{format(session.date, 'EEE, MMM d, yyyy')}</p>
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
            onRecording={(blob, lang) => addAudioEntry(selectedSession.id, blob, lang, 'recording')}
            onUpload={(e, lang) => handleFileUpload(e, lang)}
            onConsolidate={handleConsolidate}
            onUpdateTitle={(title) => updateSessionTitle(selectedSession.id, title)}
            onDeleteEntry={(id) => requestDeleteAudio(id, 'Audio Entry')}
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
  onRecording,
  onUpload,
  onConsolidate,
  onUpdateTitle,
  onDeleteEntry,
  onError
}: {
  session: Session;
  entries: AudioEntry[];
  onRecording: (blob: Blob, lang: Language) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>, lang: Language) => void;
  onConsolidate: () => void;
  onUpdateTitle: (title: string) => void;
  onDeleteEntry: (entryId: string) => void;
  onError: (msg: string) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState<Language>('auto');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(session.title);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        onRecording(audioBlob, language);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      onError('Microphone access denied or not available.');
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  };

  const handleTitleSubmit = () => {
    onUpdateTitle(tempTitle);
    setIsEditingTitle(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Editable Title */}
      <div className="glass p-6">
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              className="bg-transparent text-2xl font-bold outline-none border-b border-brand w-full py-1"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{session.title}</h2>
            <button
              onClick={() => setIsEditingTitle(true)}
              className="p-3 bg-white/5 text-brand rounded-lg hover:bg-white/10 transition-colors"
            >
              <Edit2 className="w-5 h-5" />
            </button>
          </div>
        )}
        <p className="text-sm text-white/40 mt-2 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          {format(session.date, 'EEE, MMM d, yyyy')}
        </p>
      </div>

      {/* New Structured Session Detail Content */}
      <div id="sessionDetailContent" className="mt-8">
        <SessionStructuredData
          sessionId={session.id}
          entries={entries}
          onDeleteEntry={onDeleteEntry}
        />
      </div>

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
          className={`flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full font-bold transition-all shadow-lg ${isRecording
            ? 'bg-red-500 text-white shadow-red-500/50 animate-pulse'
            : 'bg-brand text-bg-dark hover:bg-brand/90 glow-brand scale-110'
            }`}
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

function SessionStructuredData({ sessionId, entries, onDeleteEntry }: { sessionId: string; entries: AudioEntry[]; onDeleteEntry: (id: string) => void }) {
  const [report, setReport] = useState<any | null>(null);
  const [allOpen, setAllOpen] = useState(true);
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const dbReport = await db.getSessionFinalReport(sessionId);
        setReport(dbReport || null);
      } catch (err) {
        console.error("Failed to load generic content for session", err);
      }
    };
    load();
    const intervalId = setInterval(load, 2000);
    return () => clearInterval(intervalId);
  }, [sessionId]);

  const toggleAll = () => {
    const newState = !allOpen;
    setAllOpen(newState);
    const newOpenStates: Record<string, boolean> = {};
    if (report && report.report) newOpenStates['report'] = newState;
    entries.forEach(a => newOpenStates[a.id] = newState);
    setOpenStates(newOpenStates);
  };

  const isSectionOpen = (id: string) => openStates[id] ?? allOpen;
  const toggleSection = (id: string) => setOpenStates(prev => ({ ...prev, [id]: !prev[id] }));

  // Parse report
  let reportContent: any = null;
  if (report && report.report) {
    const r = report.report;
    const contentToRender: any = {};
    const reportKeys = ['summary', 'homework', 'drills', 'coreConcepts', 'emotionalThemes', 'crossSessionPatterns', 'prioritiesNextLesson'];
    if (typeof r === 'object') {
      reportKeys.forEach(k => { if (r[k]) contentToRender[k] = r[k]; });
      if (Object.keys(contentToRender).length === 0) Object.assign(contentToRender, r);
    } else {
      try {
        const parsed = JSON.parse(r);
        reportKeys.forEach(k => { if (parsed[k]) contentToRender[k] = parsed[k]; });
        if (Object.keys(contentToRender).length === 0) Object.assign(contentToRender, parsed);
      } catch (e) {
        contentToRender['RawSummary'] = r;
      }
    }
    if (Object.keys(contentToRender).length > 0) reportContent = contentToRender;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end mb-2">
        <button
          onClick={toggleAll}
          className="px-4 py-2 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors shadow-sm text-sm"
        >
          {allOpen ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {reportContent && (
        <CollapsibleSection
          title="Consolidated Session Report"
          contentObj={reportContent}
          isReport={true}
          isOpen={isSectionOpen('report')}
          onToggle={() => toggleSection('report')}
        />
      )}

      {entries.map((audio, index) => {
        const sourceData = (audio as any).processedData || audio;
        const content: any = {};
        const keys = ['concepts', 'drills', 'homework', 'mechanics', 'emotionalNotes'];

        keys.forEach(k => { if (sourceData[k]) content[k] = sourceData[k]; });
        if (Object.keys(content).length === 0 && audio.transcript) {
          try {
            const pd = JSON.parse(audio.transcript);
            keys.forEach(k => { if (pd[k]) content[k] = pd[k]; });
          } catch (e) { }
        }
        if (Object.keys(content).length === 0 && audio.bulletPoints && audio.bulletPoints.length > 0) {
          content.bulletPoints = audio.bulletPoints;
        }

        const time = new Date(audio.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const title = audio.filename ? `${audio.filename} (${time})` : `Audio Entry ${entries.length - index} (${time})`;

        return (
          <CollapsibleSection
            key={audio.id}
            title={title}
            contentObj={content}
            isOpen={isSectionOpen(audio.id)}
            onToggle={() => toggleSection(audio.id)}
            audioData={audio}
            onDelete={() => onDeleteEntry(audio.id)}
          />
        );
      })}

      {!reportContent && entries.length === 0 && (
        <div className="p-8 text-center text-white/40 text-sm border border-white/10 border-dashed rounded-xl glass">
          No structured data available for this session yet.
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

function StructuredBullets({ contentObj, isReport }: { contentObj: any, isReport?: boolean }) {
  if (!contentObj || typeof contentObj !== 'object') return null;

  const processBulletItem = (item: any, key: React.Key) => {
    const text = typeof item === 'string' ? item : JSON.stringify(item);
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
        <span>{text}</span>
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
      value.forEach((item, i) => listItems.push(processBulletItem(item, `arr-${keyIdx}-${i}`)));
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
      listItems.push(processBulletItem(value, `val-${keyIdx}`));
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
