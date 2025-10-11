/**
 * Application Configuration
 * Contains all configuration constants and settings
 */

// Application Constants
export const APP_CONFIG = {
    STORAGE_KEY: 'rewardmaths_levels',
    MAX_LEVEL: 100,
    MIN_LEVEL: 1,
    QUESTIONS_PER_LEVEL: 20,
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
    PROGRESS_CIRCLES: 'progressCircles',
    STREAK_INFO: 'streakInfo',
    LEVEL_BAR: 'levelBar',
    LEVEL_TEXT: 'levelText',

    // New elements
    REWARD_MARKERS: 'rewardMarkers',
    POPUP_MODAL: 'popupModal',
    POPUP_MESSAGE: 'popupMessage',
    POPUP_OK_BUTTON: 'popupOkButton'
};

// Reward milestones configuration
export const REWARDS = {
    MILESTONES: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    LEVEL_DOWN_MESSAGES: {
        Tom: "🦖 Great effort, Tom! Even the best dinosaur trainers need to step back sometimes. You've got this!",
        Eliza: "🌸 Great effort, Eliza-chan! Even magical girls sometimes need to power up at a lower level. Ganbatte!",
        Patrick: "🌟 Great effort, Patrick! We're stepping back a level to build your confidence. You're doing great!"
    },
    MESSAGES: {
        Tom: [
            "🦖 Awesome work, Tom! You're as unstoppable as Blue from Camp Cretaceous!",
            "⚡ Incredible! You've got the power of Thor's hammer in math!",
            "🦸‍♂️ Amazing! Batman would be proud of your detective-level problem solving!",
            "🌟 Fantastic! You're leveling up like a true superhero origin story!",
            "🔥 Outstanding! You're as fierce as the Indoraptor but way smarter!",
            "💥 Spectacular! The Flash couldn't solve problems faster than you!",
            "🎯 Brilliant! You've got the precision of Hawkeye's arrows!",
            "🚀 Phenomenal! You're soaring higher than Iron Man!",
            "⭐ Legendary! Even the dinosaurs of Isla Nublar respect your skills!",
            "🏆 ULTIMATE CHAMPION! You've mastered math like a true hero!"
        ],
        Eliza: [
            "🌸 Sugoi! You're as determined as Sailor Moon, Eliza-chan!",
            "✨ Kawaii! Your math skills are sparkling like magical girl powers!",
            "🎀 Incredible! You're leveling up like the main character in your favorite anime!",
            "🌟 Amazing! You've got the spirit of a true magical girl warrior!",
            "💫 Fantastic! Your dedication rivals any anime protagonist!",
            "🦋 Beautiful work! You're graceful and powerful like a butterfly transformation!",
            "🌙 Wonderful! You shine brighter than the moon in a magical anime!",
            "🎭 Spectacular! Your skills are as impressive as any anime special attack!",
            "🌺 Marvelous! You're blooming with knowledge like cherry blossoms!",
            "👑 LEGENDARY PRINCESS! You've achieved the ultimate anime power level!"
        ],
        Patrick: [
            "🎉 Excellent work, Patrick! You're crushing these math problems!",
            "🌟 Great job! Your problem-solving skills are really shining!",
            "🚀 Fantastic! You're reaching new heights with every level!",
            "💪 Amazing! Your mathematical strength keeps growing!",
            "🎯 Outstanding! You're hitting every target with precision!",
            "⭐ Brilliant! Your dedication is truly paying off!",
            "🔥 Incredible! You're on fire with these calculations!",
            "🏆 Superb! You're becoming a true math champion!",
            "💫 Phenomenal! Your skills are reaching stellar levels!",
            "👑 MATH MASTER! You've conquered the ultimate challenge!"
        ]
    }
};
