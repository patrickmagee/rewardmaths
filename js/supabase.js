/**
 * Supabase Client Configuration
 *
 * This file re-exports from localdb.js for offline-first local database.
 * To switch to Supabase cloud, replace these exports with the Supabase client.
 */

// Use local IndexedDB database (no cloud dependency)
export {
    supabase,
    isSupabaseConfigured,
    getCurrentUser,
    getCurrentProfile,
    onAuthStateChange,
    signOut,
    initializeDefaultData,
    SUPABASE_CONFIG
} from './localdb.js';

/*
// ==========================================
// SUPABASE CLOUD CONFIGURATION (commented out)
// ==========================================
// To use Supabase cloud instead of local database:
// 1. Uncomment this section
// 2. Comment out the localdb.js imports above
// 3. Set your Supabase credentials below

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

export function isSupabaseConfigured() {
    return !SUPABASE_URL.includes('your-project-id');
}

export async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
}

export async function getCurrentProfile() {
    const user = await getCurrentUser();
    if (!user) return null;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    return data;
}

export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
}

export async function signOut() {
    return supabase.auth.signOut();
}

export const SUPABASE_CONFIG = {
    url: SUPABASE_URL,
    isConfigured: isSupabaseConfigured(),
    isLocal: false
};
*/
