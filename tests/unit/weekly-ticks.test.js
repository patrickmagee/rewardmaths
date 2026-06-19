// Unit tests for the weekly "aced" tick data source:
// Storage.getWeeklyPerfectCategories — which categories the user scored a
// perfect game in since the start of this week.
import { describe, it, expect } from 'vitest';
import { supabase } from '../../js/localdb.js';
import { Storage } from '../../js/storage.js';
import { getWeekStartMs } from '../../js/utils.js';
import { APP_CONFIG } from '../../js/config.js';

const PERFECT = APP_CONFIG.QUESTIONS_PER_GAME;

// Insert a score row directly so we can control played_at precisely.
async function insertScore(row) {
    const { error } = await supabase.from('scores').insert(row);
    if (error) throw new Error(error.message);
}

describe('Storage.getWeeklyPerfectCategories', () => {
    const weekStart = getWeekStartMs();
    const sinceIso = new Date(weekStart).toISOString();
    const thisWeek = new Date(weekStart + 60_000).toISOString();   // just after the boundary
    const atBoundary = new Date(weekStart).toISOString();          // exactly the boundary
    const lastWeek = new Date(weekStart - 60_000).toISOString();   // just before the boundary

    it('returns only categories with a 10/10 on/after the week start, deduped', async () => {
        const userId = 'weekly-user-1';
        await insertScore({ user_id: userId, category: 'add_easy', score: PERFECT, time_ms: 5000, played_at: thisWeek });
        await insertScore({ user_id: userId, category: 'add_easy', score: PERFECT, time_ms: 6000, played_at: thisWeek });   // duplicate -> still one
        await insertScore({ user_id: userId, category: 'multiply_3', score: PERFECT, time_ms: 4000, played_at: atBoundary }); // boundary counts (>=)
        await insertScore({ user_id: userId, category: 'sub_easy', score: PERFECT - 1, time_ms: 5000, played_at: thisWeek }); // not perfect
        await insertScore({ user_id: userId, category: 'multiply_5', score: PERFECT, time_ms: 4000, played_at: lastWeek });   // perfect but last week

        const aced = await Storage.getWeeklyPerfectCategories(userId, sinceIso);
        expect(aced.sort()).toEqual(['add_easy', 'multiply_3']);
    });

    it('is scoped to the requested user', async () => {
        await insertScore({ user_id: 'weekly-user-A', category: 'multiply_7', score: PERFECT, time_ms: 5000, played_at: thisWeek });

        const acedB = await Storage.getWeeklyPerfectCategories('weekly-user-B', sinceIso);
        expect(acedB).toEqual([]);
    });

    it('returns empty when the user has no perfect scores this week', async () => {
        const userId = 'weekly-user-none';
        await insertScore({ user_id: userId, category: 'sub_hard', score: PERFECT - 2, time_ms: 5000, played_at: thisWeek });

        const aced = await Storage.getWeeklyPerfectCategories(userId, sinceIso);
        expect(aced).toEqual([]);
    });
});
