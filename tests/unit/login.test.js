import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { supabase, getCurrentProfile, signOut } from '../../js/localdb.js';

/**
 * Wait until the auto-seeded default users exist in the shared DB.
 * Importing localdb.js kicks off initializeDefaultData() asynchronously,
 * so we poll until the 3 default profiles are present before logging in.
 */
async function waitForSeed(timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const { data } = await supabase.from('profiles').select('*');
        if (data && data.length >= 3) return data;
        await new Promise(r => setTimeout(r, 25));
    }
    throw new Error('Default users were not seeded in time');
}

describe('localdb authentication', () => {
    beforeAll(async () => {
        await waitForSeed();
    });

    // Ensure each test starts with a clean session.
    afterEach(async () => {
        await signOut();
    });

    it('signs in with correct credentials and reflects the session/profile', async () => {
        const { data, error } = await supabase.auth.signInByName('Tom', 'dino');

        expect(error).toBeNull();
        expect(data.user).toBeTruthy();
        expect(data.user.user_metadata.username).toBe('tom');
        expect(data.session).toBeTruthy();

        // getSession() reflects the logged-in user.
        const sessionResult = await supabase.auth.getSession();
        expect(sessionResult.data.session).toBeTruthy();
        expect(sessionResult.data.session.user.id).toBe(data.user.id);

        // getCurrentProfile() returns the matching profile.
        const profile = await getCurrentProfile();
        expect(profile).toBeTruthy();
        expect(profile.username).toBe('tom');
        expect(profile.display_name).toBe('Tom');
    });

    it('matches usernames case-insensitively', async () => {
        const upper = await supabase.auth.signInByName('TOM', 'dino');
        expect(upper.error).toBeNull();
        expect(upper.data.user).toBeTruthy();
        expect(upper.data.user.user_metadata.username).toBe('tom');

        await signOut();

        const lower = await supabase.auth.signInByName('tom', 'dino');
        expect(lower.error).toBeNull();
        expect(lower.data.user).toBeTruthy();
        expect(lower.data.user.user_metadata.username).toBe('tom');
    });

    it('rejects a wrong password with an error and no user', async () => {
        const { data, error } = await supabase.auth.signInByName('Tom', 'wrong-password');

        expect(error).toBeTruthy();
        expect(error.message).toBe('Wrong password');
        expect(data.user).toBeNull();

        // No session should have been created.
        const sessionResult = await supabase.auth.getSession();
        expect(sessionResult.data.session).toBeNull();
    });

    it('rejects an unknown username', async () => {
        const { data, error } = await supabase.auth.signInByName('nobody-here', 'whatever');

        expect(error).toBeTruthy();
        expect(error.message).toBe('User not found');
        expect(data.user).toBeNull();

        const sessionResult = await supabase.auth.getSession();
        expect(sessionResult.data.session).toBeNull();
    });

    it('rejects a profile that has no password set', async () => {
        const tempId = `temp-nopass-${Date.now()}`;
        const tempUsername = `nopass${Date.now()}`;

        // Insert a passwordless profile directly.
        const insertResult = await supabase.from('profiles').insert({
            id: tempId,
            email: `${tempUsername}@local`,
            username: tempUsername,
            display_name: 'NoPass',
            is_admin: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        expect(insertResult.error).toBeNull();

        try {
            const { data, error } = await supabase.auth.signInByName(tempUsername, 'anything');
            expect(error).toBeTruthy();
            expect(error.message).toBe('Wrong password');
            expect(data.user).toBeNull();
        } finally {
            // Clean up the temp profile.
            await supabase.from('profiles').delete().eq('id', tempId);
        }

        // Verify cleanup.
        const check = await supabase.from('profiles').select('*').eq('id', tempId).single();
        expect(check.data).toBeNull();
    });

    it('clears the session on signOut', async () => {
        const signIn = await supabase.auth.signInByName('Tom', 'dino');
        expect(signIn.error).toBeNull();

        let sessionResult = await supabase.auth.getSession();
        expect(sessionResult.data.session).toBeTruthy();

        const out = await signOut();
        expect(out.error).toBeNull();

        sessionResult = await supabase.auth.getSession();
        expect(sessionResult.data.session).toBeNull();

        const profile = await getCurrentProfile();
        expect(profile).toBeNull();
    });
});
