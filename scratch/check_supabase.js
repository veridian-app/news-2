import { createClient } from '@supabase/supabase-js';

const url = "https://fouigwvpyrgbdclbevhi.supabase.co";
const key = "sb_publishable_UwTShXws4Y15aShnEAqq8g_niGdAnsy";

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('daily_news').select('*').limit(5);
  console.log("Error:", error);
  console.log("Data count:", data?.length);
  console.log("Data:", data);
}

check();
