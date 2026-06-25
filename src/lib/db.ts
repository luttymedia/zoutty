import { Session, AudioEntry, FinalReport, SessionGroup, DanceGlossary, SessionMedia } from '../types';
import { supabase } from './supabase';

const DB_NAME = 'ZouttyAppDB';
const DB_VERSION = 4; // v4: added sessionMedia store

const base64ToBlob = (dataUrl: string): Blob => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || '';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

// ─── Storage Full Detection ─────────────────────────────────────────────────

/** Set to true for the lifetime of this app session when a QuotaExceededError is caught. */
export let isStorageFull = false;

const isQuotaError = (err: unknown): boolean => {
  if (!err) return false;
  const e = err as DOMException;
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22
  );
};

// ─── Store → Supabase table name map ────────────────────────────────────────
const STORE_TO_TABLE: Record<string, string> = {
  sessions: 'sessions',
  audios: 'audios',
  finalReports: 'finalreports',
  sessionGroups: 'sessiongroups',
  glossaries: 'glossaries',
  sessionMedia: 'sessionmedia',
};

// ─── Cloud Fallback Write ────────────────────────────────────────────────────

/**
 * Writes a record directly to Supabase, bypassing IndexedDB.
 * Called automatically when a QuotaExceededError is detected.
 * Binary blobs are uploaded to the appropriate Storage bucket.
 * Throws if the user is not authenticated (guest mode).
 */
const cloudFallbackWrite = async (storeName: string, data: any): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error('BOTH_FAILED: Not authenticated and local storage is full.');
  }
  const userId = session.user.id;
  const tableName = STORE_TO_TABLE[storeName];
  if (!tableName) throw new Error(`Unknown store: ${storeName}`);

  // Strip binary fields — they cannot go into the DB row directly
  const { audioBlob, blob, fileHandle, pending_sync, ...dbData } = data;

  // Upload audio blob to Storage if present
  if (storeName === 'audios' && audioBlob) {
    const storagePath = `${userId}/${data.sessionId}/${data.id}.webm`;
    const { error } = await supabase.storage.from('audios').upload(storagePath, audioBlob, { upsert: true });
    if (error) {
      console.error('[CloudFallback] Failed to upload audio blob:', error);
    } else {
      dbData.audio_storage_path = storagePath;
    }
  }

  // Upload media blob to Storage if present
  if (storeName === 'sessionMedia' && (blob || fileHandle)) {
    let mediaBlob = blob;
    if (!mediaBlob && fileHandle) {
      try {
        const perm = await fileHandle.queryPermission({ mode: 'read' });
        if (perm === 'granted') mediaBlob = await fileHandle.getFile();
      } catch (e) {
        console.error('[CloudFallback] Failed to read fileHandle:', e);
      }
    }
    if (mediaBlob) {
      const extMatch = data.filename?.match(/\.([^.]+)$/);
      const ext = extMatch ? `.${extMatch[1]}` : '';
      const storagePath = `${userId}/${data.sessionId}/${data.id}${ext}`;
      const { error } = await supabase.storage.from('sessionMedia').upload(storagePath, mediaBlob, { upsert: true });
      if (error) {
        console.error('[CloudFallback] Failed to upload media blob:', error);
      } else {
        dbData.media_storage_path = storagePath;
      }
    }
  }

  // Don't sync system glossaries to the cloud
  if (storeName === 'glossaries' && data.isSystem) return;

  const payload = { ...dbData, user_id: userId, updated_at: new Date().toISOString() };
  const { error } = await supabase.from(tableName).upsert(payload);
  if (error) throw new Error(`Cloud fallback write failed for ${tableName}: ${error.message}`);
};

// ─── Cloud Read Fallback (for app startup when local DB is empty) ─────────────

/**
 * Reads all data directly from Supabase and returns it in the same shape
 * as the local DB helpers. Data is kept in-memory only — no IndexedDB write.
 */
