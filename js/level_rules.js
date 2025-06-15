/**
 * Level Rules
 * Contains all level progression rules and logic
 */

/**
 * Level progression rules configuration
 */
export const LEVEL_RULES = {
    QUESTIONS_PER_LEVEL: 20,
    
    // Level up conditions
    PERFECT_SCORE_THRESHOLD: 20,        // 20/20 = auto level up
    HIGH_SCORE_THRESHOLD: 19,           // 19/20 
    HIGH_SCORE_STREAK_REQUIRED: 3,     // 3 times in a row for level up
    
    // Level down conditions
    LOW_SCORE_THRESHOLD: 15,            // Less than 15 correct
    LOW_SCORE_STREAK_REQUIRED: 2,      // 2 times in a row for level down
    VERY_LOW_SCORE_THRESHOLD: 12,      // Less than 12 = immediate level down
    
    // Tracking keys for localStorage
    STORAGE_KEYS: {
        HIGH_SCORE_STREAK: '_high_score_streak',
        LOW_SCORE_STREAK: '_low_score_streak',
        LEVEL_HISTORY: '_level_history'
    }
};

/**
 * Level Rules Manager
 * Handles level progression logic based on performance
 */
export class LevelRulesManager {
    constructor(storage) {
        this.storage = storage;
    }

    /**
     * Evaluates level progression based on score
     * @param {string} username - Current user
     * @param {number} currentLevel - Current level
     * @param {number} score - Score out of 20
     * @returns {Object} Level change result
     */
    evaluateLevelProgression(username, currentLevel, score) {
        const result = {
            newLevel: currentLevel,
            levelChanged: false,
            reason: '',
            streakInfo: ''
        };

        // Perfect score (20/20) - auto level up
        if (score >= LEVEL_RULES.PERFECT_SCORE_THRESHOLD) {
            result.newLevel = Math.min(currentLevel + 1, 100);
            result.levelChanged = result.newLevel !== currentLevel;
            result.reason = 'Perfect score! Auto level up!';
            this.resetStreaks(username);
            return result;
        }

        // Very low score (< 12) - immediate level down
        if (score < LEVEL_RULES.VERY_LOW_SCORE_THRESHOLD) {
            result.newLevel = Math.max(currentLevel - 1, 1);
            result.levelChanged = result.newLevel !== currentLevel;
            result.reason = 'Score too low - immediate level down';
            this.resetStreaks(username);
            return result;
        }

        // High score (19/20) - check for streak
        if (score >= LEVEL_RULES.HIGH_SCORE_THRESHOLD) {
            const highStreak = this.incrementHighScoreStreak(username);
            result.streakInfo = `High score streak: ${highStreak}/${LEVEL_RULES.HIGH_SCORE_STREAK_REQUIRED}`;
            
            if (highStreak >= LEVEL_RULES.HIGH_SCORE_STREAK_REQUIRED) {
                result.newLevel = Math.min(currentLevel + 1, 100);
                result.levelChanged = result.newLevel !== currentLevel;
                result.reason = `${LEVEL_RULES.HIGH_SCORE_STREAK_REQUIRED} high scores in a row - level up!`;
                this.resetStreaks(username);
            }
            
            // Reset low score streak on high score
            this.resetLowScoreStreak(username);
            return result;
        }

        // Low score (< 15) - check for streak
        if (score < LEVEL_RULES.LOW_SCORE_THRESHOLD) {
            const lowStreak = this.incrementLowScoreStreak(username);
            result.streakInfo = `Low score streak: ${lowStreak}/${LEVEL_RULES.LOW_SCORE_STREAK_REQUIRED}`;
            
            if (lowStreak >= LEVEL_RULES.LOW_SCORE_STREAK_REQUIRED) {
                result.newLevel = Math.max(currentLevel - 1, 1);
                result.levelChanged = result.newLevel !== currentLevel;
                result.reason = `${LEVEL_RULES.LOW_SCORE_STREAK_REQUIRED} low scores in a row - level down`;
                this.resetStreaks(username);
            }
            
            // Reset high score streak on low score
            this.resetHighScoreStreak(username);
            return result;
        }

        // Medium score (15-18) - reset all streaks
        this.resetStreaks(username);
        result.reason = 'Good score - continue at current level';
        
        return result;
    }

