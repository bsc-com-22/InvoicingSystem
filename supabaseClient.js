/**
 * supabaseClient.js
 * Initializes the Supabase client.
 * Replace SUPABASE_URL and SUPABASE_ANON_KEY with your actual project credentials.
 */

// ── Replace these with YOUR Supabase project credentials ──────────────────────
const SUPABASE_URL = 'https://rzoeltmjaaiflzjpitap.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4mSl-4zTncs-w96rxFtcxA_8eg0V9vW';
// ─────────────────────────────────────────────────────────────────────────────

// Load Supabase from CDN (loaded via <script> in each HTML page before this file)
const { createClient } = window.supabase;

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

export { supabaseClient };
