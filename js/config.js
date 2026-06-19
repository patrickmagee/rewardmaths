/**
 * Application Configuration
 * Contains all configuration constants and settings
 */

// Application Constants
export const APP_CONFIG = {
    QUESTIONS_PER_GAME: 10,
    TOP_SCORES_COUNT: 10
};

// Category difficulty settings
export const DIFFICULTY_SETTINGS = {
    add_easy: { min1: 1, max1: 10, min2: 1, max2: 10 },           // Single + Single
    add_medium: { min1: 10, max1: 99, min2: 1, max2: 9 },         // Double + Single
    add_hard: { min1: 10, max1: 99, min2: 10, max2: 99 },         // Double + Double

    sub_easy: { min1: 5, max1: 20, min2: 1, max2: 10 },           // Result always positive
    sub_medium: { min1: 10, max1: 99, min2: 1, max2: 9 },         // Double - Single
    sub_hard: { min1: 20, max1: 99, min2: 10, max2: 50 }          // Double - Double
};

// UI Element IDs
export const ELEMENTS = {
    // Screens
    LOGIN_SCREEN: 'loginScreen',
    MENU_SCREEN: 'menuScreen',
    GAME_SCREEN: 'gameScreen',

    // Login elements
    USER_BUTTONS: '.user-btn',
    LOGIN_ERROR: 'loginError',
    PASSWORD_SECTION: 'passwordSection',
    PASSWORD_INPUT: 'passwordInput',
    SELECTED_USER: 'selectedUser',
    LOGIN_BUTTON: 'loginButton',
    CANCEL_BUTTON: 'cancelButton',

    // Menu elements
    MENU_USER_INFO: 'menuUserInfo',
    SWITCH_PLAYER_BUTTON: 'switchPlayerBtn',
    GAME_TILES: '.game-tile',

    // Game elements
    USER_INFO: 'userInfo',
    CATEGORY_DISPLAY: 'categoryDisplay',
    QUESTION: 'question',
    ANSWER: 'answer',
    SUBMIT_BUTTON: 'submitButton',
    FEEDBACK: 'feedback',
    BACK_BUTTON: 'backButton',
    RESTART_BUTTON: 'restartButton',
    EXIT_BUTTON: 'exitButton',

    // Progress elements
    PROGRESS_CIRCLES: 'progressCircles',
    TIMER_DISPLAY: 'timerDisplay',

    // Leaderboard elements
    LEADERBOARD_LIST: 'leaderboardList',

    // Popup elements
    POPUP_MODAL: 'popupModal',
    POPUP_MESSAGE: 'popupMessage',
    POPUP_PLAY_AGAIN_BUTTON: 'popupPlayAgainButton',
    POPUP_EXIT_BUTTON: 'popupExitButton'
};

// Personalized messages
export const MESSAGES = {
    GAME_COMPLETE: {
        Tom: [
            "🦖 Roar! Amazing work, Tom!",
            "⚡ You're crushing it like a superhero!",
            "🦸‍♂️ Batman would be proud!"
        ],
        Eliza: [
            "🌸 Sugoi! Great job, Eliza-chan!",
            "✨ Your math skills are sparkling!",
            "🎀 Kawaii! You're leveling up!"
        ],
        Patrick: [
            "🎉 Excellent work, Patrick!",
            "🌟 Your skills are really shining!",
            "🚀 You're reaching new heights!"
        ]
    }
};
