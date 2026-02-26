import { Session, AudioEntry, FinalReport } from '../types';

const DB_NAME = 'ZouttyAppDB';
const DB_VERSION = 2; // Inc version based on structural changes

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
  }
};
