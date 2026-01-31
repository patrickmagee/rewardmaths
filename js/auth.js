/**
 * Authentication Management
 * Handles user login, logout using Supabase Auth
 */

import { supabase, getCurrentProfile, signOut, onAuthStateChange } from './supabase.js';
import { APP_CONFIG, ELEMENTS } from './config.js';
import { formatTime, getElement } from './utils.js';

/**
 * Authentication class for managing user login/logout with Supabase
 */
export class Auth {
    constructor() {
        this.failedAttempts = {};
        this.currentUser = null;
        this.currentProfile = null;
        this.authStateCallback = null;
    }

    /**
     * Initialize auth and check for existing session
     * @returns {Promise<Object|null>} Current user profile or null
     */
    async initialize() {
        try {
            // Check for existing session
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.error('Error getting session:', error);
                return null;
            }

            if (session?.user) {
                this.currentUser = session.user;
                this.currentProfile = await getCurrentProfile();
                return this.currentProfile;
            }

            return null;
        } catch (error) {
            console.error('Auth initialization error:', error);
            return null;
        }
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
     * Gets the Supabase auth user
     * @returns {Object|null} Supabase user object or null
     */
    getAuthUser() {
        return this.currentUser;
    }

    /**
     * Gets the user ID
     * @returns {string|null} User ID or null
     */
    getUserId() {
        return this.currentUser?.id || null;
    }

    /**
     * Simple login by username (no password required)
     * @param {string} username - Username to login as (Tom, Patrick, Eliza)
     * @returns {Promise<Object>} Result object with success boolean and error if failed
     */
    async loginByName(username) {
        try {
            const { data, error } = await supabase.auth.signInByName(username);

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
     * Attempts to log in a user with email and password (legacy method)
     * @param {string} email - Email to attempt login with
     * @param {string} password - Password to attempt login with
     * @returns {Promise<Object>} Result object with success boolean and error if failed
     */
    async login(email, password) {
        // Clear any existing timeout
        this.clearLoginTimeout();

        // Check if user is locked out
        if (this.isUserLockedOut(email)) {
            const lockoutInfo = this.getLockoutInfo(email);
            return {
                success: false,
                error: `Too many failed attempts. Try again in ${lockoutInfo.timeRemaining}.`
            };
        }

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('Login error:', error.message);
                this.handleFailedLogin(email);
                return {
                    success: false,
                    error: error.message
                };
            }

            if (data?.user) {
                this.currentUser = data.user;
                this.currentProfile = await getCurrentProfile();
                this.resetFailedAttempts(email);

                console.log('Login successful:', this.currentProfile?.username);
                return {
                    success: true,
                    user: this.currentProfile
                };
            }

            return {
                success: false,
                error: 'Login failed. Please try again.'
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
     * Checks if a user is currently locked out
     * @param {string} email - Email to check
     * @returns {boolean} True if user is locked out
     */
    isUserLockedOut(email) {
        if (!this.failedAttempts[email]) {
            return false;
        }

        const attempts = this.failedAttempts[email];
        const lockoutDuration = APP_CONFIG.TIMEOUT_DURATIONS[
            Math.min(attempts.count - 1, APP_CONFIG.TIMEOUT_DURATIONS.length - 1)
        ];
        const remainingTime = lockoutDuration - (Date.now() - attempts.timestamp);

        return remainingTime > 0;
    }

    /**
     * Gets lockout information for a user
     * @param {string} email - Email to check
     * @returns {Object} Lockout info with time remaining
     */
    getLockoutInfo(email) {
        if (!this.failedAttempts[email]) {
            return { isLockedOut: false, timeRemaining: '0s' };
        }

        const attempts = this.failedAttempts[email];
        const lockoutDuration = APP_CONFIG.TIMEOUT_DURATIONS[
            Math.min(attempts.count - 1, APP_CONFIG.TIMEOUT_DURATIONS.length - 1)
        ];
        const remainingTime = Math.max(0, lockoutDuration - (Date.now() - attempts.timestamp));

        return {
            isLockedOut: remainingTime > 0,
            timeRemaining: formatTime(remainingTime)
        };
    }

    /**
     * Handles failed login attempts
     * @param {string} email - Email that failed login
     */
    handleFailedLogin(email) {
        if (!this.failedAttempts[email]) {
            this.failedAttempts[email] = { count: 0, timestamp: 0 };
        }

        this.failedAttempts[email].count++;
        this.failedAttempts[email].timestamp = Date.now();
    }

    /**
     * Resets failed login attempts for a user
     * @param {string} email - Email to reset attempts for
     */
    resetFailedAttempts(email) {
        if (this.failedAttempts[email]) {
            this.failedAttempts[email] = { count: 0, timestamp: 0 };
        }
    }

    /**
     * Clears any existing login timeout
     */
    clearLoginTimeout() {
        // This method exists for compatibility
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
        return this.currentProfile?.username || null;
    }

    /**
     * Check if current user is an admin
     * @returns {boolean} True if user is admin
     */
    isAdmin() {
        return this.currentProfile?.is_admin === true;
    }

    /**
     * Get the user's reward theme
     * @returns {string} Reward theme name
     */
    getRewardTheme() {
        return this.currentProfile?.reward_theme || 'default';
    }
}
