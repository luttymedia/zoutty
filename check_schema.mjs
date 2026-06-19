import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1] || '';
const SUPABASE_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1] || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  const { data, error } = await supabase.from('audios').select('audio_storage_path').limit(1);
  if (error) console.error('Error fetching audios:', error);
  else console.log('Audios schema is OK');

  const { data: sm, error: sme } = await supabase.from('sessionmedia').select('media_storage_path').limit(1);
  if (sme) console.error('Error fetching sessionmedia:', sme);
  else console.log('SessionMedia schema is OK');
}

check();
