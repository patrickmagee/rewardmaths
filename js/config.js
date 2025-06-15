/**
 * Application Configuration
 * Contains all configuration constants and settings
 */

// Application Constants
export const APP_CONFIG = {
    STORAGE_KEY: 'rewardmaths_levels',
    MAX_LEVEL: 100,
    MIN_LEVEL: 1,
    QUESTIONS_PER_LEVEL: 10,
    TIMEOUT_DURATIONS: [1000, 5000, 30000, 60000, 300000, 1800000, 3600000, 86400000]
};

// Predefined users
export const USERS = [
    { username: 'Tom', password: 'Tom1234' },
    { username: 'Patrick', password: 'Patrick1234' },
    { username: 'Eliza', password: 'Eliza1234' }
];

// UI Element IDs
export const ELEMENTS = {
    // Screens
    LOGIN_SCREEN: 'loginScreen',
    GAME_SCREEN: 'gameScreen',
    
    // Login elements
    USERNAME: 'username',
    PASSWORD: 'password',
    LOGIN_BUTTON: 'loginButton',
    LOGIN_ERROR: 'loginError',
    
    // Game elements
    USER_INFO: 'userInfo',
    QUESTION: 'question',
    ANSWER: 'answer',
    SUBMIT_BUTTON: 'submitButton',
    FEEDBACK: 'feedback',
    LOGOUT_BUTTON: 'logoutButton',
    
    // Progress elements
    PROGRESS_BAR: 'progressBar',
    PROGRESS_TEXT: 'progressText',
    LEVEL_BAR: 'levelBar',
    LEVEL_TEXT: 'levelText'
};
