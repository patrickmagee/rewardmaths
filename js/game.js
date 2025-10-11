/**
 * Game Logic
 * Handles math question generation, answer checking, and game progression
 * Updated to support 20 questions per level with new progression rules
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
        this.levelRulesManager = new LevelRulesManager(Storage);
        this.performanceTracker = new PerformanceTracker();
        this.sessionQuestions = []; // Track all questions in current session
    }

    /**
     * Starts a new game session
     */
    start() {
        this.currentQuestionNumber = 0;
        this.correctAnswers = 0;
        this.sessionQuestions = [];
        
        const currentUser = this.auth.getCurrentUser();
        const username = currentUser?.username || 'Guest';
        
        if (currentUser && currentUser.username) {
            this.level = Storage.getUserLevel(currentUser.username);
        } else {
            this.level = APP_CONFIG.MIN_LEVEL;
        }

        // Start performance tracking session
        this.performanceTracker.startSession(username, this.level);

        this.updateProgressBar();
        this.updateLevelBar();
        this.initializeRewardMarkers();
        this.generateQuestion();
        this.updateUserInfo();
        this.updateStreakDisplay();
    }

    /**
     * Generates a new math question based on current level
     */
    generateQuestion() {
        // Use progressive math levels system
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
    }

    /**
     * Checks the user's answer and updates game state
     */
    async checkAnswer() {
        const answerInput = getElement(ELEMENTS.ANSWER);
        const userAnswerText = answerInput.value.trim();
        
        // Quietly reject blank answers
        if (userAnswerText === '') {
            return;
        }
        
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
        const currentUser = this.auth.getCurrentUser();
        const username = currentUser?.username || 'Guest';
        const score = this.correctAnswers;
        const oldLevel = this.level;

        // Show completion message
        feedback.textContent = `Level complete! You got ${score}/${LEVEL_RULES.QUESTIONS_PER_LEVEL} correct.`;
        feedback.className = 'feedback';
        
        await delay(2000);

        // Evaluate level progression using the new rules
        const progressionResult = this.levelRulesManager.evaluateLevelProgression(
            username, 
            this.level, 
            score
        );

        this.level = progressionResult.newLevel;

        // Update performance tracker with new level
        this.performanceTracker.updateLevel(this.level);

        // Save new level if user is logged in
        if (currentUser && currentUser.username) {
            Storage.setUserLevel(currentUser.username, this.level);
        }

        // Record level change if it occurred
        if (progressionResult.levelChanged) {
            this.levelRulesManager.recordLevelChange(
                username, 
                oldLevel, 
                this.level, 
                progressionResult.reason
            );
        }

        this.updateLevelBar();
        this.updateRewardMarkers();
        this.updateStreakDisplay();

        // Show progression feedback
        await this.showProgressionFeedback(feedback, progressionResult, score, username);

        // Reset for next level
        this.currentQuestionNumber = 0;
        this.correctAnswers = 0;
        this.sessionQuestions = [];
        this.updateProgressBar();
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
            // Show personalized level change message
            if (this.level > progressionResult.newLevel) {
                // Level down
                const levelDownMessage = REWARDS.LEVEL_DOWN_MESSAGES[username] || REWARDS.LEVEL_DOWN_MESSAGES.Patrick;
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
     * Updates the level bar display
     */
    updateLevelBar() {
        const levelBar = getElement(ELEMENTS.LEVEL_BAR);
        const levelText = getElement(ELEMENTS.LEVEL_TEXT);
        const percent = clamp(this.level, 1, 100) / 100 * 100;
        
        levelBar.style.height = `${percent}%`;
        levelText.textContent = this.level;
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
        const currentUser = this.auth.getCurrentUser();
        const streakInfoElement = getElement(ELEMENTS.STREAK_INFO);

        if (!currentUser || !currentUser.username) {
            streakInfoElement.textContent = '';
            return;
        }

        const streakInfo = this.levelRulesManager.getStreakInfo(currentUser.username);

        // Display streak info in separate small element
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
     * Initializes reward markers on the level bar
     */
    initializeRewardMarkers() {
        const rewardMarkersContainer = getElement(ELEMENTS.REWARD_MARKERS);
        rewardMarkersContainer.innerHTML = '';

        REWARDS.MILESTONES.forEach((milestone, index) => {
            const marker = document.createElement('div');
            marker.className = 'reward-marker';
            marker.title = `Level ${milestone} Reward`; // Tooltip for hover

            // Position marker to align with bar fill height (same calculation as level bar)
            // Use clamp(milestone, 1, 100) / 100 to match updateLevelBar logic
            const position = (clamp(milestone, 1, 100) / 100) * 100;
            marker.style.bottom = `${position}%`;

            // Check if reward is unlocked
            if (this.level >= milestone) {
                marker.classList.add('unlocked');
            } else {
                marker.classList.add('locked');
            }

            rewardMarkersContainer.appendChild(marker);
        });
    }

    /**
     * Updates reward markers based on current level
     */
    updateRewardMarkers() {
        const markers = document.querySelectorAll('.reward-marker');
        markers.forEach((marker, index) => {
            const milestone = REWARDS.MILESTONES[index];
            marker.classList.remove('locked', 'unlocked');
            
            if (this.level >= milestone) {
                marker.classList.add('unlocked');
            } else {
                marker.classList.add('locked');
            }
        });
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
     * @returns {Array} Level change history
     */
    getLevelHistory() {
        const currentUser = this.auth.getCurrentUser();
        if (!currentUser || !currentUser.username) return [];
        
        return this.levelRulesManager.getLevelHistory(currentUser.username);
    }

    /**
     * Gets current streak information for current user
     * @returns {Object} Streak information
     */
    getCurrentStreakInfo() {
        const currentUser = this.auth.getCurrentUser();
        if (!currentUser || !currentUser.username) return null;
        
        return this.levelRulesManager.getStreakInfo(currentUser.username);
    }
}
