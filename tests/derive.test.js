/**
 * Data-layer proof: two devices with interleaved offline play converge to
 * byte-identical derived state after sync — through the REAL Pages Function
 * (fake KV) and the REAL derive fold.
 */
import { deriveState, mergeAnswers } from '../js/data/derive.js';
import { onRequestGet, onRequestPost } from '../functions/api/answers.js';

/** In-memory KV faking the Cloudflare binding. */
function fakeKV() {
    const store = new Map();
    return {
        async get(key, type) {
            const v = store.get(key);
            return v === undefined ? null : (type === 'json' ? JSON.parse(v) : v);
        },
        async put(key, value) { store.set(key, value); },
        async list({ prefix }) {
            return {
                keys: [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })),
                list_complete: true,
            };
        },
    };
}

async function post(env, body) {
    const req = new Request('https://x/api/answers', {
        method: 'POST', body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
    return (await onRequestPost({ request: req, env })).json();
}

async function getAll(env, user) {
    const req = new Request(`https://x/api/answers?user=${user}`);
    return (await onRequestGet({ request: req, env })).json();
}

/** Deterministic synthetic play: `n` rounds of 10 on a given day. */
function makeRounds(user, day, startTs, seed, n = 2) {
    let s = seed;
    const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    const facts = ['2x3', '2x4', '2x5', '5x3', '5x4', '5x6', '3x4', '4x6', '2x7', '5x8'];
    const out = [];
    for (let r = 0; r < n; r++) {
        const round_id = `${day}-r${r}-${seed}`;
        for (let q = 0; q < 10; q++) {
            const ts = startTs + r * 120000 + q * 6000;
            const fact_id = facts[Math.floor(rand() * facts.length)];
            const correct = rand() < 0.85;
            out.push({
                id: `${ts.toString(36)}-${Math.floor(rand() * 1e6).toString(36)}`,
                user, day, ts, round_id, round_type: r === 0 ? 'review' : 'mixed',
                fact_id, given: correct ? product(fact_id) : 7,
                correct, initiation_ms: 900 + Math.floor(rand() * 2500),
                typing_ms: 600, input: 'tap', timeout: false,
            });
        }
    }
    return out;
}

function product(factId) {
    const [a, b] = factId.split('x').map(Number);
    return a * b;
}

function stateHash(answers) {
    const { state, days } = deriveState(answers);
    return JSON.stringify({ state, days });
}

export async function run({ eq, ok }) {
    const user = 'tom';
    const T0 = 1780000000000;

    // Device A plays days 1,3 offline; device B plays days 2,3 offline
    // (day 3 played on BOTH devices — the hard merge case).
    const A = [
        ...makeRounds(user, '2026-07-01', T0, 11),
        ...makeRounds(user, '2026-07-03', T0 + 2 * 86400000, 13),
    ];
    const B = [
        ...makeRounds(user, '2026-07-02', T0 + 86400000, 22),
        ...makeRounds(user, '2026-07-03', T0 + 2 * 86400000 + 3600000, 23),
    ];

    // --- deriveState is order-independent (log as truth requires it).
    const shuffled = [...A].reverse();
    eq(stateHash(A), stateHash(shuffled), 'derive is order-independent');

    // --- Sync through the real Pages Function, in different orders per device.
    const env = { SCORES: fakeKV() };
    // A pushes its days, then B pushes its days.
    for (const day of ['2026-07-01', '2026-07-03']) {
        await post(env, { user, day, answers: A.filter(a => a.day === day) });
    }
    for (const day of ['2026-07-02', '2026-07-03']) {
        await post(env, { user, day, answers: B.filter(a => a.day === day) });
    }

    // Both devices pull everything and merge with their local logs.
    const remote = await getAll(env, user);
    const remoteAnswers = Object.values(remote.days).flat();
    const mergedA = mergeAnswers(A, remoteAnswers);
    const mergedB = mergeAnswers(B, remoteAnswers);

    eq(mergedA.length, A.length + B.length - 0, 'merge contains every record once');
    eq(stateHash(mergedA), stateHash(mergedB), 'both devices derive identical state');

    // --- Idempotency: re-pushing the same day changes nothing.
    const before = JSON.stringify(await getAll(env, user));
    await post(env, { user, day: '2026-07-03', answers: A.filter(a => a.day === '2026-07-03') });
    const after = JSON.stringify(await getAll(env, user));
    eq(before, after, 're-push is a no-op');

    // --- A voided round (mash) is derived as void identically everywhere.
    const mash = Array.from({ length: 10 }, (_, q) => ({
        id: `mash-${q}`, user, day: '2026-07-04', ts: T0 + 3 * 86400000 + q * 1000,
        round_id: 'mash-round', round_type: 'mixed', fact_id: '2x3', given: 1,
        correct: false, initiation_ms: 320, typing_ms: 100, input: 'tap', timeout: false,
    }));
    const { days } = deriveState(mergeAnswers(mergedA, mash));
    eq(days['2026-07-04'].voidRounds, 1, 'mash round derived as void');

    // --- Server rejects garbage.
    const bad = await post(env, { user: '../etc', day: '2026-07-01', answers: [] });
    ok(bad.error, 'bad user rejected');
}
