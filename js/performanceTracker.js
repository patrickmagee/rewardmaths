/**
 * Performance Tracker Module
 * Tracks question timing and sends data to Supabase
 */

import { supabase } from './supabase.js';

export class PerformanceTracker {
    constructor() {
        this.currentSessionId = null;
        this.questionStartTime = null;
        this.questionNumber = 0;
        this.userId = null;
        this.level = null;
        this.responseTimes = [];
    }

    /**
     * Generate UUID for session tracking
     * @returns {string} UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Start a new 20-question session
     * @param {string} userId - Current user ID
     * @param {number} level - Current level
     */
    async startSession(userId, level) {
        this.currentSessionId = this.generateUUID();
        this.questionNumber = 0;
        this.userId = userId;
        this.level = level;
        this.responseTimes = [];

        try {
            // Create session record in Supabase
            const { error } = await supabase
                .from('game_sessions')
                .insert({
                    session_id: this.currentSessionId,
                    user_id: userId,
                    level_number: level,
                    started_at: new Date().toISOString()
                });

            if (error) {
                console.error('Failed to create session:', error);
            } else {
                console.log(`Started session: ${this.currentSessionId} for user ${userId} at level ${level}`);
            }
        } catch (error) {
            console.error('Error creating session:', error);
        }
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
     * @returns {Promise<Object>} Result with isCorrect flag
     */
    async recordAnswer(userAnswer) {
        if (!this.questionStartTime || !this.currentSessionId) {
            console.warn('Cannot record answer - no active question or session');
            return { isCorrect: false };
        }

        const endTime = performance.now();
        const responseTimeMs = Math.round(endTime - this.questionStartTime);
        const isCorrect = userAnswer === this.currentCorrectAnswer;

        // Track response time
        this.responseTimes.push(responseTimeMs);

        // Prepare attempt data
        const attemptData = {
            session_id: this.currentSessionId,
            user_id: this.userId,
            question_number: this.questionNumber,
            question_text: this.currentQuestionText,
            correct_answer: this.currentCorrectAnswer,
            user_answer: userAnswer,
            is_correct: isCorrect,
            response_time_ms: responseTimeMs < 10000 ? Math.round(responseTimeMs / 100) * 100 : null,
            attempted_at: new Date().toISOString()
        };

        try {
            const { error } = await supabase
                .from('question_attempts')
                .insert(attemptData);

            if (error) {
                console.error('Failed to record attempt:', error);
            } else {
                console.log(`Recorded: ${this.currentQuestionText} = ${userAnswer} (${isCorrect ? 'CORRECT' : 'WRONG'}) in ${responseTimeMs}ms`);
            }
        } catch (error) {
            console.error('Error recording attempt:', error);
        }

        // Reset for next question
        this.questionStartTime = null;
        this.currentQuestionText = null;
        this.currentCorrectAnswer = null;

        return { isCorrect };
    }

    /**
     * Complete the current session with final stats
     * @param {number} correctAnswers - Total correct answers
     * @param {boolean} levelChanged - Whether level changed
     * @param {number} newLevel - New level if changed
     * @param {string} changeReason - Reason for level change
     */
    async completeSession(correctAnswers, levelChanged = false, newLevel = null, changeReason = null) {
        if (!this.currentSessionId) {
            console.warn('No active session to complete');
            return;
        }

        // Calculate average response time
        const avgResponseTime = this.responseTimes.length > 0
            ? Math.round(this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length)
            : null;

        try {
            const { error } = await supabase.rpc('complete_game_session', {
                p_session_id: this.currentSessionId,
                p_correct_answers: correctAnswers,
                p_total_questions: this.questionNumber,
                p_avg_response_time: avgResponseTime,
                p_level_changed: levelChanged,
                p_new_level: newLevel,
                p_change_reason: changeReason
            });

            if (error) {
                console.error('Failed to complete session via RPC:', error);
                // Fallback to direct update
                await this.completeSessionDirect(correctAnswers, avgResponseTime, levelChanged, newLevel, changeReason);
            } else {
                console.log(`Session completed: ${correctAnswers}/${this.questionNumber} correct, avg ${avgResponseTime}ms`);
            }
        } catch (error) {
            console.error('Error completing session:', error);
        }
    }

    /**
     * Direct update fallback for completing session
     */
    async completeSessionDirect(correctAnswers, avgResponseTime, levelChanged, newLevel, changeReason) {
        try {
            const { error } = await supabase
                .from('game_sessions')
                .update({
                    completed_at: new Date().toISOString(),
                    total_questions: this.questionNumber,
                    correct_answers: correctAnswers,
                    average_response_time_ms: avgResponseTime,
                    level_changed: levelChanged,
                    new_level: newLevel,
                    change_reason: changeReason
                })
                .eq('session_id', this.currentSessionId);

            if (error) {
                console.error('Failed to update session directly:', error);
            }
        } catch (error) {
            console.error('Error in direct session update:', error);
        }
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
            userId: this.userId,
            level: this.level,
            isComplete: this.isSessionComplete(),
            avgResponseTime: this.responseTimes.length > 0
                ? Math.round(this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length)
                : null
        };
    }

    /**
     * Update the current level (when user levels up/down)
     * @param {number} newLevel - The new level
     */
    updateLevel(newLevel) {
        this.level = newLevel;
        console.log(`Level updated to: ${newLevel}`);
    }

    /**
     * Get performance data for a user
     * @param {string} userId - User ID
     * @param {Object} filters - Optional filters (startDate, endDate, level)
     * @returns {Promise<Array>} Performance data
     */
    static async getPerformanceData(userId, filters = {}) {
        try {
            let query = supabase
                .from('game_sessions')
                .select(`
                    *,
                    question_attempts (*)
                `)
                .eq('user_id', userId)
                .order('started_at', { ascending: false });

            if (filters.startDate) {
                query = query.gte('started_at', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('started_at', filters.endDate);
            }
            if (filters.level) {
                query = query.eq('level_number', filters.level);
            }
            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Failed to get performance data:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error getting performance data:', error);
            return [];
        }
    }

    /**
     * Get daily performance summary for a user
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Daily performance summary
     */
    static async getDailyPerformance(userId) {
        try {
            const { data, error } = await supabase
                .from('daily_performance')
                .select('*')
                .eq('user_id', userId)
                .order('play_date', { ascending: false });

            if (error) {
                console.error('Failed to get daily performance:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error getting daily performance:', error);
            return [];
        }
    }
}
