import { supabase } from './supabase';
import { db, dbStart } from './db';
import { Session, AudioEntry, SessionGroup, DanceGlossary, FinalReport, SessionMedia } from '../types';

export const syncEngine = {
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

  async pushLocalChanges(userId: string) {
    const pushTable = async (localTableName: string, supabaseTableName: string, localItems: any[]) => {
      const pendingItems = localItems.filter(item => item.pending_sync);
      if (pendingItems.length === 0) return;

      console.log(`[Sync] Pushing ${pendingItems.length} changes for ${localTableName}...`);

      const payload = pendingItems.map(item => {
        // Strip out binary blobs for Supabase DB (we'd use Storage for blobs, but for now we skip blobs in the DB row)
        const { audioBlob, blob, fileHandle, pending_sync, ...dbData } = item;
        return {
          ...dbData,
          user_id: userId,
          updated_at: new Date().toISOString()
        };
      });

      const { error } = await supabase.from(supabaseTableName).upsert(payload);
      if (error) {
        console.error(`[Sync] Failed to push ${supabaseTableName}:`, error);
        return;
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
  }
};
