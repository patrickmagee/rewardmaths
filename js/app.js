/**
 * Main Application Controller
 * Coordinates all application components and manages the overall application flow
 */

import { Auth } from './auth.js';
import { Game } from './game.js';
import { UI } from './ui.js';

/**
 * Main Application class that coordinates all components
 */
export class App {
    constructor() {
        this.auth = new Auth();
        this.ui = new UI();
        this.game = new Game(this.auth, this.ui);
        
        this.init();
    }

    /**
     * Initializes the application
     */
    init() {
        this.setupEventListeners();
        this.ui.showLoginScreen();
    }

    /**
     * Sets up all event listeners
     */
    setupEventListeners() {
        this.ui.setupEventListeners(
            () => this.handleLogin(),
            () => this.handleLogout(),
            () => this.handleSubmitAnswer()
        );
    }

    /**
     * Handles user login attempt
     */
    handleLogin() {
        const { username, password } = this.ui.getLoginFormValues();
        
        if (this.auth.login(username, password)) {
            this.ui.showGameScreen();
            this.game.start();
        }
        // Error handling is done within the Auth class
    }

    /**
     * Handles user logout
     */
    handleLogout() {
        this.auth.logout();
        this.ui.showLoginScreen();
    }

    /**
     * Handles answer submission
     */
    handleSubmitAnswer() {
        this.game.checkAnswer();
    }

    /**
     * Gets current application state
     * @returns {Object} Current application state
     */
    getState() {
        return {
            currentUser: this.auth.getCurrentUser(),
            currentScreen: this.ui.getCurrentScreen(),
            gameStats: this.game.getStats()
        };
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
