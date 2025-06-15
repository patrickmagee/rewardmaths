/**
 * Performance Tracker Module
 * Tracks question timing and sends data to database
 */

export class PerformanceTracker {
    constructor() {
        this.currentSessionId = null;
        this.questionStartTime = null;
        this.questionNumber = 0;
        this.apiBaseUrl = './api/';
    }

    /**
     * Start a new 20-question session
     * @param {string} username - Current user
     * @param {number} level - Current level
     */
    startSession(username, level) {
        this.currentSessionId = this.generateUUID();
        this.questionNumber = 0;
        this.username = username;
        this.level = level;
        
        console.log(`Started new session: ${this.currentSessionId} for ${username} at level ${level}`);
    }

    /**
     * Start timing for a new question
     * @param {string} questionText - The math question being asked
     * @param {number} correctAnswer - The correct answer
     */
    startQuestion(questionText, correctAnswer) {
        this.questionStartTime = performance.now();
        this.currentQuestionText = questionText;
        this.currentCorrectAnswer = correctAnswer;
        this.questionNumber++;
        
        console.log(`Question ${this.questionNumber}/20: ${questionText}`);
    }

    /**
     * Record the user's answer and timing
     * @param {number} userAnswer - What the user entered
     */
    async recordAnswer(userAnswer) {
        if (!this.questionStartTime || !this.currentSessionId) {
            console.warn('Cannot record answer - no active question or session');
            return;
        }

        const endTime = performance.now();
        const responseTimeMs = Math.round(endTime - this.questionStartTime);
        
        // Prepare data to send to database
        const attemptData = {
            username: this.username,
            level_number: this.level,
            question_text: this.currentQuestionText,
            correct_answer: this.currentCorrectAnswer,
            user_answer: userAnswer,
            response_time_ms: responseTimeMs,
            session_id: this.currentSessionId,
            question_number_in_session: this.questionNumber
        };

        try {
            const response = await fetch(this.apiBaseUrl + 'record_attempt.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(attemptData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                console.log(`Recorded: ${this.currentQuestionText} = ${userAnswer} (${result.is_correct ? 'CORRECT' : 'WRONG'}) in ${responseTimeMs}ms`);
                
                // Log timing info
                if (result.response_time_recorded !== null) {
                    console.log(`Response time recorded: ${result.response_time_recorded}ms (rounded to nearest 100ms)`);
                } else {
                    console.log('Response time not recorded (over 10 seconds)');
                }
            } else {
                console.error('Failed to record attempt:', result.error);
            }
        } catch (error) {
            console.error('Error recording attempt:', error);
            // Store locally as fallback if database is unavailable
            this.storeLocalFallback(attemptData);
        }

        // Reset for next question
        this.questionStartTime = null;
        this.currentQuestionText = null;
        this.currentCorrectAnswer = null;
    }

    /**
     * Check if current session is complete
     * @returns {boolean} True if 20 questions have been answered
     */
    isSessionComplete() {
        return this.questionNumber >= 20;
    }

    /**
     * Get current session statistics
     * @returns {Object} Session info
     */
    getSessionInfo() {
        return {
            sessionId: this.currentSessionId,
            questionNumber: this.questionNumber,
            username: this.username,
            level: this.level,
            isComplete: this.isSessionComplete()
        };
    }

    /**
     * Generate a UUID for session tracking
     * @returns {string} UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Store data locally if database is unavailable
     * @param {Object} attemptData - The attempt data
     */
    storeLocalFallback(attemptData) {
        try {
            const fallbackKey = 'math_game_fallback_data';
            let fallbackData = JSON.parse(localStorage.getItem(fallbackKey) || '[]');
            
            attemptData.timestamp = new Date().toISOString();
            fallbackData.push(attemptData);
            
            // Keep only last 100 attempts to avoid storage issues
            if (fallbackData.length > 100) {
                fallbackData = fallbackData.slice(-100);
            }
            
            localStorage.setItem(fallbackKey, JSON.stringify(fallbackData));
            console.log('Stored attempt data locally as fallback');
        } catch (error) {
            console.error('Failed to store fallback data:', error);
        }
    }

    /**
     * Get locally stored fallback data
     * @returns {Array} Array of stored attempts
     */
    getFallbackData() {
        try {
            return JSON.parse(localStorage.getItem('math_game_fallback_data') || '[]');
        } catch (error) {
            console.error('Failed to retrieve fallback data:', error);
            return [];
        }
    }

    /**
     * Clear locally stored fallback data
     */
    clearFallbackData() {
        try {
            localStorage.removeItem('math_game_fallback_data');
            console.log('Cleared fallback data');
        } catch (error) {
            console.error('Failed to clear fallback data:', error);
        }
    }

    /**
     * Update the current level (when user levels up/down)
     * @param {number} newLevel - The new level
     */
    updateLevel(newLevel) {
        this.level = newLevel;
        console.log(`Level updated to: ${newLevel}`);
    }
}
