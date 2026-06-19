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

/**
 * Returns the epoch-ms timestamp of the most recent Sunday at 00:00 LOCAL time.
 * This is the start of the current "challenge week" — the weekly perfect-score
 * ticks count games played on or after this instant, so they reset to zero at
 * Sunday midnight automatically (no stored state or scheduled job needed).
 * @param {Date} [now] - reference time (defaults to the current time)
 * @returns {number} epoch milliseconds of the week start
 */
export function getWeekStartMs(now = new Date()) {
    const d = new Date(now.getTime());
    d.setHours(0, 0, 0, 0);              // midnight at the start of today (local)
    d.setDate(d.getDate() - d.getDay()); // getDay(): Sun=0..Sat=6 -> back to Sunday
    return d.getTime();
}
