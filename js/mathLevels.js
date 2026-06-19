/**
 * Math Question Generator
 * Generates questions based on category (add/subtract/multiply)
 */

import { DIFFICULTY_SETTINGS } from './config.js';

// Track last question to avoid repeats (canonical key, order-independent for multiplication)
let lastQuestionKey = null;

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
    } while (question.key === lastQuestionKey && attempts < maxAttempts);

    lastQuestionKey = question.key;
    return question;
}

/**
 * Reset the last question tracker (call when starting a new game)
 */
export function resetLastQuestion() {
    lastQuestionKey = null;
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
        answer: answer,
        key: `add:${num1}+${num2}`
    };
}

/**
 * Generate a subtraction question (always positive result)
 */
function generateSubtractionQuestion(categoryId) {
    const settings = DIFFICULTY_SETTINGS[categoryId];
    if (!settings) throw new Error(`No settings for category: ${categoryId}`);

    // Generate num1, then pick num2 within a valid, positive-result range.
    // effectiveMax caps num2 at num1-1 so the result is always positive.
    // If the configured min2 exceeds that cap, re-draw num1 until a valid
    // range exists, then fall back to a safe clamp so num2 stays in [1, num1-1].
    let num1 = randomInt(settings.min1, settings.max1);
    let effectiveMax = Math.min(settings.max2, num1 - 1);

    let drawAttempts = 0;
    while (effectiveMax < settings.min2 && drawAttempts < 10) {
        num1 = randomInt(settings.min1, settings.max1);
        effectiveMax = Math.min(settings.max2, num1 - 1);
        drawAttempts++;
    }

    // Lower bound: honour min2 when possible, but never below 1 and never above effectiveMax.
    const effectiveMin = Math.max(1, Math.min(settings.min2, effectiveMax));

    let num2;
    if (effectiveMax < effectiveMin) {
        // No valid range (e.g. num1 <= 1); clamp to a safe positive value.
        num2 = Math.max(1, num1 - 1);
    } else {
        num2 = randomInt(effectiveMin, effectiveMax);
    }

    const answer = num1 - num2;

    return {
        text: `${num1} - ${num2}`,
        answer: answer,
        key: `sub:${num1}-${num2}`
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

    // Canonical key uses sorted operands so 5×3 and 3×5 map to the same key.
    const lo = Math.min(tableNum, multiplier);
    const hi = Math.max(tableNum, multiplier);
    const key = `mul:${lo}x${hi}`;

    // Randomly decide which number comes first for display variety
    if (Math.random() > 0.5) {
        return {
            text: `${tableNum} × ${multiplier}`,
            answer: answer,
            key: key
        };
    } else {
        return {
            text: `${multiplier} × ${tableNum}`,
            answer: answer,
            key: key
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
