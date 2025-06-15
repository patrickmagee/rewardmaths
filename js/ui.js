/**
 * UI Management
 * Handles screen transitions and UI interactions
 */

import { ELEMENTS, REWARDS } from './config.js';
import { getElement } from './utils.js';

/**
 * UI class for managing screen transitions and interactions
 */
export class UI {
    constructor() {
        this.currentScreen = null;
    }

    /**
     * Shows the login screen
     */
    showLoginScreen() {
        this.hideAllScreens();
        const loginScreen = getElement(ELEMENTS.LOGIN_SCREEN);
        loginScreen.style.display = 'flex';
        this.currentScreen = 'login';
        
        // Clear any previous error messages
        const errorElement = getElement(ELEMENTS.LOGIN_ERROR);
        errorElement.textContent = '';
        
        // Clear input fields
        const usernameInput = getElement(ELEMENTS.USERNAME);
        const passwordInput = getElement(ELEMENTS.PASSWORD);
        usernameInput.value = '';
        passwordInput.value = '';
        
        // Focus on username input
        usernameInput.focus();
    }

    /**
     * Shows the game screen
     */
    showGameScreen() {
        this.hideAllScreens();
        const gameScreen = getElement(ELEMENTS.GAME_SCREEN);
        gameScreen.style.display = 'flex';
        this.currentScreen = 'game';
        
        // Clear feedback
        const feedback = getElement(ELEMENTS.FEEDBACK);
        feedback.textContent = '';
        
        // Focus on answer input
        const answerInput = getElement(ELEMENTS.ANSWER);
        answerInput.focus();
    }

    /**
     * Hides all screens
     */
    hideAllScreens() {
        const loginScreen = getElement(ELEMENTS.LOGIN_SCREEN);
        const gameScreen = getElement(ELEMENTS.GAME_SCREEN);
        
        loginScreen.style.display = 'none';
        gameScreen.style.display = 'none';
    }

    /**
     * Gets the current screen
     * @returns {string|null} Current screen name
     */
    getCurrentScreen() {
        return this.currentScreen;
    }

    /**
     * Sets up event listeners for UI elements
     * @param {Function} onLogin - Login callback function
     * @param {Function} onLogout - Logout callback function
     * @param {Function} onSubmitAnswer - Submit answer callback function
     */
    setupEventListeners(onLogin, onLogout, onSubmitAnswer) {
        // Login button
        const loginButton = getElement(ELEMENTS.LOGIN_BUTTON);
        loginButton.addEventListener('click', onLogin);

        // Enter key on login fields
        const usernameInput = getElement(ELEMENTS.USERNAME);
        const passwordInput = getElement(ELEMENTS.PASSWORD);
        
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                passwordInput.focus();
            }
        });
        
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                onLogin();
            }
        });

        // Submit button
        const submitButton = getElement(ELEMENTS.SUBMIT_BUTTON);
        submitButton.addEventListener('click', onSubmitAnswer);

        // Enter key on answer input
        const answerInput = getElement(ELEMENTS.ANSWER);
        answerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                onSubmitAnswer();
            }
        });

        // Logout button
        const logoutButton = getElement(ELEMENTS.LOGOUT_BUTTON);
        logoutButton.addEventListener('click', onLogout);
    }

    /**
     * Gets login form values
     * @returns {Object} Object containing username and password
     */
    getLoginFormValues() {
        const usernameInput = getElement(ELEMENTS.USERNAME);
        const passwordInput = getElement(ELEMENTS.PASSWORD);
        
        return {
            username: usernameInput.value.trim(),
            password: passwordInput.value
        };
    }

    /**
     * Displays an error message on the login screen
     * @param {string} message - Error message to display
     */
    showLoginError(message) {
        const errorElement = getElement(ELEMENTS.LOGIN_ERROR);
        errorElement.textContent = message;
    }

    /**
     * Clears the login error message
     */
    clearLoginError() {
        const errorElement = getElement(ELEMENTS.LOGIN_ERROR);
        errorElement.textContent = '';
    }

    /**
     * Shows a temporary message in the feedback area
     * @param {string} message - Message to display
     * @param {string} className - CSS class for styling
     * @param {number} duration - Duration in milliseconds (optional)
     */
    showFeedback(message, className = 'feedback', duration = null) {
        const feedback = getElement(ELEMENTS.FEEDBACK);
        feedback.textContent = message;
        feedback.className = className;
        
        if (duration) {
            setTimeout(() => {
                feedback.textContent = '';
                feedback.className = 'feedback';
            }, duration);
        }
    }

    /**
     * Clears the feedback message
     */
    clearFeedback() {
        const feedback = getElement(ELEMENTS.FEEDBACK);
        feedback.textContent = '';
        feedback.className = 'feedback';
    }

    /**
     * Shows a popup with a message
     * @param {string} message - Message to display
     * @returns {Promise} Promise that resolves when popup is dismissed
     */
    showPopup(message) {
        return new Promise((resolve) => {
            const modal = getElement(ELEMENTS.POPUP_MODAL);
            const messageElement = getElement(ELEMENTS.POPUP_MESSAGE);
            const okButton = getElement(ELEMENTS.POPUP_OK_BUTTON);
            
            messageElement.innerHTML = message;
            modal.style.display = 'flex';
            
            const handleClose = () => {
                modal.style.display = 'none';
                okButton.removeEventListener('click', handleClose);
                resolve();
            };
            
            okButton.addEventListener('click', handleClose);
        });
    }

    /**
     * Gets personalized level up message for user
     * @param {string} username - Username
     * @param {number} level - Current level
     * @returns {string} Personalized message
     */
    getLevelUpMessage(username, level) {
        const messages = REWARDS.MESSAGES[username] || REWARDS.MESSAGES.Patrick;
        const messageIndex = Math.min(Math.floor((level - 1) / 10), messages.length - 1);
        return messages[messageIndex];
    }

    /**
     * Gets reward unlock message for user
     * @param {string} username - Username
     * @param {number} rewardNumber - Reward number (1-10)
     * @returns {string} Reward unlock message
     */
    getRewardMessage(username, rewardNumber) {
        const baseMessage = `🎁 REWARD ${rewardNumber} UNLOCKED! 🎁<br><br>`;
        const personalMessage = this.getLevelUpMessage(username, rewardNumber * 10);
        return baseMessage + personalMessage;
    }
}
