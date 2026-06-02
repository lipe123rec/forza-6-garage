import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Hardcode your credentials here, or leave them empty to configure via localStorage in browser
const CONFIG_URL = 'https://hnruwlxmarapeaexaarh.supabase.co';
const CONFIG_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucnV3bHhtYXJhcGVhZXhhYXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODQ4NjksImV4cCI6MjA5NDc2MDg2OX0.973-fgI5bMxZJHcvVqBG0yh7xxbxzsjXqMUkELo_Emk';

export const SUPABASE_URL = CONFIG_URL || localStorage.getItem('SUPABASE_URL') || '';
export const SUPABASE_ANON_KEY = CONFIG_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase credentials not configured. Set them in js/supabase.js or run: localStorage.setItem("SUPABASE_URL", "...") and localStorage.setItem("SUPABASE_ANON_KEY", "...")');
}

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;
