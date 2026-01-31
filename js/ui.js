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

        // Re-enable user buttons
        document.querySelectorAll(ELEMENTS.USER_BUTTONS).forEach(btn => {
            btn.disabled = false;
        });
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
     * @param {Function} onLogin - Login callback function (receives username)
     * @param {Function} onLogout - Logout callback function
     * @param {Function} onSubmitAnswer - Submit answer callback function
     */
    setupEventListeners(onLogin, onLogout, onSubmitAnswer) {
        // User selection buttons
        document.querySelectorAll(ELEMENTS.USER_BUTTONS).forEach(button => {
            button.addEventListener('click', () => {
                const username = button.dataset.user;
                onLogin(username);
            });
        });

        // Submit button
        const submitButton = getElement(ELEMENTS.SUBMIT_BUTTON);
        submitButton.addEventListener('click', onSubmitAnswer);

        // Enter key on answer input and input validation
        const answerInput = getElement(ELEMENTS.ANSWER);
        answerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                onSubmitAnswer();
            }
        });

        // Restrict input to digits only
        answerInput.addEventListener('input', (e) => {
            // Remove any non-digit characters
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });

        answerInput.addEventListener('keydown', (e) => {
            // Allow: backspace, delete, tab, escape, enter, and arrow keys
            if ([8, 9, 27, 13, 37, 38, 39, 40, 46].indexOf(e.keyCode) !== -1 ||
                // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                (e.keyCode === 65 && e.ctrlKey === true) ||
                (e.keyCode === 67 && e.ctrlKey === true) ||
                (e.keyCode === 86 && e.ctrlKey === true) ||
                (e.keyCode === 88 && e.ctrlKey === true)) {
                return;
            }
            // Ensure that it is a number and stop the keypress
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                e.preventDefault();
            }
        });

        // Logout button
        const logoutButton = getElement(ELEMENTS.LOGOUT_BUTTON);
        logoutButton.addEventListener('click', onLogout);
    }

    /**
     * Shows loading state on user buttons
     */
    showLoading() {
        document.querySelectorAll(ELEMENTS.USER_BUTTONS).forEach(btn => {
            btn.disabled = true;
        });
    }

    /**
     * Hides loading state on user buttons
     */
    hideLoading() {
        document.querySelectorAll(ELEMENTS.USER_BUTTONS).forEach(btn => {
            btn.disabled = false;
        });
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
