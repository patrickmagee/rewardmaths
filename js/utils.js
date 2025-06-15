/**
 * Utility Functions
 * Contains helper functions used throughout the application
 */

/**
 * Formats time duration in milliseconds to human-readable string
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted time string
 */
export function formatTime(ms) {
    if (ms < 1000) return 'less than a second';
    if (ms < 60000) return `${Math.ceil(ms / 1000)} seconds`;
    if (ms < 3600000) return `${Math.ceil(ms / 60000)} minutes`;
    if (ms < 86400000) return `${Math.ceil(ms / 3600000)} hours`;
    return `${Math.ceil(ms / 86400000)} days`;
}

/**
 * Gets DOM element by ID with error handling
 * @param {string} id - Element ID
 * @returns {HTMLElement} DOM element
 * @throws {Error} If element not found
 */
export function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Element with ID '${id}' not found`);
    }
    return element;
}

/**
 * Safely gets integer value from input element
 * @param {HTMLInputElement} input - Input element
 * @returns {number} Parsed integer or NaN if invalid
 */
export function getIntegerValue(input) {
    return parseInt(input.value, 10);
}

/**
 * Clamps a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Generates a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Delays execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
