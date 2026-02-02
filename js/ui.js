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

        // Hide password section
        this.hidePasswordSection();

        // Re-enable user buttons
        document.querySelectorAll(ELEMENTS.USER_BUTTONS).forEach(btn => {
            btn.disabled = false;
        });
    }

    /**
     * Shows the password section for a selected user
     * @param {string} username - The selected username
     */
    showPasswordSection(username) {
        const section = getElement(ELEMENTS.PASSWORD_SECTION);
        const selectedUser = getElement(ELEMENTS.SELECTED_USER);
        const passwordInput = getElement(ELEMENTS.PASSWORD_INPUT);

        selectedUser.textContent = username;
        section.style.display = 'block';
        passwordInput.value = '';
        passwordInput.focus();
    }

    /**
     * Hides the password section
     */
    hidePasswordSection() {
        const section = getElement(ELEMENTS.PASSWORD_SECTION);
        const passwordInput = getElement(ELEMENTS.PASSWORD_INPUT);

        if (section) section.style.display = 'none';
        if (passwordInput) passwordInput.value = '';
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
     */
    setupEventListeners(callbacks) {
        const { onLogin, onSwitchPlayer, onCategorySelect, onBackToMenu, onSubmitAnswer, onRestart, onExit } = callbacks;

        // Track selected user for password login
        let selectedUsername = null;

        // User selection buttons (login screen) - show password section
        document.querySelectorAll(ELEMENTS.USER_BUTTONS).forEach(button => {
            button.addEventListener('click', () => {
                selectedUsername = button.dataset.user;
                this.showPasswordSection(selectedUsername);
            });
        });

        // Login button (submit password)
        const loginButton = getElement(ELEMENTS.LOGIN_BUTTON);
        if (loginButton) {
            loginButton.addEventListener('click', () => {
                const passwordInput = getElement(ELEMENTS.PASSWORD_INPUT);
                const password = passwordInput?.value || '';
                if (selectedUsername) {
                    onLogin(selectedUsername, password);
                }
            });
        }

        // Cancel button (hide password section)
        const cancelButton = getElement(ELEMENTS.CANCEL_BUTTON);
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                selectedUsername = null;
                this.hidePasswordSection();
                this.clearLoginError();
            });
        }

        // Enter key on password input
        const passwordInput = getElement(ELEMENTS.PASSWORD_INPUT);
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && selectedUsername) {
                    onLogin(selectedUsername, passwordInput.value || '');
                }
            });
        }

        // Switch player button (menu screen)
        const switchPlayerBtn = getElement(ELEMENTS.SWITCH_PLAYER_BUTTON);
        if (switchPlayerBtn) {
            switchPlayerBtn.addEventListener('click', onSwitchPlayer);
        }

        // Game tile buttons (menu screen) - all category selections
        document.querySelectorAll('.game-tile').forEach(button => {
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

        // Restart button (game screen)
        const restartButton = getElement(ELEMENTS.RESTART_BUTTON);
        if (restartButton) {
            restartButton.addEventListener('click', onRestart);
        }

        // Exit button (game screen)
        const exitButton = getElement(ELEMENTS.EXIT_BUTTON);
        if (exitButton) {
            exitButton.addEventListener('click', onExit);
        }

        // Submit button
        const submitButton = getElement(ELEMENTS.SUBMIT_BUTTON);
        submitButton.addEventListener('click', onSubmitAnswer);

        // Enter key on answer input and input validation
        const answerInput = getElement(ELEMENTS.ANSWER);
        answerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isPopupVisible()) {
                onSubmitAnswer();
            }
        });

        // Restrict input to digits only
        answerInput.addEventListener('input', (e) => {
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
     * Check if popup is currently visible
     */
    isPopupVisible() {
        const modal = document.getElementById(ELEMENTS.POPUP_MODAL);
        return modal && modal.style.display !== 'none';
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
     * Shows a popup with a message and Play Again/Exit options
     * @param {string} message - Message to display
     * @returns {Promise<string>} Promise that resolves with 'playAgain' or 'exit'
     */
    showPopup(message) {
        return new Promise((resolve) => {
            const modal = getElement(ELEMENTS.POPUP_MODAL);
            const messageElement = getElement(ELEMENTS.POPUP_MESSAGE);
            const playAgainButton = getElement(ELEMENTS.POPUP_PLAY_AGAIN_BUTTON);
            const exitButton = getElement(ELEMENTS.POPUP_EXIT_BUTTON);

            messageElement.innerHTML = message;
            modal.style.display = 'flex';

            const handlePlayAgain = () => {
                modal.style.display = 'none';
                playAgainButton.removeEventListener('click', handlePlayAgain);
                exitButton.removeEventListener('click', handleExit);
                resolve('playAgain');
            };

            const handleExit = () => {
                modal.style.display = 'none';
                playAgainButton.removeEventListener('click', handlePlayAgain);
                exitButton.removeEventListener('click', handleExit);
                resolve('exit');
            };

            playAgainButton.addEventListener('click', handlePlayAgain);
            exitButton.addEventListener('click', handleExit);
        });
    }
}
