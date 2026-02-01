/**
 * Game Logic
 * Handles math question generation, answer checking, and scoring
 */

import { APP_CONFIG, ELEMENTS, MESSAGES } from './config.js';
import { generateQuestion, getCategoryDisplayName, resetLastQuestion } from './mathLevels.js';
import { Storage } from './storage.js';

/**
 * Game class for managing math game logic
 */
export class Game {
    constructor(auth) {
        this.auth = auth;
        this.category = null;
        this.currentQuestionNumber = 0;
        this.correctAnswers = 0;
        this.currentQuestion = null;
        this.sessionResults = [];
        this.isProcessing = false;
        this.startTime = null;
        this.timerInterval = null;
    }

    /**
     * Gets the current user ID
     */
    getUserId() {
        return this.auth.getUserId();
    }

    /**
     * Gets the current username for display
     */
    getUsername() {
        return this.auth.getUsername() || 'Guest';
    }

    /**
     * Starts a new game with the selected category
     * @param {string} categoryId - The category to play
     */
    async start(categoryId) {
        this.category = categoryId;
        this.currentQuestionNumber = 0;
        this.correctAnswers = 0;
        this.sessionResults = [];
        this.isProcessing = false;
        resetLastQuestion();

        // Update UI
        this.updateCategoryDisplay();
        this.updateProgressCircles();
        await this.loadLeaderboard();

        // Start timer
        this.startTime = Date.now();
        this.startTimer();

        // Generate first question
        this.nextQuestion();

        // Focus answer input
        const answerInput = document.getElementById(ELEMENTS.ANSWER);
        if (answerInput) answerInput.focus();
    }

