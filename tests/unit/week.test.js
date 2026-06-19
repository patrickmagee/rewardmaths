// Unit tests for the weekly-challenge boundary helper used by the menu ticks.
import { describe, it, expect } from 'vitest';
import { getWeekStartMs } from '../../js/utils.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe('getWeekStartMs', () => {
    it('returns the most recent Sunday at local midnight', () => {
        // Mid-week afternoon reference (June has no DST transition in common zones).
        const ref = new Date(2026, 5, 17, 14, 30, 30, 123); // Wed-ish, 17 Jun 2026
        const start = new Date(getWeekStartMs(ref));

        expect(start.getDay()).toBe(0);          // Sunday
        expect(start.getHours()).toBe(0);
        expect(start.getMinutes()).toBe(0);
        expect(start.getSeconds()).toBe(0);
        expect(start.getMilliseconds()).toBe(0);

        // The start is in the past, within the last 7 days.
        expect(start.getTime()).toBeLessThanOrEqual(ref.getTime());
        expect(ref.getTime() - start.getTime()).toBeLessThan(WEEK_MS);
    });

    it('is idempotent within the same week (start of week maps to itself)', () => {
        const ref = new Date(2026, 5, 17, 14, 30);
        const a = getWeekStartMs(ref);
        const b = getWeekStartMs(new Date(a));
        expect(b).toBe(a);
    });

    it('on a Sunday returns that same Sunday at midnight', () => {
        // Derive an actual Sunday, then confirm any time that day maps back to it.
        const sunday = new Date(getWeekStartMs(new Date(2026, 5, 17, 9, 0)));
        expect(sunday.getDay()).toBe(0);

        const lateThatSunday = new Date(
            sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59
        );
        expect(getWeekStartMs(lateThatSunday)).toBe(sunday.getTime());
    });

    it('a time one week later lands on the next Sunday (a week apart)', () => {
        const ref = new Date(2026, 5, 17, 14, 30);
        const thisWeek = getWeekStartMs(ref);
        const nextWeek = getWeekStartMs(new Date(ref.getTime() + WEEK_MS));
        expect(nextWeek - thisWeek).toBe(WEEK_MS);
    });
});
