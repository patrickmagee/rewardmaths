import { processDay, newChildState, currentFrontier } from '../js/engine/adapt.js';
import { newFactRecord } from '../js/engine/states.js';
import { familyFacts } from '../js/engine/facts.js';

const VALID = { counts_for_accuracy: true, counts_for_rt: true, exclusion_reason: null };

function answers(family, day, { n = 10, acc = 0.9, rt = 2000, init = 1500, fluentExtras = 0 } = {}) {
    const facts = familyFacts(family);
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push({
            fact_id: facts[i % facts.length], day, rt, initiation_ms: init,
            correct: i < Math.round(n * acc), cls: VALID, round_type: 'mixed', void: false,
        });
    }
    return out;
}

/** Answers on FLUENT facts, to feed the off-day guard baseline. The guard now
 *  reads initiation_ms only (mirrors the state machine); rt carries total for
 *  callers that inspect it, but the two are deliberately independent so a test
 *  can move typing without moving initiation. */
function fluentAnswers(state, day, { n = 8, acc = 1, rt = 1800, init = 1200 } = {}) {
    const ids = Object.entries(state.facts).filter(([, r]) => r.state === 'FLUENT').map(([id]) => id);
    return Array.from({ length: n }, (_, i) => ({
        fact_id: ids[i % ids.length], day, rt, initiation_ms: init,
        correct: i < Math.round(n * acc), cls: VALID, round_type: 'mixed', void: false,
    }));
}

function seedFluent(state, family) {
    for (const f of familyFacts(family)) {
        state.facts[f] = { ...newFactRecord(), state: 'FLUENT', medianRt: 1800, totalAttempts: 10 };
    }
}