export const readFromCloud = async (userId: string): Promise<{
  sessions: Session[];
  audios: AudioEntry[];
  groups: SessionGroup[];
  glossaries: DanceGlossary[];
  finalReports: FinalReport[];
  media: SessionMedia[];
}> => {
  const strip = (items: any[]) =>
    items.map(({ user_id, updated_at, ...rest }) => ({ ...rest, pending_sync: false }));

  const fetchTable = async (table: string) => {
    // Note: The 'deleted' column is a boolean that defaults to false, NOT null.
    // We cannot use .is('deleted', null). We fetch all for user and filter out deleted ones locally or using .eq('deleted', false).
    // Some older tables might not have 'deleted' explicitly set, so doing it via JS filter is safest.
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
    if (error) { console.error(`[CloudRead] Failed to fetch ${table}:`, error); return []; }
    return strip(data ?? []).filter((i: any) => !i.deleted);
  };

  const [sessions, audios, groups, glossaries, finalReports, media] = await Promise.all([
    fetchTable('sessions'),
    fetchTable('audios'),
    fetchTable('sessiongroups'),
    fetchTable('glossaries'),
    fetchTable('finalreports'),
    fetchTable('sessionmedia'),
  ]);

  return { sessions, audios, groups, glossaries, finalReports, media };
};


export const dbStart = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('audios')) {
        db.createObjectStore('audios', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('finalReports')) {
        db.createObjectStore('finalReports', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sessionGroups')) {
        db.createObjectStore('sessionGroups', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('glossaries')) {
        db.createObjectStore('glossaries', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sessionMedia')) {
        db.createObjectStore('sessionMedia', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
};

const writeToDb = async <T extends { pending_sync?: boolean; deleted?: boolean }>(storeName: string, data: T): Promise<void> => {
  const db = await dbStart();
  
  // Set sync flags automatically for every local write
  const dataToSave = {
    ...data,
    pending_sync: true,
    deleted: data.deleted || false
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    transaction.oncomplete = () => {
      resolve();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('zoutty-db-write'));
    };

    // Guard against double-firing: IndexedDB fires both onerror AND onabort
    // when a transaction fails. Without this, handleError runs twice.
    let handled = false;
    const handleError = async (err: unknown) => {
      if (handled) return;
      handled = true;

      if (isQuotaError(err) || isQuotaError(transaction.error)) {
        // ── Storage is full: fall back to direct cloud write ──
        try {
          await cloudFallbackWrite(storeName, data);
          // Cloud write succeeded — only NOW do we know storage is full but cloud is OK
          if (!isStorageFull) {
            isStorageFull = true;
            if (typeof window !== 'undefined') window.dispatchEvent(new Event('zoutty-storage-full'));
          }
          resolve(); // Caller is unaware anything unusual happened
        } catch (cloudErr) {
          // Both local AND cloud failed (offline + full)
          if (isStorageFull) {
            isStorageFull = false;
            if (typeof window !== 'undefined') window.dispatchEvent(new Event('zoutty-storage-full-clear'));
          }
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('zoutty-both-failed'));
          reject(cloudErr);
        }
      } else {
        reject(transaction.error || new Error('Database write failed'));
      }
    };

    transaction.onerror = () => handleError(transaction.error);
    transaction.onabort = () => handleError(transaction.error);

    store.put(dataToSave);
  });
};

const readAllFromDb = async <T extends { deleted?: boolean }>(storeName: string, includeDeleted = false): Promise<T[]> => {
  const db = await dbStart();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as T[];
      resolve(includeDeleted ? results : results.filter(item => !item.deleted));
    };
    request.onerror = () => reject(request.error);
  });
};

const deleteFromDb = async (storeName: string, id: string): Promise<void> => {
  const db = await dbStart();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Fetch the existing record to soft-delete it
    const getReq = store.get(id);
    
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.deleted = true;
        record.pending_sync = true;
        store.put(record);
      }
    };
    
    transaction.oncomplete = () => {
      resolve();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('zoutty-db-write'));
    };
    transaction.onerror = () => reject(transaction.error || new Error('Database delete failed'));
    transaction.onabort = () => reject(transaction.error || new Error('Database delete aborted'));
  });
};

