/**
 * Application Configuration
 * Contains all configuration constants and settings
 */

// Application Constants
export const APP_CONFIG = {
    QUESTIONS_PER_GAME: 20,
    TOP_SCORES_COUNT: 10
};

// Game Categories
export const CATEGORIES = {
    ADD_EASY: { id: 'add_easy', name: 'Addition', difficulty: 'Easy', icon: '➕', color: '#22bb33' },
    ADD_MEDIUM: { id: 'add_medium', name: 'Addition', difficulty: 'Medium', icon: '➕', color: '#f0ad4e' },
    ADD_HARD: { id: 'add_hard', name: 'Addition', difficulty: 'Hard', icon: '➕', color: '#dc3545' },

    SUB_EASY: { id: 'sub_easy', name: 'Subtraction', difficulty: 'Easy', icon: '➖', color: '#22bb33' },
    SUB_MEDIUM: { id: 'sub_medium', name: 'Subtraction', difficulty: 'Medium', icon: '➖', color: '#f0ad4e' },
    SUB_HARD: { id: 'sub_hard', name: 'Subtraction', difficulty: 'Hard', icon: '➖', color: '#dc3545' },

    MULTIPLY_2: { id: 'multiply_2', name: '2 Times Table', difficulty: null, icon: '✖️', color: '#667eea' },
    MULTIPLY_3: { id: 'multiply_3', name: '3 Times Table', difficulty: null, icon: '✖️', color: '#667eea' },
    MULTIPLY_4: { id: 'multiply_4', name: '4 Times Table', difficulty: null, icon: '✖️', color: '#667eea' },
    MULTIPLY_5: { id: 'multiply_5', name: '5 Times Table', difficulty: null, icon: '✖️', color: '#667eea' },
    MULTIPLY_6: { id: 'multiply_6', name: '6 Times Table', difficulty: null, icon: '✖️', color: '#667eea' },
    MULTIPLY_7: { id: 'multiply_7', name: '7 Times Table', difficulty: null, icon: '✖️', color: '#667eea' },
    MULTIPLY_8: { id: 'multiply_8', name: '8 Times Table', difficulty: null, icon: '✖️', color: '#667eea' },
    MULTIPLY_9: { id: 'multiply_9', name: '9 Times Table', difficulty: null, icon: '✖️', color: '#667eea' },
    MULTIPLY_10: { id: 'multiply_10', name: '10 Times Table', difficulty: null, icon: '✖️', color: '#667eea' },
    MULTIPLY_11: { id: 'multiply_11', name: '11 Times Table', difficulty: null, icon: '✖️', color: '#667eea' },
    MULTIPLY_12: { id: 'multiply_12', name: '12 Times Table', difficulty: null, icon: '✖️', color: '#667eea' }
};

// Category difficulty settings
export const DIFFICULTY_SETTINGS = {
    add_easy: { min1: 1, max1: 10, min2: 1, max2: 10 },
    add_medium: { min1: 10, max1: 50, min2: 10, max2: 50 },
    add_hard: { min1: 50, max1: 100, min2: 50, max2: 100 },

    sub_easy: { min1: 5, max1: 20, min2: 1, max2: 10 },      // Result always positive
    sub_medium: { min1: 20, max1: 100, min2: 10, max2: 50 },
    sub_hard: { min1: 100, max1: 200, min2: 50, max2: 100 }
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

    // Menu elements
    MENU_USER_INFO: 'menuUserInfo',
    SWITCH_PLAYER_BUTTON: 'switchPlayerBtn',
    CATEGORY_BUTTONS: '.category-btn',
    TIMES_TABLE_BUTTONS: '.times-table-btn',

    // Game elements
    PLAYER_BANNER: 'playerBanner',
    USER_INFO: 'userInfo',
    CATEGORY_DISPLAY: 'categoryDisplay',
    QUESTION: 'question',
    ANSWER: 'answer',
    SUBMIT_BUTTON: 'submitButton',
    FEEDBACK: 'feedback',
    BACK_BUTTON: 'backButton',

    // Progress elements
    PROGRESS_CIRCLES: 'progressCircles',
    TIMER_DISPLAY: 'timerDisplay',

    // Leaderboard elements
    LEADERBOARD: 'leaderboard',
    LEADERBOARD_LIST: 'leaderboardList',

    // Popup elements
    POPUP_MODAL: 'popupModal',
    POPUP_MESSAGE: 'popupMessage',
    POPUP_OK_BUTTON: 'popupOkButton'
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