export async function run({ eq, ok }) {
    // --- EMA + promotion.
    let state = newChildState({ unlockedFamilies: ['add-0-1'] });
    seedFluent(state, 'add-0-1');
    let audit = [];
    for (let d = 1; d <= 3; d++) {
        const day = `2026-07-0${d}`;
        const res = processDay(day, [
            ...answers('add-0-1', day, { acc: 0.9 }),
            ...fluentAnswers(state, day),
        ], state);
        state = res.state; audit.push(...res.audit);
    }
    ok(state.familyEMA['add-0-1'] >= 0.85, `EMA high after good days (${state.familyEMA['add-0-1']})`);
    ok(state.unlockedFamilies.includes('add-2'), 'next family unlocked after mastery gate');
    ok(state.unlockedFamilies.includes('sub-0-1'), 'subtraction partner unlocked');
    ok(state.warmupFamilies.includes('add-2'), 'new family starts in warm-up');
    ok(audit.some(a => a.type === 'family_unlocked'), 'unlock audited');

    // --- One bad day never demotes.
    let s2 = newChildState({ unlockedFamilies: ['add-0-1', 'add-2'] });
    s2.warmupFamilies = []; // steady state: add-2 already graduated warm-up
    seedFluent(s2, 'add-0-1');
    for (let d = 1; d <= 10; d++) {
        const day = `2026-07-${String(d).padStart(2, '0')}`;
        const res = processDay(day, [
            ...answers('add-2', day, { acc: 0.9 }),
            ...fluentAnswers(s2, day),
        ], s2);
        s2 = res.state;
    }
    const emaBefore = s2.familyEMA['add-2'];
    // Catastrophic day on the family, but FLUENT facts also collapse → off-day.
    let res = processDay('2026-07-11', [
        ...answers('add-2', '2026-07-11', { acc: 0.2 }),
        ...fluentAnswers(s2, '2026-07-11', { acc: 0.4 }), // global depression
    ], s2);
    eq(res.state.familyEMA['add-2'], emaBefore, 'off-day writes nothing');
    ok(res.audit.some(a => a.type === 'off_day'), 'off-day audited');

    // Frontier-specific bad day (FLUENT facts fine): EMA moves but no demotion.
    res = processDay('2026-07-11', [
        ...answers('add-2', '2026-07-11', { acc: 0.4 }),
        ...fluentAnswers(s2, '2026-07-11', { acc: 1 }),
    ], s2);
    const ema = res.state.familyEMA['add-2'];
    ok(ema < emaBefore && ema > 0.7, `one bad day bruises EMA only (${emaBefore}→${ema})`);
    ok(!res.audit.some(a => a.type === 'family_demoted'), 'no demotion from one bad day');
    ok(!res.state.warmupFamilies.includes('add-2'), 'family not back in warm-up');

    // --- Three bad days on three dates DO demote.
    let s3 = res.state;
    for (const day of ['2026-07-12', '2026-07-13', '2026-07-14']) {
        const r = processDay(day, [
            ...answers('add-2', day, { acc: 0.4 }),
            ...fluentAnswers(s3, day, { acc: 1 }),
        ], s3);
        s3 = r.state; audit = r.audit;
    }
    ok(s3.warmupFamilies.includes('add-2'), 'sustained failure demotes to warm-up');

    // --- Keyboard→tablet input switch must NOT trigger off-day (initiation is
    // the signal, not total RT). typing_ms triples across the switch while
    // initiation is held steady; under the old total-RT guard this fired
    // off-day on every post-switch day and self-latched (adaptation froze).
    let s6 = newChildState({ unlockedFamilies: ['add-0-1', 'add-2'] });
    s6.warmupFamilies = [];
    seedFluent(s6, 'add-0-1');
    // 12 "keyboard" days: fast typing, steady initiation → builds the baseline.
    for (let d = 1; d <= 12; d++) {
        const day = `2026-06-${String(d).padStart(2, '0')}`;
        const res = processDay(day, [
            ...answers('add-2', day, { acc: 0.9 }),
            ...fluentAnswers(s6, day, { rt: 1100, init: 1000 }), // init 1000 + 100 typing
        ], s6);
        s6 = res.state;
    }
    // 8 "tablet" days: typing jumps (rt 3000) but INITIATION unchanged (1000).
    let offDaysAfterSwitch = 0, emaFirst = null, emaLast = null;
    for (let d = 13; d <= 20; d++) {
        const day = `2026-06-${String(d).padStart(2, '0')}`;
        const res = processDay(day, [
            ...answers('add-2', day, { acc: 0.9 }),
            ...fluentAnswers(s6, day, { rt: 3000, init: 1000 }), // typing tripled, init steady
        ], s6);
        if (res.audit.some(a => a.type === 'off_day')) offDaysAfterSwitch++;
        if (res.audit.some(a => a.type === 'ema')) {
            if (emaFirst === null) emaFirst = res.state.familyEMA['add-2'];
            emaLast = res.state.familyEMA['add-2'];
        }
        s6 = res.state;
    }
    eq(offDaysAfterSwitch, 0, 'input-method switch (typing×3, steady init) never fires off-day');
    ok(emaLast !== null, 'adaptation continues after the switch (EMA still updates)');

    // --- Voided answers are ignored.
    let s4 = newChildState();
    seedFluent(s4, 'add-0-1');
    const r4 = processDay('2026-07-01',
        answers('add-0-1', '2026-07-01', { acc: 0 }).map(a => ({ ...a, void: true })), s4);
    eq(r4.state.familyEMA['add-0-1'], undefined, 'voided session writes nothing');

    // --- Frontier helper.
    eq(currentFrontier(newChildState({ unlockedFamilies: ['add-0-1', 'add-2'] })), 'add-2', 'frontier = last unlocked add family');

    // --- Age-appropriate ladder start (SCHEDULER.ADD_START_FAMILY).
    const s5 = newChildState();
    eq(currentFrontier(s5), 'bridge-10', 'default start frontier is bridge-10');
    eq(s5.warmupFamilies[0], 'bridge-10', 'start frontier begins in warm-up');
    ok(s5.unlockedFamilies.includes('make-10') && s5.unlockedFamilies.includes('doubles-big'),
        'families below the start are pre-unlocked');
    ok(s5.unlockedFamilies.includes('sub-make-10') && s5.unlockedFamilies.includes('sub-0-1'),
        'sub partners of pre-unlocked families unlocked too');
    ok(!s5.unlockedFamilies.includes('add-rest') && !s5.unlockedFamilies.includes('sub-bridge-10'),
        'families above the start (and the frontier\'s own sub partner) stay locked');
}
