/**
 * Storage Management
 * Handles database operations for scores and user data
 */

import { supabase } from './localdb.js';
import { APP_CONFIG } from './config.js';

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
     * Get the categories in which the user scored a perfect game
     * (APP_CONFIG.QUESTIONS_PER_GAME correct) on or after the given time.
     * Used to render the weekly "aced" ticks on the menu tiles.
     * `played_at` and `sinceIso` are both ISO-8601 UTC strings, so a string
     * comparison is also a chronological comparison.
     * @param {string} userId - User ID
     * @param {string} sinceIso - ISO timestamp; scores with played_at >= this count
     * @returns {Promise<string[]>} Unique category ids aced since `sinceIso`
     */
    static async getWeeklyPerfectCategories(userId, sinceIso) {
        try {
            const { data, error } = await supabase
                .from('scores')
                .select('*')
                .eq('user_id', userId);

            if (error || !data) {
                if (error) console.error('Error getting weekly scores:', error);
                return [];
            }

            const perfect = APP_CONFIG.QUESTIONS_PER_GAME;
            const categories = new Set();
            for (const row of data) {
                if (row.score === perfect && row.played_at && row.played_at >= sinceIso) {
                    categories.add(row.category);
                }
            }
            return [...categories];
        } catch (error) {
            console.error('Error getting weekly perfect categories:', error);
            return [];
        }
    }
}
