import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function getAllStorageFiles(bucket: string, prefix = ''): Promise<string[]> {
  const filePaths: string[] = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100 });
  if (error) {
    console.error(`Error listing ${bucket}/${prefix}:`, error);
    return filePaths;
  }
  if (!data) return filePaths;

  for (const item of data) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    // In Supabase storage, folders have id === null
    if (item.id === null) {
      const subFiles = await getAllStorageFiles(bucket, itemPath);
      filePaths.push(...subFiles);
    } else {
      filePaths.push(itemPath);
    }
  }

  return filePaths;
}

async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`Starting storage cleanup... [Mode: ${isDryRun ? 'DRY-RUN (no files will be deleted)' : 'EXECUTE'}]`);

  // 1. Fetch valid sessions from database
  const { data: sessions, error: sessionErr } = await supabase
    .from('sessions')
    .select('id, deleted');

  if (sessionErr) {
    console.error('Failed to query sessions table:', sessionErr);
    process.exit(1);
  }

  const activeSessionIds = new Set(
    sessions.filter(s => !s.deleted).map(s => s.id)
  );
  console.log(`Found ${activeSessionIds.size} active sessions in database.`);

  const buckets = ['sessionMedia', 'audios'] as const;

  for (const bucket of buckets) {
    console.log(`\nScanning bucket "${bucket}"...`);
    const allFiles = await getAllStorageFiles(bucket);
    console.log(`Found ${allFiles.length} total files in "${bucket}".`);

    const orphanedFiles: string[] = [];

    for (const filePath of allFiles) {
      // Path format: <userId>/<sessionId>/<filename>
      const parts = filePath.split('/');
      const filename = parts[parts.length - 1];
      const isPlaceholder = filename.includes('.emptyFolderPlaceholder');

      let isOrphaned = isPlaceholder;
      if (!isOrphaned && parts.length >= 2) {
        const sessionId = parts[1];
        if (!activeSessionIds.has(sessionId)) {
          isOrphaned = true;
        }
      }

      if (isOrphaned) {
        orphanedFiles.push(filePath);
      }
    }

    if (orphanedFiles.length === 0) {
      console.log(`✓ Bucket "${bucket}" is clean. No orphaned files.`);
      continue;
    }

    console.log(`Found ${orphanedFiles.length} orphaned/placeholder file(s) in "${bucket}":`);
    orphanedFiles.forEach(f => console.log(`  - ${f}`));

    if (!isDryRun) {
      const { data: removed, error: removeErr } = await supabase.storage.from(bucket).remove(orphanedFiles);
      if (removeErr) {
        console.error(`Error deleting files from ${bucket}:`, removeErr);
      } else {
        console.log(`✓ Successfully removed ${removed?.length || orphanedFiles.length} file(s) from "${bucket}".`);
      }
    }
  }

  console.log('\nCleanup finished.');
}

run().catch(console.error);
