/**
 * Game Logic
 * Handles math question generation, answer checking, and game progression
 * Updated to support 20 questions per level with Supabase integration
 */

import { APP_CONFIG, ELEMENTS, REWARDS } from './config.js';
import { randomInt, getElement, getIntegerValue, clamp, delay } from './utils.js';
import { Storage } from './storage.js';
import { MathLevels } from './mathLevels.js';
import { LevelRulesManager, LEVEL_RULES } from './level_rules.js';
import { PerformanceTracker } from './performanceTracker.js';

/**
 * Game class for managing math game logic
 */
export class Game {
    constructor(auth, ui) {
        this.auth = auth;
        this.ui = ui;
        this.currentQuestionNumber = 0;
        this.correctAnswers = 0;
        this.level = 1;
        this.currentQuestion = null;
        this.mathLevels = new MathLevels();
        this.levelRulesManager = new LevelRulesManager();
        this.performanceTracker = new PerformanceTracker();
        this.sessionQuestions = [];
        this.isProcessing = false;
    }

    /**
     * Gets the current user ID
     * @returns {string|null} User ID
     */
    getUserId() {
        return this.auth.getUserId();
    }

    /**
     * Gets the current username for display
     * @returns {string} Username
     */
    getUsername() {
        return this.auth.getUsername() || 'Guest';
    }

    /**
     * Starts a new game session
     */
    async start() {
        this.currentQuestionNumber = 0;
        this.correctAnswers = 0;
        this.sessionQuestions = [];

        const userId = this.getUserId();

        if (userId) {
            // Load user's current level from Supabase
            this.level = await Storage.getUserLevel(userId);
        } else {
            this.level = APP_CONFIG.MIN_LEVEL;
        }

        // Ensure level is within valid range (1-30)
        this.level = clamp(this.level, APP_CONFIG.MIN_LEVEL, APP_CONFIG.MAX_LEVEL);

        // Wait for math levels to load from Supabase
        await this.mathLevels.loadLevels();

        // Start performance tracking session
        await this.performanceTracker.startSession(userId, this.level);

        // Load current streaks
        await this.levelRulesManager.loadStreaks(userId);

        this.updateProgressBar();
        this.updateLevelBar();
        this.generateQuestion();
        this.updateUserInfo();
        this.updateStreakDisplay();
    }

    /**
     * Generates a new math question based on current level
     */
    generateQuestion() {
        this.currentQuestion = this.mathLevels.generateQuestion(this.level);
        this.currentQuestionNumber++;

        const questionElement = getElement(ELEMENTS.QUESTION);
        questionElement.textContent = this.currentQuestion.text;
        questionElement.dataset.answer = this.currentQuestion.answer;

        // Start performance tracking for this question
        this.performanceTracker.startQuestion(
            this.currentQuestion.text,
            this.currentQuestion.answer
        );

        // Store question for session tracking
        this.sessionQuestions.push({
            questionNumber: this.currentQuestionNumber,
            question: this.currentQuestion.text,
            correctAnswer: this.currentQuestion.answer,
            userAnswer: null,
            isCorrect: null,
            timestamp: new Date().toISOString()
        });

        // Focus answer input
        const answerInput = getElement(ELEMENTS.ANSWER);
        answerInput.focus();
    }

    /**
     * Checks the user's answer and updates game state
     */
    async checkAnswer() {
        // Prevent double-processing
        if (this.isProcessing) return;

        const answerInput = getElement(ELEMENTS.ANSWER);
        const userAnswerText = answerInput.value.trim();

        // Quietly reject blank answers
        if (userAnswerText === '') {
            return;
        }

        this.isProcessing = true;

        const userAnswer = getIntegerValue(answerInput);
        const correctAnswer = this.currentQuestion.answer;
        const feedback = getElement(ELEMENTS.FEEDBACK);

        // Record the answer with performance tracking
        await this.performanceTracker.recordAnswer(userAnswer);

        // Update session tracking
        const currentQuestionIndex = this.sessionQuestions.length - 1;
        this.sessionQuestions[currentQuestionIndex].userAnswer = userAnswer;
        this.sessionQuestions[currentQuestionIndex].isCorrect = userAnswer === correctAnswer;

        if (userAnswer === correctAnswer) {
            await this.handleCorrectAnswer(feedback);
        } else {
            await this.handleIncorrectAnswer(feedback, correctAnswer);
        }

        answerInput.value = '';
        this.isProcessing = false;
    }

