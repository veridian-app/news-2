import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkNews() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase config');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  const { count, error } = await supabase
    .from('daily_news')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error fetching count:', error);
  } else {
    console.log('Total news in daily_news:', count);
  }

  const { count: withImageCount, error: error2 } = await supabase
    .from('daily_news')
    .select('*', { count: 'exact', head: true })
    .not('image', 'is', null)
    .neq('image', '')
    .neq('image', 'GENERATION_FAILED');

  if (error2) {
    console.error('Error fetching withImageCount:', error2);
  } else {
    console.log('News with valid image:', withImageCount);
  }
}

checkNews();
