/**
 * UI Management
 * Handles screen transitions and UI interactions
 */

import { ELEMENTS } from './config.js';
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
     * Shows the menu screen
     * @param {string} displayName - User display name to show
     */
    showMenuScreen(displayName) {
        this.hideAllScreens();
        const menuScreen = getElement(ELEMENTS.MENU_SCREEN);
        menuScreen.style.display = 'flex';
        this.currentScreen = 'menu';

        // Update user info display
        const menuUserInfo = getElement(ELEMENTS.MENU_USER_INFO);
        if (menuUserInfo) {
            menuUserInfo.textContent = `Playing as: ${displayName}`;
        }
    }

    /**
     * Shows the game screen
     * @param {string} displayName - User display name to show
     */
    showGameScreen(displayName) {
        this.hideAllScreens();
        const gameScreen = getElement(ELEMENTS.GAME_SCREEN);
        gameScreen.style.display = 'flex';
        this.currentScreen = 'game';

        // Update user info in game header
        const userInfo = getElement(ELEMENTS.USER_INFO);
        if (userInfo) {
            userInfo.textContent = displayName;
        }

        // Clear feedback
        const feedback = getElement(ELEMENTS.FEEDBACK);
        feedback.textContent = '';

        // Clear progress circles
        const progressCircles = getElement(ELEMENTS.PROGRESS_CIRCLES);
        if (progressCircles) {
            progressCircles.innerHTML = '';
        }

        // Reset timer display
        const timerDisplay = getElement(ELEMENTS.TIMER_DISPLAY);
        if (timerDisplay) {
            timerDisplay.textContent = '0:00';
        }

        // Focus on answer input
        const answerInput = getElement(ELEMENTS.ANSWER);
        answerInput.focus();
    }

    /**
     * Hides all screens
     */
    hideAllScreens() {
        const loginScreen = getElement(ELEMENTS.LOGIN_SCREEN);
        const menuScreen = getElement(ELEMENTS.MENU_SCREEN);
        const gameScreen = getElement(ELEMENTS.GAME_SCREEN);

        loginScreen.style.display = 'none';
        menuScreen.style.display = 'none';
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
     * @param {Object} callbacks - Callback functions
     * @param {Function} callbacks.onLogin - Login callback (receives username)
     * @param {Function} callbacks.onSwitchPlayer - Switch player callback
     * @param {Function} callbacks.onCategorySelect - Category select callback (receives categoryId)
     * @param {Function} callbacks.onBackToMenu - Back to menu callback
     * @param {Function} callbacks.onSubmitAnswer - Submit answer callback
     */
    setupEventListeners(callbacks) {
        const { onLogin, onSwitchPlayer, onCategorySelect, onBackToMenu, onSubmitAnswer } = callbacks;

        // User selection buttons (login screen)
        document.querySelectorAll(ELEMENTS.USER_BUTTONS).forEach(button => {
            button.addEventListener('click', () => {
                const username = button.dataset.user;
                onLogin(username);
            });
        });

        // Switch player button (menu screen)
        const switchPlayerBtn = getElement(ELEMENTS.SWITCH_PLAYER_BUTTON);
        if (switchPlayerBtn) {
            switchPlayerBtn.addEventListener('click', onSwitchPlayer);
        }

        // Category buttons (menu screen)
        document.querySelectorAll(ELEMENTS.CATEGORY_BUTTONS).forEach(button => {
            button.addEventListener('click', () => {
                const category = button.dataset.category;
                onCategorySelect(category);
            });
        });

        // Times table buttons (menu screen)
        document.querySelectorAll(ELEMENTS.TIMES_TABLE_BUTTONS).forEach(button => {
            button.addEventListener('click', () => {
                const category = button.dataset.category;
                onCategorySelect(category);
            });
        });

        // Back button (game screen)
        const backButton = getElement(ELEMENTS.BACK_BUTTON);
        if (backButton) {
            backButton.addEventListener('click', onBackToMenu);
        }

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
}
