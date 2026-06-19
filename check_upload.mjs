import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1] || '';
const SUPABASE_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1] || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testUpload() {
  const file = new Blob(['hello world'], { type: 'text/plain' });
  const { data, error } = await supabase.storage.from('audios').upload('test.txt', file, { upsert: true });
  if (error) {
    console.error('Upload failed:', error.message);
  } else {
    console.log('Upload succeeded:', data);
  }
}

testUpload();
