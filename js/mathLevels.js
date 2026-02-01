/**
 * Math Question Generator
 * Generates questions based on category (add/subtract/multiply)
 */

import { DIFFICULTY_SETTINGS } from './config.js';

// Track last question to avoid repeats
let lastQuestionText = null;

/**
 * Generate a random integer between min and max (inclusive)
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a question for the given category (avoids repeating last question)
 * @param {string} categoryId - Category identifier (e.g., 'add_easy', 'multiply_5')
 * @returns {Object} Question object with text and answer
 */
export function generateQuestion(categoryId) {
    let question;
    let attempts = 0;
    const maxAttempts = 10;

    do {
        if (categoryId.startsWith('add_')) {
            question = generateAdditionQuestion(categoryId);
        } else if (categoryId.startsWith('sub_')) {
            question = generateSubtractionQuestion(categoryId);
        } else if (categoryId.startsWith('multiply_')) {
            question = generateMultiplicationQuestion(categoryId);
        } else {
            throw new Error(`Unknown category: ${categoryId}`);
        }
        attempts++;
    } while (question.text === lastQuestionText && attempts < maxAttempts);

    lastQuestionText = question.text;
    return question;
}

/**
 * Reset the last question tracker (call when starting a new game)
 */
export function resetLastQuestion() {
    lastQuestionText = null;
}

/**
 * Generate an addition question
 */
function generateAdditionQuestion(categoryId) {
    const settings = DIFFICULTY_SETTINGS[categoryId];
    if (!settings) throw new Error(`No settings for category: ${categoryId}`);

    const num1 = randomInt(settings.min1, settings.max1);
    const num2 = randomInt(settings.min2, settings.max2);
    const answer = num1 + num2;

    return {
        text: `${num1} + ${num2}`,
        answer: answer
    };
}

/**
 * Generate a subtraction question (always positive result)
 */
function generateSubtractionQuestion(categoryId) {
    const settings = DIFFICULTY_SETTINGS[categoryId];
    if (!settings) throw new Error(`No settings for category: ${categoryId}`);

    // Generate numbers ensuring result is positive
    let num1 = randomInt(settings.min1, settings.max1);
    let num2 = randomInt(settings.min2, Math.min(settings.max2, num1 - 1));

    // Ensure num1 > num2
    if (num2 >= num1) {
        num2 = randomInt(1, num1 - 1);
    }

    const answer = num1 - num2;

    return {
        text: `${num1} - ${num2}`,
        answer: answer
    };
}

/**
 * Generate a multiplication question for a specific times table
 */
function generateMultiplicationQuestion(categoryId) {
    // Extract the table number (e.g., 'multiply_5' -> 5)
    const tableNum = parseInt(categoryId.split('_')[1]);
    if (isNaN(tableNum) || tableNum < 2 || tableNum > 12) {
        throw new Error(`Invalid times table: ${categoryId}`);
    }

    // Generate a multiplier from 1 to 12
    const multiplier = randomInt(1, 12);
    const answer = tableNum * multiplier;

    // Randomly decide which number comes first for variety
    if (Math.random() > 0.5) {
        return {
            text: `${tableNum} × ${multiplier}`,
            answer: answer
        };
    } else {
        return {
            text: `${multiplier} × ${tableNum}`,
            answer: answer
        };
    }
}

/**
 * Get display name for a category
 * @param {string} categoryId - Category identifier
 * @returns {string} Human-readable category name
 */
export function getCategoryDisplayName(categoryId) {
    if (categoryId.startsWith('add_')) {
        const difficulty = categoryId.split('_')[1];
        return `Addition (${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)})`;
    } else if (categoryId.startsWith('sub_')) {
        const difficulty = categoryId.split('_')[1];
        return `Subtraction (${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)})`;
    } else if (categoryId.startsWith('multiply_')) {
        const table = categoryId.split('_')[1];
        return `${table} Times Table`;
    }
    return categoryId;
}
