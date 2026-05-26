import { Session, AudioEntry, FinalReport, SessionGroup, DanceGlossary } from '../types';

const DB_NAME = 'ZouttyAppDB';
const DB_VERSION = 3; // Inc version for sessionGroups and glossaries

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
    const request = store.put(data);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
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
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
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

  // Backup & Restore
  exportDatabase: async () => {
    const sessions = await db.getSessions();
    const audios = await db.getAudioEntries();
    const groups = await db.getGroups();
    const glossaries = await db.getGlossaries();
    const finalReports = await db.getFinalReports();
    
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

    return {
      version: 2,
      timestamp: Date.now(),
      data: {
        sessions,
        audios: serializedAudios,
        groups,
        glossaries,
        finalReports
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
    const storeNames = ['sessions', 'audios', 'finalReports', 'sessionGroups', 'glossaries'];
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
            const res = await fetch(a.audioBlobBase64);
            blob = await res.blob();
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
      }
    }
  },

  clearDatabase: async () => {
    const dbInst = await dbStart();
    const storeNames = ['sessions', 'audios', 'finalReports', 'sessionGroups', 'glossaries'];
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

