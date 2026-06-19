/**
 * Utility Functions
 * Contains helper functions used throughout the application
 */

/**
 * Gets a DOM element by ID, returning null (with a warning) if it is missing.
 * Callers throughout the app guard with `if (element)` for graceful degradation,
 * so this must NOT throw — a missing/renamed ID should degrade, not abort the
 * whole screen-setup call.
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} DOM element, or null if not found
 */
export function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with ID '${id}' not found`);
        return null;
    }
    return element;
}
