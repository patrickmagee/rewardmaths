/**
 * Game Logic
 * Handles math question generation, answer checking, and game progression
 */

import { APP_CONFIG, ELEMENTS, REWARDS } from './config.js';
import { randomInt, getElement, getIntegerValue, clamp, delay } from './utils.js';
import { Storage } from './storage.js';

/**
 * Game class for managing math game logic
 */
export class Game {
    constructor(auth, ui) {
        this.auth = auth;
        this.ui = ui;
        this.correctStreak = 0;
        this.level = 1;
        this.currentQuestion = null;
    }

    /**
     * Starts a new game session
     */
    start() {
        this.correctStreak = 0;
        const currentUser = this.auth.getCurrentUser();
        
        if (currentUser && currentUser.username) {
            this.level = Storage.getUserLevel(currentUser.username);
        } else {
            this.level = APP_CONFIG.MIN_LEVEL;
        }

        this.updateProgressBar();
        this.updateLevelBar();
        this.initializeRewardMarkers();
        this.generateQuestion();
        this.updateUserInfo();
    }

    /**
     * Generates a new math question
     */
    generateQuestion() {
        const num1 = randomInt(1, 10);
        const num2 = randomInt(1, 10);
        const operation = '+';
        const questionText = `${num1} ${operation} ${num2}`;
        const answer = num1 + num2;

        this.currentQuestion = {
            text: questionText,
            answer: answer
        };

        const questionElement = getElement(ELEMENTS.QUESTION);
        questionElement.textContent = questionText;
        questionElement.dataset.answer = answer;
    }

    /**
     * Checks the user's answer and updates game state
     */
    async checkAnswer() {
        const answerInput = getElement(ELEMENTS.ANSWER);
        const userAnswer = getIntegerValue(answerInput);
        const correctAnswer = this.currentQuestion.answer;
        const feedback = getElement(ELEMENTS.FEEDBACK);

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
        this.correctStreak++;
        this.updateProgressBar();
        
        feedback.textContent = 'Correct!';
        feedback.className = 'feedback correct';

        if (this.correctStreak === APP_CONFIG.QUESTIONS_PER_LEVEL) {
            await this.handleLevelUp(feedback);
        } else {
            await delay(500);
            this.generateQuestion();
            feedback.textContent = '';
        }
    }

    /**
     * Handles level up logic
     * @param {HTMLElement} feedback - Feedback element
     */
    async handleLevelUp(feedback) {
        const oldLevel = this.level;
        this.level = clamp(this.level + 1, APP_CONFIG.MIN_LEVEL, APP_CONFIG.MAX_LEVEL);
        const currentUser = this.auth.getCurrentUser();
        
        if (currentUser && currentUser.username) {
            Storage.setUserLevel(currentUser.username, this.level);
        }
        
        this.updateLevelBar();
        this.updateRewardMarkers();
        
        // Show level up feedback
        feedback.textContent = '🎉 You got 10 in a row correct! Level up!';
        feedback.className = 'feedback correct';
        
        await delay(1500);
        
        // Show personalized level up popup
        const username = currentUser?.username || 'Patrick';
        const levelUpMessage = this.ui.getLevelUpMessage(username, this.level);
        await this.ui.showPopup(levelUpMessage);
        
        // Check if this is a reward milestone
        if (REWARDS.MILESTONES.includes(this.level)) {
            const rewardNumber = REWARDS.MILESTONES.indexOf(this.level) + 1;
            const rewardMessage = this.ui.getRewardMessage(username, rewardNumber);
            await this.ui.showPopup(rewardMessage);
        }
        
        this.correctStreak = 0;
        this.updateProgressBar();
        this.generateQuestion();
        feedback.textContent = '';
    }

    /**
     * Handles incorrect answer logic
     * @param {HTMLElement} feedback - Feedback element
     * @param {number} correctAnswer - The correct answer
     */
    async handleIncorrectAnswer(feedback, correctAnswer) {
        this.correctStreak = 0;
        this.level = clamp(this.level - 1, APP_CONFIG.MIN_LEVEL, APP_CONFIG.MAX_LEVEL);
        const currentUser = this.auth.getCurrentUser();
        
        if (currentUser && currentUser.username) {
            Storage.setUserLevel(currentUser.username, this.level);
        }
        
        this.updateProgressBar();
        this.updateLevelBar();
        
        feedback.textContent = `Wrong! The correct answer was ${correctAnswer}. Level down. Starting over.`;
        feedback.className = 'feedback';
        
        await delay(1500);
        this.generateQuestion();
        feedback.textContent = '';
    }

    /**
     * Updates the progress bar display
     */
    updateProgressBar() {
        const progressBar = getElement(ELEMENTS.PROGRESS_BAR);
        const progressText = getElement(ELEMENTS.PROGRESS_TEXT);
        const progressPercentage = (this.correctStreak / APP_CONFIG.QUESTIONS_PER_LEVEL) * 100;
        
        progressBar.style.width = `${progressPercentage}%`;
        progressText.textContent = `${this.correctStreak}/${APP_CONFIG.QUESTIONS_PER_LEVEL}`;
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
     * Initializes reward markers on the level bar
     */
    initializeRewardMarkers() {
        const rewardMarkersContainer = getElement(ELEMENTS.REWARD_MARKERS);
        rewardMarkersContainer.innerHTML = '';
        
        REWARDS.MILESTONES.forEach((milestone, index) => {
            const marker = document.createElement('div');
            marker.className = 'reward-marker';
            marker.textContent = `Reward ${index + 1}`;
            
            // Position marker based on milestone level (0-100% of container height)
            const position = (milestone / 100) * 100;
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
            correctStreak: this.correctStreak,
            questionsRemaining: APP_CONFIG.QUESTIONS_PER_LEVEL - this.correctStreak
        };
    }
}
