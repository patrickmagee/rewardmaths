/**
 * Authentication Management
 * Handles user login, logout using Supabase Auth
 */

import { supabase, getCurrentProfile, signOut, onAuthStateChange } from './localdb.js';

/**
 * Authentication class for managing user login/logout with Supabase
 */
export class Auth {
    constructor() {
        this.currentUser = null;
        this.currentProfile = null;
        this.authStateCallback = null;
    }

    /**
     * Subscribe to auth state changes
     * @param {Function} callback - Callback for auth state changes
     */
    subscribeToAuthChanges(callback) {
        this.authStateCallback = onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);

            if (event === 'SIGNED_IN' && session?.user) {
                this.currentUser = session.user;
                // Load the profile here so the callback's third arg is populated:
                // notifyListeners('SIGNED_IN') fires synchronously from signInByName,
                // before loginByName's own profile fetch has resolved.
                this.currentProfile = await getCurrentProfile();
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.currentProfile = null;
            }

            if (callback) {
                callback(event, session, this.currentProfile);
            }
        });
    }

    /**
     * Gets the currently logged in user
     * @returns {Object|null} Current user object or null
     */
    getCurrentUser() {
        return this.currentProfile;
    }

    /**
     * Gets the user ID
     * @returns {string|null} User ID or null
     */
    getUserId() {
        return this.currentUser?.id || null;
    }

    /**
     * Login by username with password
     * @param {string} username - Username to login as (Tom, Patrick, Eliza)
     * @param {string} password - User's password
     * @returns {Promise<Object>} Result object with success boolean and error if failed
     */
    async loginByName(username, password) {
        try {
            const { data, error } = await supabase.auth.signInByName(username, password);

            if (error) {
                console.error('Login error:', error.message);
                return {
                    success: false,
                    error: error.message
                };
            }

            if (data?.user) {
                this.currentUser = data.user;
                this.currentProfile = await getCurrentProfile();

                console.log('Login successful:', this.currentProfile?.username);
                return {
                    success: true,
                    user: this.currentProfile
                };
            }

            return {
                success: false,
                error: 'User not found. Please try again.'
            };
        } catch (error) {
            console.error('Login exception:', error);
            return {
                success: false,
                error: 'An unexpected error occurred. Please try again.'
            };
        }
    }

    /**
     * Logs out the current user
     * @returns {Promise<Object>} Result object with success boolean
     */
    async logout() {
        try {
            const { error } = await signOut();

            if (error) {
                console.error('Logout error:', error);
                return { success: false, error: error.message };
            }

            this.currentUser = null;
            this.currentProfile = null;
            return { success: true };
        } catch (error) {
            console.error('Logout exception:', error);
            return { success: false, error: 'Logout failed' };
        }
    }

    /**
     * Gets the display name for the current user
     * @returns {string} Display name with emoji
     */
    getUserDisplayName() {
        if (this.currentProfile) {
            const emoji = this.currentProfile.avatar_emoji || '🙂';
            return `${this.currentProfile.display_name || this.currentProfile.username} ${emoji}`;
        }
        return '🙂';
    }

    /**
     * Gets the username for the current user
     * @returns {string|null} Username or null
     */
    getUsername() {
        return this.currentProfile?.display_name || this.currentProfile?.username || null;
    }
}
