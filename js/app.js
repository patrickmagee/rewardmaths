/**
 * Main Application Controller
 * Coordinates all application components and manages the overall application flow
 */

import { Auth } from './auth.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { isSupabaseConfigured } from './supabase.js';

/**
 * Main Application class that coordinates all components
 */
export class App {
    constructor() {
        this.auth = new Auth();
        this.ui = new UI();
        this.game = null; // Initialize after auth is ready
        this.isInitialized = false;

        this.init();
    }

    /**
     * Initializes the application
     */
    async init() {
        // Check Supabase configuration
        if (!isSupabaseConfigured()) {
            console.warn('Supabase is not configured. Please update js/supabase.js with your credentials.');
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
        this.ui.setupEventListeners(
            (username) => this.handleLogin(username),
            () => this.handleLogout(),
            () => this.handleSubmitAnswer()
        );
    }

    /**
     * Handles auth state changes from Supabase
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
     * Handles user login by name
     * @param {string} username - The username to login as
     */
    async handleLogin(username) {
        if (!username) {
            this.ui.showLoginError('Please select a user.');
            return;
        }

        // Show loading state
        this.ui.showLoading();
        this.ui.clearLoginError();

        try {
            const result = await this.auth.loginByName(username);

            if (result.success) {
                // Create game instance and start
                this.game = new Game(this.auth, this.ui);
                this.ui.showGameScreen();
                await this.game.start();
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
     * Handles user logout
     */
    async handleLogout() {
        try {
            await this.auth.logout();
            this.game = null;
            this.ui.showLoginScreen();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    /**
     * Handles answer submission
     */
    async handleSubmitAnswer() {
        if (this.game) {
            await this.game.checkAnswer();
        }
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
