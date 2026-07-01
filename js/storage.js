/**
 * Storage Management
 * Handles database operations for scores and user data
 */

import { supabase } from './localdb.js';
import { remoteSaveScore, remoteGetScores } from './scoreStore.js';

/**
 * Storage class for managing game scores.
 *
 * Scores are shared via the /api/scores Cloudflare KV backend so history
 * persists across devices. Every write is also mirrored to local IndexedDB so
 * the game keeps working offline; reads prefer the remote store and fall back
 * to IndexedDB when the API is unreachable.
 */
export class Storage {
    /**
     * Save a game score. Writes to the shared remote store and mirrors locally.
     * @param {string} userId - User ID
     * @param {string} category - Category played (e.g., 'add_easy', 'multiply_5')
     * @param {number} score - Number of correct answers
     * @param {number} timeMs - Time taken in milliseconds
     * @returns {Promise<boolean>} Success status
     */
    static async saveScore(userId, category, score, timeMs) {
        const record = {
            user_id: userId,
            category: category,
            score: score,
            time_ms: timeMs,
            played_at: new Date().toISOString()
        };

        // Local mirror and remote push are independent — run them concurrently
        // so a slow network doesn't hold up the local write on the end-of-game path.
        const [localResult, remoteResult] = await Promise.allSettled([
            Storage._saveLocal(record),
            remoteSaveScore(record)
        ]);

        const localOk = localResult.status === 'fulfilled' && localResult.value;
        const remoteOk = remoteResult.status === 'fulfilled';

        if (!remoteOk) {
            console.warn('Remote score save failed, kept local copy:', remoteResult.reason?.message);
        }

        // Success if the score survived in at least one store.
        return remoteOk || localOk;
    }

    /** Write a score to the local IndexedDB mirror; resolves true on success. */
    static async _saveLocal(record) {
        try {
            const { error } = await supabase.from('scores').insert(record);
            if (error) {
                console.error('Error saving score locally:', error);
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error saving score locally:', error);
            return false;
        }
    }

    /**
     * Get top scores for a user in a specific category, best-first
     * (score descending, then time ascending). Prefers the shared remote
     * store and falls back to local IndexedDB when the API is unreachable.
     * @param {string} userId - User ID
     * @param {string} category - Category to get scores for
     * @param {number} limit - Maximum number of scores to return
     * @returns {Promise<Array>} Array of score objects
     */
    static async getTopScores(userId, category, limit = 10) {
        // Merge both sources: a score may live only in the shared remote store
        // (saved on another device) or only locally (saved offline, or just
        // written and not yet propagated through KV). Neither alone is complete.
        const [remote, local] = await Promise.all([
            Storage._getRemoteScores(userId, category),
            Storage._getLocalScores(userId, category)
        ]);

        const deduped = Storage._dedupeScores([...remote, ...local]);
        return Storage._sortBest(deduped).slice(0, limit);
    }

    /** Best-effort remote fetch; returns [] on any failure. */
    static async _getRemoteScores(userId, category) {
        try {
            const remote = await remoteGetScores(userId, category);
            return Array.isArray(remote) ? remote : [];
        } catch (error) {
            console.warn('Remote score fetch failed, using local:', error.message);
            return [];
        }
    }

    /** Best-effort local IndexedDB fetch; returns [] on any failure. */
    static async _getLocalScores(userId, category) {
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
            return data || [];
        } catch (error) {
            console.error('Error getting scores:', error);
            return [];
        }
    }

    /** Collapse exact duplicates that appear in both the local and remote copies. */
    static _dedupeScores(scores) {
        const seen = new Map();
        for (const s of scores) {
            const key = `${s.user_id}|${s.category}|${s.score}|${s.time_ms}|${s.played_at}`;
            if (!seen.has(key)) seen.set(key, s);
        }
        return [...seen.values()];
    }

    /** Sort best-first: higher score, then faster time. */
    static _sortBest(scores) {
        return scores.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (a.time_ms || 0) - (b.time_ms || 0);
        });
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
