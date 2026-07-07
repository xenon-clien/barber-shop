/**
 * supabase.js
 * Supabase client initialization — reads credentials from meta tags
 * injected at build/serve time, never hardcoded in source.
 */

// Read from meta tags in index.html
const SUPABASE_URL     = document.querySelector('meta[name="sb-url"]')?.content;
const SUPABASE_ANON_KEY = document.querySelector('meta[name="sb-key"]')?.content;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[Supabase] Missing meta tags sb-url or sb-key. Check index.html.');
}

const { createClient } = window.supabase;
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