    /**
     * Handles correct answer logic
     * @param {HTMLElement} feedback - Feedback element
     */
    async handleCorrectAnswer(feedback) {
        this.correctAnswers++;
        this.updateProgressBar();

        feedback.textContent = 'Correct!';
        feedback.className = 'feedback correct';

        // Check if we've completed all 20 questions
        if (this.currentQuestionNumber >= LEVEL_RULES.QUESTIONS_PER_LEVEL) {
            await this.handleLevelCompletion(feedback);
        } else {
            await delay(500);
            this.generateQuestion();
            feedback.textContent = '';
        }
    }

    /**
     * Handles incorrect answer logic
     * @param {HTMLElement} feedback - Feedback element
     * @param {number} correctAnswer - The correct answer
     */
    async handleIncorrectAnswer(feedback, correctAnswer) {
        this.updateProgressBar();

        // Show wrong answer feedback
        feedback.textContent = `Wrong! The correct answer was ${correctAnswer}.`;
        feedback.className = 'feedback';

        await delay(1500);

        // Check if we've completed all 20 questions
        if (this.currentQuestionNumber >= LEVEL_RULES.QUESTIONS_PER_LEVEL) {
            await this.handleLevelCompletion(feedback);
        } else {
            this.generateQuestion();
            feedback.textContent = '';
        }
    }

    /**
     * Handles completion of 20 questions and level progression
     * @param {HTMLElement} feedback - Feedback element
     */
    async handleLevelCompletion(feedback) {
        const userId = this.getUserId();
        const username = this.getUsername();
        const score = this.correctAnswers;
        const oldLevel = this.level;

        // Show completion message
        feedback.textContent = `Level complete! You got ${score}/${LEVEL_RULES.QUESTIONS_PER_LEVEL} correct.`;
        feedback.className = 'feedback';

        await delay(2000);

        // Evaluate level progression using the rules
        const progressionResult = await this.levelRulesManager.evaluateLevelProgression(
            userId,
            this.level,
            score
        );

        this.level = progressionResult.newLevel;

        // Update performance tracker with new level
        this.performanceTracker.updateLevel(this.level);

        // Complete the session
        await this.performanceTracker.completeSession(
            score,
            progressionResult.levelChanged,
            progressionResult.levelChanged ? this.level : null,
            progressionResult.reason
        );

        // Save new level and streaks to Supabase
        if (userId) {
            await Storage.setUserLevel(userId, this.level);

            // Record level change if it occurred
            if (progressionResult.levelChanged) {
                await Storage.recordLevelChange(
                    userId,
                    oldLevel,
                    this.level,
                    progressionResult.reason
                );
            }
        }

        this.updateLevelBar();
        this.updateStreakDisplay();

        // Show progression feedback
        await this.showProgressionFeedback(feedback, progressionResult, score, username);

        // Reset for next level and start new session
        this.currentQuestionNumber = 0;
        this.correctAnswers = 0;
        this.sessionQuestions = [];
        this.updateProgressBar();

        // Start new performance tracking session
        if (userId) {
            await this.performanceTracker.startSession(userId, this.level);
        }

        this.generateQuestion();
        feedback.textContent = '';
    }

    /**
     * Shows progression feedback to user
     * @param {HTMLElement} feedback - Feedback element
     * @param {Object} progressionResult - Result from level rules evaluation
     * @param {number} score - Score achieved
     * @param {string} username - Current username
     */
    async showProgressionFeedback(feedback, progressionResult, score, username) {
        // Show progression reason
        feedback.textContent = progressionResult.reason;
        if (progressionResult.streakInfo) {
            feedback.textContent += ` (${progressionResult.streakInfo})`;
        }
        feedback.className = progressionResult.levelChanged ? 'feedback correct' : 'feedback';

        await delay(2000);

        if (progressionResult.levelChanged) {
            const oldLevel = progressionResult.newLevel > this.level ?
                this.level : progressionResult.newLevel;

            if (progressionResult.newLevel < oldLevel) {
                // Level down
                const levelDownMessage = REWARDS.LEVEL_DOWN_MESSAGES[username] ||
                    REWARDS.LEVEL_DOWN_MESSAGES.Patrick ||
                    "Great effort! We're stepping back a level to build your confidence.";
                await this.ui.showPopup(levelDownMessage);
            } else {
                // Level up
                const levelUpMessage = this.ui.getLevelUpMessage(username, this.level);
                await this.ui.showPopup(levelUpMessage);

                // Check if this is a reward milestone
                if (REWARDS.MILESTONES.includes(this.level)) {
                    const rewardNumber = REWARDS.MILESTONES.indexOf(this.level) + 1;
                    const rewardMessage = this.ui.getRewardMessage(username, rewardNumber);
                    await this.ui.showPopup(rewardMessage);
                }
            }
        }
    }