    /**
     * Start the game timer
     */
    startTimer() {
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => this.updateTimerDisplay(), 1000);
    }

    /**
     * Stop the game timer
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Update timer display
     */
    updateTimerDisplay() {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const timerEl = document.getElementById(ELEMENTS.TIMER_DISPLAY);
        if (timerEl) timerEl.textContent = display;
    }

    /**
     * Get elapsed time in milliseconds
     */
    getElapsedTime() {
        return Date.now() - this.startTime;
    }

    /**
     * Update category display
     */
    updateCategoryDisplay() {
        const displayEl = document.getElementById(ELEMENTS.CATEGORY_DISPLAY);
        if (displayEl) {
            displayEl.textContent = getCategoryDisplayName(this.category);
        }
    }

    /**
     * Generate and display next question
     */
    nextQuestion() {
        this.currentQuestionNumber++;
        this.currentQuestion = generateQuestion(this.category);

        const questionEl = document.getElementById(ELEMENTS.QUESTION);
        if (questionEl) {
            questionEl.textContent = this.currentQuestion.text;
        }

        // Clear answer input
        const answerInput = document.getElementById(ELEMENTS.ANSWER);
        if (answerInput) {
            answerInput.value = '';
            answerInput.focus();
        }

        // Clear feedback
        const feedbackEl = document.getElementById(ELEMENTS.FEEDBACK);
        if (feedbackEl) {
            feedbackEl.textContent = '';
            feedbackEl.className = 'feedback';
        }
    }

    /**
     * Check the user's answer
     * @returns {Promise<Object>} Result with isComplete flag
     */
    async checkAnswer() {
        if (this.isProcessing) return { isComplete: false };

        const answerInput = document.getElementById(ELEMENTS.ANSWER);
        const userAnswerText = answerInput?.value.trim();

        if (!userAnswerText) return { isComplete: false };

        this.isProcessing = true;

        const userAnswer = parseInt(userAnswerText, 10);
        const isCorrect = userAnswer === this.currentQuestion.answer;
        const feedbackEl = document.getElementById(ELEMENTS.FEEDBACK);

        // Record result
        this.sessionResults.push({
            question: this.currentQuestion.text,
            correctAnswer: this.currentQuestion.answer,
            userAnswer: userAnswer,
            isCorrect: isCorrect
        });

        if (isCorrect) {
            this.correctAnswers++;
            if (feedbackEl) {
                feedbackEl.textContent = 'Correct!';
                feedbackEl.className = 'feedback correct';
            }
        } else {
            if (feedbackEl) {
                feedbackEl.textContent = `Wrong! Answer: ${this.currentQuestion.answer}`;
                feedbackEl.className = 'feedback';
            }
        }

        // Update progress
        this.updateProgressCircles();

        // Check if game is complete
        if (this.currentQuestionNumber >= APP_CONFIG.QUESTIONS_PER_GAME) {
            this.isProcessing = false;
            await this.completeGame();
            return { isComplete: true };
        }

        // Wait briefly then show next question
        await this.delay(isCorrect ? 500 : 1200);
        this.nextQuestion();
        this.isProcessing = false;

        return { isComplete: false };
    }

    /**
     * Update progress circles display
     */
    updateProgressCircles() {
        const container = document.getElementById(ELEMENTS.PROGRESS_CIRCLES);
        if (!container) return;

        // Create circles if needed
        if (container.children.length === 0) {
            for (let i = 0; i < APP_CONFIG.QUESTIONS_PER_GAME; i++) {
                const circle = document.createElement('div');
                circle.className = 'progress-circle';
                container.appendChild(circle);
            }
        }

        // Update circle states
        const circles = container.children;
        for (let i = 0; i < circles.length; i++) {
            if (i < this.sessionResults.length) {
                circles[i].className = this.sessionResults[i].isCorrect
                    ? 'progress-circle correct'
                    : 'progress-circle incorrect';
            } else {
                circles[i].className = 'progress-circle';
            }
        }
    }

    /**
     * Complete the game and save score
     */
    async completeGame() {
        this.stopTimer();
        const elapsedMs = this.getElapsedTime();
        const score = this.correctAnswers;
        const userId = this.getUserId();

        // Save score to database
        if (userId) {
            await Storage.saveScore(userId, this.category, score, elapsedMs);
        }

        // Reload leaderboard to show new position
        await this.loadLeaderboard();

        return {
            score: score,
            total: APP_CONFIG.QUESTIONS_PER_GAME,
            timeMs: elapsedMs
        };
    }

    /**
     * Load and display leaderboard for current category
     */
    async loadLeaderboard() {
        const userId = this.getUserId();
        if (!userId || !this.category) return;

        const scores = await Storage.getTopScores(userId, this.category, APP_CONFIG.TOP_SCORES_COUNT);
        this.renderLeaderboard(scores);
    }

    /**
     * Render leaderboard
     * @param {Array} scores - Array of score objects
     */
    renderLeaderboard(scores) {
        const listEl = document.getElementById(ELEMENTS.LEADERBOARD_LIST);
        if (!listEl) return;

        if (!scores || scores.length === 0) {
            listEl.innerHTML = '<li class="empty">No scores yet</li>';
            return;
        }

        listEl.innerHTML = scores.map((score, index) => {
            const timeStr = this.formatTime(score.time_ms);
            const dateStr = this.formatDate(score.played_at);
            return `
                <li>
                    <span class="rank">${index + 1}.</span>
                    <span class="score">${score.score}/${APP_CONFIG.QUESTIONS_PER_GAME}</span>
                    <span class="time">${timeStr}</span>
                    <span class="date">${dateStr}</span>
                </li>
            `;
        }).join('');
    }

    /**
     * Format time in milliseconds to MM:SS
     */
    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Format date to DD/MM HH:MM
     */
    formatDate(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const mins = date.getMinutes().toString().padStart(2, '0');
        return `${day}/${month} ${hours}:${mins}`;
    }

    /**
     * Get personalized completion message
     */
    getCompletionMessage() {
        const username = this.getUsername();
        const messages = MESSAGES.GAME_COMPLETE[username] || MESSAGES.GAME_COMPLETE.Patrick;
        return messages[Math.floor(Math.random() * messages.length)];
    }

    /**
     * Get current game stats
     */
    getStats() {
        return {
            category: this.category,
            questionNumber: this.currentQuestionNumber,
            correctAnswers: this.correctAnswers,
            totalQuestions: APP_CONFIG.QUESTIONS_PER_GAME,
            elapsedTime: this.getElapsedTime()
        };
    }

    /**
     * Clean up game resources
     */
    cleanup() {
        this.stopTimer();
    }

    /**
     * Promise-based delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
