import { Session, AudioEntry, FinalReport, SessionGroup, DanceGlossary, SessionMedia } from '../types';

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

const writeToDb = async <T>(storeName: string, data: T): Promise<void> => {
  const db = await dbStart();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Database write failed'));
    transaction.onabort = () => reject(transaction.error || new Error('Database write aborted'));

    store.put(data);
  });
};

const readAllFromDb = async <T>(storeName: string): Promise<T[]> => {
  const db = await dbStart();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deleteFromDb = async (storeName: string, id: string): Promise<void> => {
  const db = await dbStart();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Database delete failed'));
    transaction.onabort = () => reject(transaction.error || new Error('Database delete aborted'));

    store.delete(id);
  });
};

// Typed helpers
export const db = {
  // Sessions
  saveSession: (session: Session) => writeToDb('sessions', session),
  getSessions: () => readAllFromDb<Session>('sessions'),
  deleteSession: (id: string) => deleteFromDb('sessions', id),

  // Audios
  saveAudioEntry: (entry: AudioEntry) => writeToDb('audios', entry),
  getAudioEntries: () => readAllFromDb<AudioEntry>('audios'),
  deleteAudioEntry: (id: string) => deleteFromDb('audios', id),
  getSessionAudios: async (sessionId: string) => {
    const all = await readAllFromDb<AudioEntry>('audios');
    return all.filter(a => a.sessionId === sessionId);
  },

  // Final Reports
  saveFinalReport: (report: FinalReport) => writeToDb('finalReports', report),
  getFinalReports: () => readAllFromDb<FinalReport>('finalReports'),
  getSessionFinalReport: async (sessionId: string) => {
    const all = await readAllFromDb<FinalReport>('finalReports');
    const sessionReports = all.filter(r => r.sessionId === sessionId);
    sessionReports.sort((a, b) => b.timestamp - a.timestamp);
    return sessionReports[0];
  },

  // Groups
  saveGroup: (group: SessionGroup) => writeToDb('sessionGroups', group),
  getGroups: () => readAllFromDb<SessionGroup>('sessionGroups'),
  deleteGroup: (id: string) => deleteFromDb('sessionGroups', id),

  // Glossaries
  saveGlossary: (glossary: DanceGlossary) => writeToDb('glossaries', glossary),
  getGlossaries: () => readAllFromDb<DanceGlossary>('glossaries'),
  deleteGlossary: (id: string) => deleteFromDb('glossaries', id),

  // Session Media
  saveMediaItem: (item: SessionMedia) => writeToDb('sessionMedia', item),
  getSessionMedia: async (sessionId: string): Promise<SessionMedia[]> => {
    const all = await readAllFromDb<SessionMedia>('sessionMedia');
    return all.filter(m => m.sessionId === sessionId).sort((a, b) => a.timestamp - b.timestamp);
  },
  getAllMedia: () => readAllFromDb<SessionMedia>('sessionMedia'),
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

  importDatabase: async (backup: any) => {
    if (!backup || !backup.data) {
      throw new Error("Invalid backup file format");
    }
    
    const { sessions, audios, groups, glossaries, finalReports } = backup.data;
    
    // 1. Clear database stores
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

