import { supabase } from './supabase';
import { db, dbStart } from './db';
import { Session, AudioEntry, SessionGroup, DanceGlossary, FinalReport, SessionMedia } from '../types';

let syncTimeout: ReturnType<typeof setTimeout>;

export const syncEngine = {
  scheduleSync() {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      this.syncAll();
    }, 2000);
  },

  async syncAll() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.log('[Sync] Not logged in, skipping sync.');
        return;
      }
      const userId = session.user.id;

      console.log('[Sync] Starting full sync...');

      // 1. PUSH LOCAL CHANGES TO CLOUD
      await this.pushLocalChanges(userId);

      // 2. PULL CLOUD CHANGES TO LOCAL
      await this.pullCloudChanges(userId);

      console.log('[Sync] Full sync complete.');
      window.dispatchEvent(new Event('zoutty-sync-complete'));
    } catch (e) {
      console.error('[Sync] Sync failed:', e);
    }
  },

  async checkInitialSyncConflicts(userId: string): Promise<{ hasLocalPending: boolean, hasCloudData: boolean }> {
    // 1. Check if there are any local pending changes
    let hasLocalPending = false;
    const sessions = await db.getSessions(true);
    const audios = await db.getAudioEntries(true);
    const reports = await db.getFinalReports(true);
    const groups = await db.getGroups(true);
    const media = await db.getAllMedia(true);
    
    if (
      sessions.some(i => i.pending_sync) ||
      audios.some(i => i.pending_sync) ||
      reports.some(i => i.pending_sync) ||
      groups.some(i => i.pending_sync) ||
      media.some(i => i.pending_sync)
    ) {
      hasLocalPending = true;
    }

    // 2. Check if the cloud has data
    let hasCloudData = false;
    const { data, error } = await supabase.from('sessions').select('id').eq('user_id', userId).limit(1);
    if (!error && data && data.length > 0) {
      hasCloudData = true;
    }

    return { hasLocalPending, hasCloudData };
  },

  async pushLocalChanges(userId: string) {
    const pushTable = async (localTableName: string, supabaseTableName: string, localItems: any[]) => {
      const pendingItems = localItems.filter(item => item.pending_sync);
      if (pendingItems.length === 0) return;

      console.log(`[Sync] Pushing ${pendingItems.length} changes for ${localTableName}...`);

      const itemsToPush = pendingItems.filter(item => !(localTableName === 'glossaries' && item.isSystem));

      if (itemsToPush.length > 0) {
        const payload = await Promise.all(itemsToPush.map(async item => {
          // Strip out binary blobs for Supabase DB
          const { audioBlob, blob, fileHandle, pending_sync, ...dbData } = item;
        
        // Upload audio blob if present
        if (localTableName === 'audios' && audioBlob) {
          const storagePath = `${userId}/${item.sessionId}/${item.id}.webm`;
          const { error } = await supabase.storage.from('audios').upload(storagePath, audioBlob, { upsert: true });
          if (error) {
            console.error(`[Sync] Failed to upload audio blob for ${item.id}:`, error);
          } else {
            dbData.audio_storage_path = storagePath;
          }
        }

        // Upload media blob if present
        if (localTableName === 'sessionMedia' && (blob || fileHandle)) {
          let mediaBlob = blob;
          if (!mediaBlob && fileHandle) {
             try {
               const perm = await fileHandle.queryPermission({ mode: 'read' });
               if (perm === 'granted') {
                 mediaBlob = await fileHandle.getFile();
               } else {
                 console.warn(`[Sync] Skipping media upload for ${item.id} - read permission missing.`);
               }
             } catch (e) {
               console.error(`[Sync] Failed to read fileHandle for ${item.id}:`, e);
             }
          }
          if (mediaBlob) {
            const extMatch = item.filename?.match(/\.([^.]+)$/);
            const ext = extMatch ? `.${extMatch[1]}` : '';
            const storagePath = `${userId}/${item.sessionId}/${item.id}${ext}`;
            const { error } = await supabase.storage.from('sessionMedia').upload(storagePath, mediaBlob, { upsert: true });
            if (error) {
               console.error(`[Sync] Failed to upload media blob for ${item.id}:`, error);
            } else {
               dbData.media_storage_path = storagePath;
            }
          }
        }

        return {
          ...dbData,
          user_id: userId,
          updated_at: new Date().toISOString()
        };
        }));

        const { error } = await supabase.from(supabaseTableName).upsert(payload);
        if (error) {
          console.error(`[Sync] Failed to push ${supabaseTableName}:`, error);
          return;
        }
      }

      // Mark as synced locally
      const idb = await dbStart();
      const transaction = idb.transaction(localTableName, 'readwrite');
      const store = transaction.objectStore(localTableName);
      
      for (const item of pendingItems) {
        if (item.deleted) {
          // If it was a pending delete and we successfully pushed it, we can safely hard-delete it locally
          store.delete(item.id);
        } else {
          item.pending_sync = false;
          store.put(item);
        }
      }
    };

    const sessions = await db.getSessions(true);
    await pushTable('sessions', 'sessions', sessions);

    const audios = await db.getAudioEntries(true);
    await pushTable('audios', 'audios', audios);

    const reports = await db.getFinalReports(true);
    await pushTable('finalReports', 'finalreports', reports);

    const groups = await db.getGroups(true);
    await pushTable('sessionGroups', 'sessiongroups', groups);

    const glossaries = await db.getGlossaries(true);
    await pushTable('glossaries', 'glossaries', glossaries);
    
    // Note: Session Media involves files, so a simple DB push is insufficient.
    // For this MVP, we only sync metadata.
    const media = await db.getAllMedia(true);
    await pushTable('sessionMedia', 'sessionmedia', media);
  },

  async pullCloudChanges(userId: string) {
    const pullTable = async (localTableName: string, supabaseTableName: string) => {
      console.log(`[Sync] Pulling ${supabaseTableName}...`);
      const { data, error } = await supabase.from(supabaseTableName).select('*').eq('user_id', userId);
      
      if (error) {
        console.error(`[Sync] Failed to pull ${supabaseTableName}:`, error);
        return;
      }

      if (!data || data.length === 0) return;

      const idb = await dbStart();
      return new Promise<void>((resolve, reject) => {
        const transaction = idb.transaction(localTableName, 'readwrite');
        const store = transaction.objectStore(localTableName);
        
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        
        // Get all local items to compare
        const getReq = store.getAll();
        getReq.onsuccess = () => {
          const localItems = getReq.result as any[];
          const localMap = new Map(localItems.map(i => [i.id, i]));

          for (const cloudItem of data) {
            const localItem = localMap.get(cloudItem.id);
            
            // If we have a local change pending sync, don't overwrite it with cloud data yet
            if (localItem && localItem.pending_sync) continue;

            if (cloudItem.deleted) {
              if (localItem) {
                store.delete(cloudItem.id);
              }
              continue;
            }

            // Strip user_id before saving locally
            const { user_id, updated_at, ...cleanCloudItem } = cloudItem;
            
            // Preserve local binary data so we don't accidentally delete offline files
            if (localItem) {
              if (localItem.blob !== undefined) cleanCloudItem.blob = localItem.blob;
              if (localItem.audioBlob !== undefined) cleanCloudItem.audioBlob = localItem.audioBlob;
              if (localItem.fileHandle !== undefined) cleanCloudItem.fileHandle = localItem.fileHandle;
            }

            store.put({ ...cleanCloudItem, pending_sync: false });
          }
        };
      });
    };

    await pullTable('sessions', 'sessions');
    await pullTable('audios', 'audios');
    await pullTable('finalReports', 'finalreports');
    await pullTable('sessionGroups', 'sessiongroups');
    await pullTable('glossaries', 'glossaries');
    await pullTable('sessionMedia', 'sessionmedia');
  },

  async wipeCloudData(userId: string) {
    console.log('[Sync] Wiping cloud data for user', userId);
    const tables = ['sessions', 'audios', 'finalreports', 'sessiongroups', 'glossaries', 'sessionmedia'];
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq('user_id', userId);
      if (error) {
        console.error(`[Sync] Failed to wipe ${table}:`, error);
      }
    }
  }
};
