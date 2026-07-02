import { newFactRecord, appendAttempt, factState, childCutoff } from '../js/engine/states.js';

const VALID = { counts_for_accuracy: true, counts_for_rt: true, counts_as_retrieval: true, exclusion_reason: null };
const LAPSE = { counts_for_accuracy: true, counts_for_rt: false, exclusion_reason: 'lapse_suspect' };
const GUESS = { counts_for_accuracy: false, counts_for_rt: false, exclusion_reason: 'rapid_guess' };

function drill(rec, specs) {
    let r = rec, day = 0;
    for (const s of specs) {
        day = s.day ?? day;
        r = appendAttempt(r, { correct: s.c, initiation_ms: s.rt, typing_ms: 0 }, s.cls || VALID, `2026-07-${String(day + 1).padStart(2, '0')}`);
    }
    return r;
}

export async function run({ eq, ok }) {
    const cutoff = 3000;

    // Fresh fact is UNKNOWN.
    eq(factState(newFactRecord(), cutoff), 'UNKNOWN', 'fresh fact UNKNOWN');

    // 10 fast corrects across 2 days → FLUENT.
    let r = drill(newFactRecord(), Array.from({ length: 10 }, (_, i) => ({ c: true, rt: 1800, day: i < 5 ? 0 : 1 })));
    eq(factState(r, cutoff), 'FLUENT', 'fast+accurate = FLUENT');

    // Same accuracy but slow → SLOW.
    r = drill(newFactRecord(), Array.from({ length: 10 }, (_, i) => ({ c: true, rt: 5000, day: i < 5 ? 0 : 1 })));
    eq(factState(r, cutoff), 'SLOW', 'accurate but slow = SLOW');

    // All attempts on ONE day → no settled state yet (needs ≥2 distinct days).
    r = drill(newFactRecord(), Array.from({ length: 10 }, () => ({ c: true, rt: 1800, day: 0 })));
    ok(factState(r, cutoff) !== 'FLUENT', 'single-day evidence cannot settle FLUENT');

    // One slow-correct lapse does NOT demote a FLUENT fact.
    r = drill(newFactRecord(), Array.from({ length: 10 }, (_, i) => ({ c: true, rt: 1800, day: i < 5 ? 0 : 1 })));
    r.state = factState(r, cutoff);
    r = drill(r, [{ c: true, rt: 9000, cls: LAPSE, day: 2 }]);
    eq(factState(r, cutoff), 'FLUENT', 'single lapse never demotes FLUENT');

    // But 2-of-last-5 genuinely slow does demote.
    r = drill(r, [{ c: true, rt: 4200, day: 3 }, { c: true, rt: 4400, day: 4 }]);
    eq(factState(r, cutoff), 'SLOW', 'repeated slowness demotes to SLOW');

    // Rapid guesses never move a state.
    r = drill(newFactRecord(), Array.from({ length: 10 }, (_, i) => ({ c: true, rt: 1800, day: i < 5 ? 0 : 1 })));
    r.state = factState(r, cutoff);
    const before = factState(r, cutoff);
    r = drill(r, Array.from({ length: 5 }, () => ({ c: false, rt: 350, cls: GUESS, day: 5 })));
    eq(factState(r, cutoff), before, 'mashing cannot change state');

    // STUCK: ≥10 attempts, never 3-in-a-row.
    r = drill(newFactRecord(), Array.from({ length: 12 }, (_, i) => ({ c: i % 2 === 0, rt: 4000, day: i % 3 })));
    eq(factState(r, cutoff), 'STUCK', 'alternating errors = STUCK');

    // Personal cutoff: floor applies with no fluent facts.
    eq(childCutoff([]), 2750, 'cutoff floor with no data');
    eq(childCutoff([2000, 2200, 1800]), 3000, 'cutoff = 1.5× fluent median');
}
