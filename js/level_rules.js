/**
 * Level Rules
 * Contains all level progression rules and logic with Supabase integration
 */

import { Storage } from './storage.js';
import { APP_CONFIG } from './config.js';

/**
 * Level progression rules configuration
 */
export const LEVEL_RULES = {
    QUESTIONS_PER_LEVEL: 20,

    // Level up conditions
    PERFECT_SCORE_THRESHOLD: 20,        // 20/20 = auto level up
    HIGH_SCORE_THRESHOLD: 19,           // 19/20
    HIGH_SCORE_STREAK_REQUIRED: 3,      // 3 times in a row for level up

    // Level down conditions
    LOW_SCORE_THRESHOLD: 15,            // Less than 15 correct
    LOW_SCORE_STREAK_REQUIRED: 2,       // 2 times in a row for level down
    VERY_LOW_SCORE_THRESHOLD: 12        // Less than 12 = immediate level down
};

/**
 * Level Rules Manager
 * Handles level progression logic based on performance with Supabase storage
 */
export class LevelRulesManager {
    constructor() {
        this.highScoreStreak = 0;
        this.lowScoreStreak = 0;
        this.userId = null;
    }

    /**
     * Load current streaks from Supabase
     * @param {string} userId - User ID
     */
    async loadStreaks(userId) {
        this.userId = userId;

        if (!userId) {
            this.highScoreStreak = 0;
            this.lowScoreStreak = 0;
            return;
        }

        const streaks = await Storage.getUserStreaks(userId);
        this.highScoreStreak = streaks.highScoreStreak;
        this.lowScoreStreak = streaks.lowScoreStreak;
    }

    /**
     * Save current streaks to Supabase
     */
    async saveStreaks() {
        if (!this.userId) return;

        await Storage.setUserStreaks(
            this.userId,
            this.highScoreStreak,
            this.lowScoreStreak
        );
    }

    /**
     * Evaluates level progression based on score
     * @param {string} userId - Current user ID
     * @param {number} currentLevel - Current level
     * @param {number} score - Score out of 20
     * @returns {Promise<Object>} Level change result
     */
    async evaluateLevelProgression(userId, currentLevel, score) {
        this.userId = userId;

        const result = {
            newLevel: currentLevel,
            levelChanged: false,
            reason: '',
            streakInfo: ''
        };

        // Perfect score (20/20) - auto level up
        if (score >= LEVEL_RULES.PERFECT_SCORE_THRESHOLD) {
            result.newLevel = Math.min(currentLevel + 1, APP_CONFIG.MAX_LEVEL);
            result.levelChanged = result.newLevel !== currentLevel;
            result.reason = 'Perfect score! Auto level up!';
            await this.resetStreaks();
            return result;
        }

        // Very low score (< 12) - immediate level down
        if (score < LEVEL_RULES.VERY_LOW_SCORE_THRESHOLD) {
            result.newLevel = Math.max(currentLevel - 1, APP_CONFIG.MIN_LEVEL);
            result.levelChanged = result.newLevel !== currentLevel;
            result.reason = 'Score too low - level down';
            await this.resetStreaks();
            return result;
        }

        // High score (19/20) - check for streak
        if (score >= LEVEL_RULES.HIGH_SCORE_THRESHOLD) {
            this.highScoreStreak++;
            this.lowScoreStreak = 0;
            result.streakInfo = `High score streak: ${this.highScoreStreak}/${LEVEL_RULES.HIGH_SCORE_STREAK_REQUIRED}`;

            if (this.highScoreStreak >= LEVEL_RULES.HIGH_SCORE_STREAK_REQUIRED) {
                result.newLevel = Math.min(currentLevel + 1, APP_CONFIG.MAX_LEVEL);
                result.levelChanged = result.newLevel !== currentLevel;
                result.reason = `${LEVEL_RULES.HIGH_SCORE_STREAK_REQUIRED} high scores in a row - level up!`;
                await this.resetStreaks();
            } else {
                await this.saveStreaks();
            }

            return result;
        }

        // Low score (< 15) - check for streak
        if (score < LEVEL_RULES.LOW_SCORE_THRESHOLD) {
            this.lowScoreStreak++;
            this.highScoreStreak = 0;
            result.streakInfo = `Low score streak: ${this.lowScoreStreak}/${LEVEL_RULES.LOW_SCORE_STREAK_REQUIRED}`;

            if (this.lowScoreStreak >= LEVEL_RULES.LOW_SCORE_STREAK_REQUIRED) {
                result.newLevel = Math.max(currentLevel - 1, APP_CONFIG.MIN_LEVEL);
                result.levelChanged = result.newLevel !== currentLevel;
                result.reason = `${LEVEL_RULES.LOW_SCORE_STREAK_REQUIRED} low scores in a row - level down`;
                await this.resetStreaks();
            } else {
                await this.saveStreaks();
            }

            return result;
        }

        // Medium score (15-18) - reset all streaks
        await this.resetStreaks();
        result.reason = 'Good score - continue at current level';

        return result;
    }

    /**
     * Gets current high score streak
     * @returns {number} Current high score streak
     */
    getHighScoreStreak() {
        return this.highScoreStreak;
    }

    /**
     * Gets current low score streak
     * @returns {number} Current low score streak
     */
    getLowScoreStreak() {
        return this.lowScoreStreak;
    }

    /**
     * Resets all streaks
     */
    async resetStreaks() {
        this.highScoreStreak = 0;
        this.lowScoreStreak = 0;
        await this.saveStreaks();
    }

    /**
     * Gets current streak information for display
     * @returns {Object} Streak information
     */
    getStreakInfo() {
        return {
            highScoreStreak: this.highScoreStreak,
            lowScoreStreak: this.lowScoreStreak,
            highScoreNeeded: LEVEL_RULES.HIGH_SCORE_STREAK_REQUIRED,
            lowScoreLimit: LEVEL_RULES.LOW_SCORE_STREAK_REQUIRED
        };
    }
}
