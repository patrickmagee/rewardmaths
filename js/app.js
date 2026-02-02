/**
 * Main Application Controller
 * Coordinates all application components and manages the overall application flow
 */

import { Auth } from './auth.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { APP_CONFIG } from './config.js';
import { isSupabaseConfigured } from './localdb.js';

/**
 * Main Application class that coordinates all components
 */
export class App {
    constructor() {
        this.auth = new Auth();
        this.ui = new UI();
        this.game = null;
        this.isInitialized = false;

        this.init();
    }

    /**
     * Initializes the application
     */
    async init() {
        // Check database configuration
        if (!isSupabaseConfigured()) {
            console.warn('Database is not configured.');
            this.ui.showLoginScreen();
            this.ui.showLoginError('App not configured. Please contact administrator.');
            return;
        }

        this.setupEventListeners();

        // Show loading state
        this.ui.showLoading();

        try {
            // Always start fresh - clear any existing session
            // This is a kid's app, so always show user selection
            await this.auth.logout();

            // Show login screen
            this.ui.showLoginScreen();

            // Subscribe to auth state changes
            this.auth.subscribeToAuthChanges((event, session, profile) => {
                this.handleAuthStateChange(event, session, profile);
            });

            this.isInitialized = true;
        } catch (error) {
            console.error('Initialization error:', error);
            this.ui.showLoginScreen();
            this.ui.showLoginError('Failed to initialize. Please refresh the page.');
        }
    }

    /**
     * Sets up all event listeners
     */
    setupEventListeners() {
        this.ui.setupEventListeners({
            onLogin: (username, password) => this.handleLogin(username, password),
            onSwitchPlayer: () => this.handleSwitchPlayer(),
            onCategorySelect: (categoryId) => this.handleCategorySelect(categoryId),
            onBackToMenu: () => this.handleBackToMenu(),
            onSubmitAnswer: () => this.handleSubmitAnswer(),
            onRestart: () => this.handleRestart(),
            onExit: () => this.handleBackToMenu()
        });
    }

    /**
     * Handles auth state changes
     * @param {string} event - Auth event type
     * @param {Object} session - Session object
     * @param {Object} profile - User profile
     */
    handleAuthStateChange(event, session, profile) {
        console.log('Auth state change:', event);

        if (event === 'SIGNED_OUT') {
            this.game = null;
            this.ui.showLoginScreen();
        }
    }

    /**
     * Handles user login by name with password
     * @param {string} username - The username to login as
     * @param {string} password - The user's password
     */
    async handleLogin(username, password) {
        if (!username) {
            this.ui.showLoginError('Please select a user.');
            return;
        }

        if (!password) {
            this.ui.showLoginError('Please enter your password.');
            return;
        }

        // Show loading state
        this.ui.showLoading();
        this.ui.clearLoginError();

        try {
            const result = await this.auth.loginByName(username, password);

            if (result.success) {
                // Show menu screen after login
                const displayName = this.auth.getUsername();
                this.ui.showMenuScreen(displayName);
            } else {
                this.ui.hideLoading();
                this.ui.showLoginError(result.error || 'Login failed. Please try again.');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.ui.hideLoading();
            this.ui.showLoginError('An unexpected error occurred. Please try again.');
        }
    }

    /**
     * Handles switching to a different player
     */
    async handleSwitchPlayer() {
        try {
            await this.auth.logout();
            this.game = null;
            this.ui.showLoginScreen();
        } catch (error) {
            console.error('Switch player error:', error);
        }
    }

    /**
     * Handles category selection from menu
     * @param {string} categoryId - The selected category
     */
    async handleCategorySelect(categoryId) {
        if (!categoryId) return;

        // Create new game instance
        this.game = new Game(this.auth);

        // Show game screen
        const displayName = this.auth.getUsername();
        this.ui.showGameScreen(displayName);

        // Start the game with selected category
        await this.game.start(categoryId);
    }

    /**
     * Handles going back to menu from game
     */
    handleBackToMenu() {
        // Clean up current game
        if (this.game) {
            this.game.cleanup();
            this.game = null;
        }

        // Show menu screen
        const displayName = this.auth.getUsername();
        this.ui.showMenuScreen(displayName);
    }

    /**
     * Handles restarting the current game
     */
    async handleRestart() {
        if (this.game) {
            const categoryId = this.game.category;
            this.game.cleanup();

            // Create new game with same category
            this.game = new Game(this.auth);
            const displayName = this.auth.getUsername();
            this.ui.showGameScreen(displayName);
            await this.game.start(categoryId);
        }
    }

    /**
     * Handles answer submission
     */
    async handleSubmitAnswer() {
        if (this.game) {
            const result = await this.game.checkAnswer();

            // If game is complete, show completion popup with options
            if (result.isComplete) {
                const stats = this.game.getStats();
                const message = this.game.getCompletionMessage();
                const scoreText = `Score: ${stats.correctAnswers}/${APP_CONFIG.QUESTIONS_PER_GAME}`;
                const timeText = this.formatTime(stats.elapsedTime);

                const choice = await this.ui.showPopup(`${message}<br><br>${scoreText}<br>Time: ${timeText}`);

                if (choice === 'playAgain') {
                    await this.handleRestart();
                } else {
                    this.handleBackToMenu();
                }
            }
        }
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
     * Gets current application state
     * @returns {Object} Current application state
     */
    getState() {
        return {
            currentUser: this.auth.getCurrentUser(),
            currentScreen: this.ui.getCurrentScreen(),
            gameStats: this.game?.getStats() || null,
            isInitialized: this.isInitialized
        };
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
