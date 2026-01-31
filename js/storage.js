/**
 * Storage Management
 * Handles Supabase operations for user data and game state
 */

import { supabase } from './supabase.js';
import { APP_CONFIG } from './config.js';

/**
 * Storage class for managing user data in Supabase
 */
export class Storage {
    /**
     * Gets user level from Supabase profile
     * @param {string} userId - User ID to get level for
     * @returns {Promise<number>} User level (defaults to 1 if not found)
     */
    static async getUserLevel(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('current_level')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error reading user level:', error);
                return APP_CONFIG.MIN_LEVEL;
            }

            return data?.current_level || APP_CONFIG.MIN_LEVEL;
        } catch (error) {
            console.error('Error reading user level from storage:', error);
            return APP_CONFIG.MIN_LEVEL;
        }
    }

    /**
     * Sets user level in Supabase profile
     * @param {string} userId - User ID to set level for
     * @param {number} level - Level to set
     * @returns {Promise<boolean>} Success status
     */
    static async setUserLevel(userId, level) {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    current_level: level,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (error) {
                console.error('Error saving user level:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error saving user level to storage:', error);
            return false;
        }
    }

    /**
     * Gets user streaks from Supabase profile
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Streak information
     */
    static async getUserStreaks(userId) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('high_score_streak, low_score_streak')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('Error reading user streaks:', error);
                return { highScoreStreak: 0, lowScoreStreak: 0 };
            }

            return {
                highScoreStreak: data?.high_score_streak || 0,
                lowScoreStreak: data?.low_score_streak || 0
            };
        } catch (error) {
            console.error('Error reading user streaks:', error);
            return { highScoreStreak: 0, lowScoreStreak: 0 };
        }
    }

    /**
     * Updates user streaks in Supabase profile
     * @param {string} userId - User ID
     * @param {number} highStreak - High score streak value
     * @param {number} lowStreak - Low score streak value
     * @returns {Promise<boolean>} Success status
     */
    static async setUserStreaks(userId, highStreak, lowStreak) {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    high_score_streak: highStreak,
                    low_score_streak: lowStreak,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (error) {
                console.error('Error saving user streaks:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error saving user streaks:', error);
            return false;
        }
    }

    /**
     * Updates user progress (level and streaks) in a single call
     * @param {string} userId - User ID
     * @param {number} level - New level
     * @param {number} highStreak - High score streak
     * @param {number} lowStreak - Low score streak
     * @returns {Promise<boolean>} Success status
     */
    static async updateUserProgress(userId, level, highStreak, lowStreak) {
        try {
            const { error } = await supabase.rpc('update_user_progress', {
                p_user_id: userId,
                p_new_level: level,
                p_high_streak: highStreak,
                p_low_streak: lowStreak
            });

            if (error) {
                console.error('Error updating user progress:', error);
                // Fallback to direct update
                return await this.setUserLevel(userId, level) &&
                       await this.setUserStreaks(userId, highStreak, lowStreak);
            }

            return true;
        } catch (error) {
            console.error('Error updating user progress:', error);
            return false;
        }
    }

    /**
     * Records a level change in the level history
     * @param {string} userId - User ID
     * @param {number} oldLevel - Previous level
     * @param {number} newLevel - New level
     * @param {string} reason - Reason for change
     * @returns {Promise<boolean>} Success status
     */
    static async recordLevelChange(userId, oldLevel, newLevel, reason) {
        try {
            const { error } = await supabase
                .from('level_history')
                .insert({
                    user_id: userId,
                    old_level: oldLevel,
                    new_level: newLevel,
                    reason: reason
                });

            if (error) {
                console.error('Error recording level change:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error recording level change:', error);
            return false;
        }
    }

    /**
     * Gets level change history for a user
     * @param {string} userId - User ID
     * @param {number} limit - Maximum number of entries to return
     * @returns {Promise<Array>} Level change history
     */
    static async getLevelHistory(userId, limit = 50) {
        try {
            const { data, error } = await supabase
                .from('level_history')
                .select('*')
                .eq('user_id', userId)
                .order('changed_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error reading level history:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error reading level history:', error);
            return [];
        }
    }

    /**
     * Gets user profile data
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

    /**
     * Updates user profile data
     * @param {string} userId - User ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<boolean>} Success status
     */
    static async updateProfile(userId, updates) {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (error) {
                console.error('Error updating profile:', error);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error updating profile:', error);
            return false;
        }
    }
}