// Typed helpers
export const db = {
  // Sessions
  saveSession: (session: Session) => writeToDb('sessions', session),
  getSessions: (includeDeleted = false) => readAllFromDb<Session>('sessions', includeDeleted),
  deleteSession: (id: string) => deleteFromDb('sessions', id),

  // Audios
  saveAudioEntry: (entry: AudioEntry) => writeToDb('audios', entry),
  getAudioEntries: (includeDeleted = false) => readAllFromDb<AudioEntry>('audios', includeDeleted),
  deleteAudioEntry: (id: string) => deleteFromDb('audios', id),
  getSessionAudios: async (sessionId: string, includeDeleted = false) => {
    const all = await readAllFromDb<AudioEntry>('audios', includeDeleted);
    return all.filter(a => a.sessionId === sessionId);
  },

  // Final Reports
  saveFinalReport: (report: FinalReport) => writeToDb('finalReports', report),
  getFinalReports: (includeDeleted = false) => readAllFromDb<FinalReport>('finalReports', includeDeleted),
  getSessionFinalReport: async (sessionId: string, includeDeleted = false) => {
    const all = await readAllFromDb<FinalReport>('finalReports', includeDeleted);
    const sessionReports = all.filter(r => r.sessionId === sessionId);
    sessionReports.sort((a, b) => b.timestamp - a.timestamp);
    return sessionReports[0];
  },

  // Groups
  saveGroup: (group: SessionGroup) => writeToDb('sessionGroups', group),
  getGroups: (includeDeleted = false) => readAllFromDb<SessionGroup>('sessionGroups', includeDeleted),
  deleteGroup: (id: string) => deleteFromDb('sessionGroups', id),

  // Glossaries
  saveGlossary: (glossary: DanceGlossary) => writeToDb('glossaries', glossary),
  getGlossaries: (includeDeleted = false) => readAllFromDb<DanceGlossary>('glossaries', includeDeleted),
  deleteGlossary: (id: string) => deleteFromDb('glossaries', id),

  // Session Media
  saveMediaItem: (item: SessionMedia) => writeToDb('sessionMedia', item),
  getSessionMedia: async (sessionId: string, includeDeleted = false): Promise<SessionMedia[]> => {
    const all = await readAllFromDb<SessionMedia>('sessionMedia', includeDeleted);
    return all.filter(m => m.sessionId === sessionId).sort((a, b) => a.timestamp - b.timestamp);
  },
  getAllMedia: (includeDeleted = false) => readAllFromDb<SessionMedia>('sessionMedia', includeDeleted),
  deleteMediaItem: (id: string) => deleteFromDb('sessionMedia', id),

  // Backup & Restore
  exportDatabase: async () => {
    const sessions = await db.getSessions();
    const audios = await db.getAudioEntries();
    const groups = await db.getGroups();
    const glossaries = await db.getGlossaries();
    const finalReports = await db.getFinalReports();
    const allMedia = await db.getAllMedia();
    
    // Convert each audio's audioBlob into a Base64 string for JSON compatibility
    const serializedAudios = [];
    for (const entry of audios) {
      let base64Audio = undefined;
      if (entry.audioBlob) {
        try {
          base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(entry.audioBlob!);
          });
        } catch (e) {
          console.error("Failed to read audio blob for entry", entry.id, e);
        }
      }
      serializedAudios.push({
        ...entry,
        audioBlob: undefined, // Remove binary blob
        audioBlobBase64: base64Audio // Add base64 string
      });
    }

    // Serialize media items: convert both Blob mode and Reference mode files to Base64
    // so they are fully packaged and restored on import.
    const serializedMedia = [];
    for (const item of allMedia) {
      if (item.storageMode === 'blob' && item.blob) {
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(item.blob!);
          });
          serializedMedia.push({ ...item, blob: undefined, mediaBase64: base64 });
        } catch (e) {
          console.error("Failed to serialize media blob for item", item.id, e);
          serializedMedia.push({ ...item, blob: undefined });
        }
      } else {
        // Reference mode: try to read the file contents using the file handle
        // and serialize it to Base64 in the backup so it's not lost on restore!
        let base64 = undefined;
        if (item.fileHandle) {
          try {
            // Request read permission if needed
            const perm = await item.fileHandle.queryPermission({ mode: 'read' });
            if (perm !== 'granted') {
              await item.fileHandle.requestPermission({ mode: 'read' });
            }
            const file = await item.fileHandle.getFile();
            base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          } catch (e) {
            console.error("Failed to serialize reference file for backup", item.id, e);
          }
        }
        serializedMedia.push({ ...item, blob: undefined, fileHandle: undefined, mediaBase64: base64 });
      }
    }

    return {
      version: 2,
      timestamp: Date.now(),
      data: {
        sessions,
        audios: serializedAudios,
        groups,
        glossaries,
        finalReports,
        media: serializedMedia
      }
    };
  },

  importDatabase: async (backup: any, options?: { merge?: boolean }) => {
    if (!backup || !backup.data) {
      throw new Error("Invalid backup file format");
    }
    
    const { sessions, audios, groups, glossaries, finalReports } = backup.data;
    
    // 1. Clear database stores if not merging
    if (!options?.merge) {
      const dbInst = await dbStart();
      const storeNames = ['sessions', 'audios', 'finalReports', 'sessionGroups', 'glossaries', 'sessionMedia'];
      const transaction = dbInst.transaction(storeNames, 'readwrite');
      storeNames.forEach(name => {
        transaction.objectStore(name).clear();
      });
      
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    }

    // 2. Restore Sessions
    if (Array.isArray(sessions)) {
      for (const s of sessions) {
        await db.saveSession(s);
      }
    }
    
    // 3. Restore Groups
    if (Array.isArray(groups)) {
      for (const g of groups) {
        await db.saveGroup(g);
      }
    }
    
    // 4. Restore Glossaries
    if (Array.isArray(glossaries)) {
      for (const gl of glossaries) {
        await db.saveGlossary(gl);
      }
    }
    
    // 5. Restore Final Reports
    if (Array.isArray(finalReports)) {
      for (const r of finalReports) {
        await db.saveFinalReport(r);
      }
    }

    // 6. Restore Audio Entries (convert Base64 back to Blob)
    if (Array.isArray(audios)) {
      for (const a of audios) {
        let blob = undefined;
        if (a.audioBlobBase64) {
          try {
            blob = base64ToBlob(a.audioBlobBase64);
          } catch (e) {
            console.error("Failed to reconstruct audio blob for entry", a.id, e);
          }
        }
        
        // Reconstruct AudioEntry object
        const entryToSave: AudioEntry = {
          id: a.id,
          sessionId: a.sessionId,
          timestamp: a.timestamp,
          language: a.language,
          transcript: a.transcript,
          bulletPoints: a.bulletPoints,
          strictSummary: a.strictSummary,
          expandedInsights: a.expandedInsights,
          audioBlob: blob,
          type: a.type,
          filename: a.filename
        };
        await db.saveAudioEntry(entryToSave);
      }
    }

    // 7. Restore Media Items (blob-mode items restore from Base64; reference-mode items restore as broken links unless base64 data is found in backup)
    const mediaToRestore = backup.data.media;
    if (Array.isArray(mediaToRestore)) {
      for (const m of mediaToRestore) {
        let restoredBlob: Blob | undefined = undefined;
        let finalStorageMode = m.storageMode;

        if (m.mediaBase64) {
          try {
            restoredBlob = base64ToBlob(m.mediaBase64);
            finalStorageMode = 'blob'; // promote to blob mode so it's fully restored and viewable!
          } catch (e) {
            console.error("Failed to reconstruct media blob for item", m.id, e);
          }
        }
        const mediaItem: SessionMedia = {
          id: m.id,
          sessionId: m.sessionId,
          timestamp: m.timestamp,
          filename: m.filename,
          mimeType: m.mimeType,
          size: m.size,
          storageMode: finalStorageMode,
          blob: restoredBlob,
          fileHandle: undefined
        };
        await db.saveMediaItem(mediaItem);
      }
    }
  },

  clearDatabase: async () => {
    const dbInst = await dbStart();
    const storeNames = ['sessions', 'audios', 'finalReports', 'sessionGroups', 'glossaries', 'sessionMedia'];
    const transaction = dbInst.transaction(storeNames, 'readwrite');
    storeNames.forEach(name => {
      transaction.objectStore(name).clear();
    });
    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
};

