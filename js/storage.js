/**
 * Storage Management
 * Handles database operations for scores and user data
 */

import { supabase } from './localdb.js';

/**
 * Storage class for managing game scores in IndexedDB
 */
export class Storage {
    /**
     * Save a game score to the database
     * @param {string} userId - User ID
     * @param {string} category - Category played (e.g., 'add_easy', 'multiply_5')
     * @param {number} score - Number of correct answers
     * @param {number} timeMs - Time taken in milliseconds
     * @returns {Promise<boolean>} Success status
     */
    static async saveScore(userId, category, score, timeMs) {
        try {
            const { error } = await supabase
                .from('scores')
                .insert({
                    user_id: userId,
                    category: category,
                    score: score,
                    time_ms: timeMs,
                    played_at: new Date().toISOString()
                });

            if (error) {
                console.error('Error saving score:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error saving score:', error);
            return false;
        }
    }

    /**
     * Get top scores for a user in a specific category
     * Sorted by score (descending) then time (ascending)
     * @param {string} userId - User ID
     * @param {string} category - Category to get scores for
     * @param {number} limit - Maximum number of scores to return
     * @returns {Promise<Array>} Array of score objects
     */
    static async getTopScores(userId, category, limit = 10) {
        try {
            const { data, error } = await supabase
                .from('scores')
                .select('*')
                .eq('user_id', userId)
                .eq('category', category);

            if (error) {
                console.error('Error getting scores:', error);
                return [];
            }

            if (!data || data.length === 0) {
                return [];
            }

            // Sort by score (descending) then time (ascending)
            const sorted = data.sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score; // Higher score first
                }
                return a.time_ms - b.time_ms; // Lower time first
            });

            return sorted.slice(0, limit);
        } catch (error) {
            console.error('Error getting scores:', error);
            return [];
        }
    }

    /**
     * Get all scores for a user across all categories
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Array of score objects
     */
    static async getAllUserScores(userId) {
        try {
            const { data, error } = await supabase
                .from('scores')
                .select('*')
                .eq('user_id', userId);

            if (error) {
                console.error('Error getting user scores:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error getting user scores:', error);
            return [];
        }
    }

    /**
     * Get user profile data
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} Profile data or null
     */
    static async getProfile(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error reading profile:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error reading profile:', error);
            return null;
        }
    }
}
