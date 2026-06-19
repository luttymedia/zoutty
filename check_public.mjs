import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1] || '';
const SUPABASE_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1] || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function checkPublic() {
  const { data } = supabase.storage.from('audios').getPublicUrl('test/test.webm');
  console.log('Audios public URL:', data.publicUrl);
}

checkPublic();