    /**
     * Updates the progress circles display (20 circles for 20 questions)
     */
    updateProgressBar() {
        const progressCircles = getElement(ELEMENTS.PROGRESS_CIRCLES);

        // Create circles if they don't exist
        if (progressCircles.children.length === 0) {
            for (let i = 0; i < LEVEL_RULES.QUESTIONS_PER_LEVEL; i++) {
                const circle = document.createElement('div');
                circle.className = 'progress-circle';
                progressCircles.appendChild(circle);
            }
        }

        // Update circles based on session questions
        const circles = progressCircles.children;
        for (let i = 0; i < circles.length; i++) {
            if (i < this.sessionQuestions.length && this.sessionQuestions[i].isCorrect !== null) {
                // Question has been answered
                circles[i].className = this.sessionQuestions[i].isCorrect ?
                    'progress-circle correct' : 'progress-circle incorrect';
            } else {
                // Question not yet answered
                circles[i].className = 'progress-circle';
            }
        }
    }

    /**
     * Updates the level display badge
     */
    updateLevelBar() {
        const levelNumber = getElement(ELEMENTS.LEVEL_NUMBER);
        const nextReward = getElement(ELEMENTS.NEXT_REWARD);

        // Update level number
        levelNumber.textContent = this.level;

        // Find next milestone reward
        const nextMilestone = REWARDS.MILESTONES.find(m => m > this.level);
        if (nextMilestone) {
            const levelsToGo = nextMilestone - this.level;
            nextReward.textContent = `${levelsToGo} more to Level ${nextMilestone} reward`;
        } else {
            nextReward.textContent = 'MAX LEVEL!';
        }
    }

    /**
     * Updates the user info display
     */
    updateUserInfo() {
        const userInfo = getElement(ELEMENTS.USER_INFO);
        userInfo.textContent = this.auth.getUserDisplayName();
    }

    /**
     * Updates streak display information
     */
    updateStreakDisplay() {
        const streakInfoElement = getElement(ELEMENTS.STREAK_INFO);
        const streakInfo = this.levelRulesManager.getStreakInfo();

        // Display streak info
        let streakText = '';

        if (streakInfo.highScoreStreak > 0) {
            streakText += `High: ${streakInfo.highScoreStreak}/${streakInfo.highScoreNeeded}`;
        }

        if (streakInfo.lowScoreStreak > 0) {
            if (streakText) streakText += ' | ';
            streakText += `Low: ${streakInfo.lowScoreStreak}/${streakInfo.lowScoreLimit}`;
        }

        streakInfoElement.textContent = streakText;
    }

    /**
     * Gets current game statistics
     * @returns {Object} Game statistics
     */
    getStats() {
        return {
            level: this.level,
            currentQuestionNumber: this.currentQuestionNumber,
            correctAnswers: this.correctAnswers,
            questionsRemaining: LEVEL_RULES.QUESTIONS_PER_LEVEL - this.currentQuestionNumber,
            sessionQuestions: this.sessionQuestions
        };
    }

    /**
     * Gets level progression history for current user
     * @returns {Promise<Array>} Level change history
     */
    async getLevelHistory() {
        const userId = this.getUserId();
        if (!userId) return [];

        return await Storage.getLevelHistory(userId);
    }

    /**
     * Gets current streak information
     * @returns {Object} Streak information
     */
    getCurrentStreakInfo() {
        return this.levelRulesManager.getStreakInfo();
    }
}
