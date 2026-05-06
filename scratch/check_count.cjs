const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

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
}

checkNews();