    /**
     * Gets high score streak for user
     * @param {string} username - Username
     * @returns {number} Current high score streak
     */
    getHighScoreStreak(username) {
        const key = username + LEVEL_RULES.STORAGE_KEYS.HIGH_SCORE_STREAK;
        return parseInt(localStorage.getItem(key) || '0');
    }

    /**
     * Increments high score streak for user
     * @param {string} username - Username
     * @returns {number} New high score streak
     */
    incrementHighScoreStreak(username) {
        const key = username + LEVEL_RULES.STORAGE_KEYS.HIGH_SCORE_STREAK;
        const newStreak = this.getHighScoreStreak(username) + 1;
        localStorage.setItem(key, newStreak.toString());
        return newStreak;
    }

    /**
     * Resets high score streak for user
     * @param {string} username - Username
     */
    resetHighScoreStreak(username) {
        const key = username + LEVEL_RULES.STORAGE_KEYS.HIGH_SCORE_STREAK;
        localStorage.removeItem(key);
    }

    /**
     * Gets low score streak for user
     * @param {string} username - Username
     * @returns {number} Current low score streak
     */
    getLowScoreStreak(username) {
        const key = username + LEVEL_RULES.STORAGE_KEYS.LOW_SCORE_STREAK;
        return parseInt(localStorage.getItem(key) || '0');
    }

    /**
     * Increments low score streak for user
     * @param {string} username - Username
     * @returns {number} New low score streak
     */
    incrementLowScoreStreak(username) {
        const key = username + LEVEL_RULES.STORAGE_KEYS.LOW_SCORE_STREAK;
        const newStreak = this.getLowScoreStreak(username) + 1;
        localStorage.setItem(key, newStreak.toString());
        return newStreak;
    }

    /**
     * Resets low score streak for user
     * @param {string} username - Username
     */
    resetLowScoreStreak(username) {
        const key = username + LEVEL_RULES.STORAGE_KEYS.LOW_SCORE_STREAK;
        localStorage.removeItem(key);
    }

    /**
     * Resets all streaks for user
     * @param {string} username - Username
     */
    resetStreaks(username) {
        this.resetHighScoreStreak(username);
        this.resetLowScoreStreak(username);
    }

    /**
     * Records level change in history
     * @param {string} username - Username
     * @param {number} oldLevel - Previous level
     * @param {number} newLevel - New level
     * @param {string} reason - Reason for change
     */
    recordLevelChange(username, oldLevel, newLevel, reason) {
        const key = username + LEVEL_RULES.STORAGE_KEYS.LEVEL_HISTORY;
        const history = JSON.parse(localStorage.getItem(key) || '[]');
        
        history.push({
            timestamp: new Date().toISOString(),
            oldLevel,
            newLevel,
            reason
        });

        // Keep only last 50 entries
        if (history.length > 50) {
            history.splice(0, history.length - 50);
        }

        localStorage.setItem(key, JSON.stringify(history));
    }

    /**
     * Gets level change history for user
     * @param {string} username - Username
     * @returns {Array} Level change history
     */
    getLevelHistory(username) {
        const key = username + LEVEL_RULES.STORAGE_KEYS.LEVEL_HISTORY;
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    /**
     * Gets current streak information for display
     * @param {string} username - Username
     * @returns {Object} Streak information
     */
    getStreakInfo(username) {
        return {
            highScoreStreak: this.getHighScoreStreak(username),
            lowScoreStreak: this.getLowScoreStreak(username),
            highScoreNeeded: LEVEL_RULES.HIGH_SCORE_STREAK_REQUIRED,
            lowScoreLimit: LEVEL_RULES.LOW_SCORE_STREAK_REQUIRED
        };
    }
}
