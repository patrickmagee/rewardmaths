/**
 * Authentication Management
 * Handles user login, logout, and failed login attempts
 */

import { USERS, APP_CONFIG, ELEMENTS } from './config.js';
import { formatTime, getElement } from './utils.js';
import { Storage } from './storage.js';

/**
 * Authentication class for managing user login/logout
 */
export class Auth {
    constructor() {
        this.failedAttempts = {};
        this.currentUser = null;
    }

    /**
     * Gets the currently logged in user
     * @returns {Object|null} Current user object or null
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Attempts to log in a user
     * @param {string} username - Username to attempt login with
     * @param {string} password - Password to attempt login with
     * @returns {boolean} True if login successful, false otherwise
     */
    login(username, password) {
        // Clear any existing timeout
        this.clearLoginTimeout();

        // Allow blank login (guest mode) - default to Patrick
        if (username === '' && password === '') {
            this.currentUser = { username: 'Patrick', isGuest: true };
            // Set initial level to 10 for Patrick if not already set
            if (!Storage.getUserLevel('Patrick')) {
                Storage.setUserLevel('Patrick', 10);
            }
            return true;
        }

        const user = USERS.find(u => u.username === username);
        if (!user || user.password !== password) {
            console.log('Invalid login attempt');
            this.handleFailedLogin(username);
            return false;
        }

        console.log('Login successful');
        this.resetFailedAttempts(username);
        this.currentUser = user;
        return true;
    }

    /**
     * Logs out the current user
     */
    logout() {
        this.currentUser = null;
    }

    /**
     * Checks if a user is currently locked out
     * @param {string} username - Username to check
     * @returns {boolean} True if user is locked out
     */
    isUserLockedOut(username) {
        if (!this.failedAttempts[username]) {
            return false;
        }

        const attempts = this.failedAttempts[username];
        const lockoutDuration = APP_CONFIG.TIMEOUT_DURATIONS[
            Math.min(attempts.count - 1, APP_CONFIG.TIMEOUT_DURATIONS.length - 1)
        ];
        const remainingTime = lockoutDuration - (Date.now() - attempts.timestamp);

        return remainingTime > 0;
    }

    /**
     * Handles failed login attempts
     * @param {string} username - Username that failed login
     */
    handleFailedLogin(username) {
        if (!this.failedAttempts[username]) {
            this.failedAttempts[username] = { count: 0, timestamp: 0 };
        }

        this.failedAttempts[username].count++;
        this.failedAttempts[username].timestamp = Date.now();

        const attempts = this.failedAttempts[username].count;
        const lockoutDuration = APP_CONFIG.TIMEOUT_DURATIONS[
            Math.min(attempts - 1, APP_CONFIG.TIMEOUT_DURATIONS.length - 1)
        ];

        const remainingTime = lockoutDuration - (Date.now() - this.failedAttempts[username].timestamp);
        const timeStr = formatTime(remainingTime);

        const errorElement = getElement(ELEMENTS.LOGIN_ERROR);
        errorElement.textContent = `Invalid login. Try again in ${timeStr}.`;
    }

    /**
     * Resets failed login attempts for a user
     * @param {string} username - Username to reset attempts for
     */
    resetFailedAttempts(username) {
        if (this.failedAttempts[username]) {
            this.failedAttempts[username] = { count: 0, timestamp: 0 };
        }
    }

    /**
     * Gets the display name for the current user
     * @returns {string} Display name with emoji
     */
    getUserDisplayName() {
        if (this.currentUser && this.currentUser.username) {
            return `${this.currentUser.username} 🙂`;
        }
        return '🙂';
    }
}
