/**
 * Storage Management
 * Handles localStorage operations for user levels
 */

import { APP_CONFIG } from './config.js';

/**
 * Storage class for managing user levels in localStorage
 */
export class Storage {
    /**
     * Gets user level from localStorage
     * @param {string} username - Username to get level for
     * @returns {number} User level (defaults to 1 if not found)
     */
    static getUserLevel(username) {
        try {
            const levels = JSON.parse(localStorage.getItem(APP_CONFIG.STORAGE_KEY) || '{}');
            return levels[username] || APP_CONFIG.MIN_LEVEL;
        } catch (error) {
            console.error('Error reading user level from storage:', error);
            return APP_CONFIG.MIN_LEVEL;
        }
    }

    /**
     * Sets user level in localStorage
     * @param {string} username - Username to set level for
     * @param {number} level - Level to set
     */
    static setUserLevel(username, level) {
        try {
            const levels = JSON.parse(localStorage.getItem(APP_CONFIG.STORAGE_KEY) || '{}');
            levels[username] = level;
            localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(levels));
        } catch (error) {
            console.error('Error saving user level to storage:', error);
        }
    }

    /**
     * Gets all user levels from localStorage
     * @returns {Object} Object containing all user levels
     */
    static getAllUserLevels() {
        try {
            return JSON.parse(localStorage.getItem(APP_CONFIG.STORAGE_KEY) || '{}');
        } catch (error) {
            console.error('Error reading all user levels from storage:', error);
            return {};
        }
    }

    /**
     * Clears all user data from localStorage
     */
    static clearAllData() {
        try {
            localStorage.removeItem(APP_CONFIG.STORAGE_KEY);
        } catch (error) {
            console.error('Error clearing storage:', error);
        }
    }
}
