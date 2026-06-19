/**
 * Main Application Controller
 * Coordinates all application components and manages the overall application flow
 */

import { Auth } from './auth.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Storage } from './storage.js';
import { APP_CONFIG } from './config.js';
import { isSupabaseConfigured, ready } from './localdb.js';
import { getWeekStartMs } from './utils.js';

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

            // Ensure the default profiles are seeded before enabling login,
            // so a very fast first login can't miss the not-yet-written users.
            await ready;

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
            onBackToMenu: () => { this.handleBackToMenu().catch((e) => console.error(e)); },
            onSubmitAnswer: () => this.handleSubmitAnswer(),
            onRestart: () => this.handleRestart(),
            onExit: () => { this.handleBackToMenu().catch((e) => console.error(e)); }
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
                // Show menu screen (with this week's aced ticks) after login
                await this.showMenu();
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
    async handleBackToMenu() {
        // Clean up current game
        if (this.game) {
            this.game.cleanup();
            this.game = null;
        }

        // Show menu screen (refreshing this week's aced ticks)
        await this.showMenu();
    }

    /**
     * Shows the menu screen and refreshes this week's "aced" ticks.
     */
    async showMenu() {
        const displayName = this.auth.getUsername();
        this.ui.showMenuScreen(displayName);
        await this.refreshWeeklyTicks();
    }

    /**
     * Computes which categories the current user has aced (scored
     * QUESTIONS_PER_GAME/10) since the start of this week — the most recent
     * Sunday midnight, local time — and marks those tiles. Because the window
     * is derived from the current time, the ticks reset every Sunday with no
     * stored state or scheduled job.
     */
    async refreshWeeklyTicks() {
        const userId = this.auth.getUserId();
        if (!userId) return;
        try {
            const sinceIso = new Date(getWeekStartMs()).toISOString();
            const aced = await Storage.getWeeklyPerfectCategories(userId, sinceIso);
            // Latest-request-wins: if the player switched, logged out, or left the
            // menu while this read was in flight, drop the now-stale result rather
            // than painting one user's ticks for another.
            if (this.auth.getUserId() !== userId || this.ui.getCurrentScreen() !== 'menu') return;
            this.ui.updateWeeklyTicks(aced);
        } catch (error) {
            console.error('Failed to refresh weekly ticks:', error);
        }
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
                    await this.handleBackToMenu();
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
