/**
 * Local proof of the session logic — no Cloudflare, no email sent. Builds a
 * fake KV from real answer logs in ../../tmp-logs (see tests/health.mjs header
 * for the pull command) plus synthetic profiles, and drives sweep() at chosen
 * `now` values to check: fires after idle, stays quiet while active, and never
 * emails the same session twice.
 *
 *   node worker/session-email/test.mjs
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sweep, currentSession, renderEmail, notifyKey } from './src/sweep.js';

const here = dirname(fileURLToPath(import.meta.url));
const logDir = join(here, '..', '..', 'tmp-logs');

// ---- fake KV backed by an in-memory Map (mirrors the CF KV API surface) ----
function fakeKv(entries) {
    const store = new Map(entries);
    return {
        async list({ prefix = '', cursor = 0 }) {
            const keys = [...store.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name }));
            return { keys, list_complete: true, cursor: String(cursor) };
        },
        async get(key, type) {
            const v = store.get(key);
            if (v == null) return null;
            return type === 'json' ? JSON.parse(v) : v;
        },
        async put(key, val) { store.set(key, val); },
        _store: store,
    };
}

// ---- build KV from tmp-logs: files named <user>_<yyyy-mm-dd>.json ----
function loadKv() {
    if (!existsSync(logDir)) { console.error(`No ${logDir} — pull real logs first (see tests/health.mjs).`); process.exit(2); }
    const entries = [];
    const users = new Set();
    for (const f of readdirSync(logDir).filter(f => f.endsWith('.json'))) {
        const m = /^([\w.-]+)_(\d{4}-\d{2}-\d{2})\.json$/.exec(f);
        if (!m) continue;
        const [, user, day] = m;
        users.add(user);
        entries.push([`answers:${user}:${day}`, readFileSync(join(logDir, f), 'utf8')]);
    }
    for (const user of users) {
        entries.push([`profile:${user}`, JSON.stringify({ user, name: user[0].toUpperCase() + user.slice(1), role: 'kid' })]);
    }
    return { kv: fakeKv(entries), users: [...users] };
}

let pass = 0, fail = 0;
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${msg}`); cond ? pass++ : fail++; };

const { kv } = loadKv();
const IDLE = 20 * 60 * 1000;

// Mirror index.js run(): decide via sweep, then write watermarks for the ones
// that would be emailed (a successful send). Watermarks are NOT written by
// sweep itself anymore, so the test owns that side effect just like the Worker.
async function runOnce(now) {
    const d = await sweep(kv, { now, idleMs: IDLE });
    for (const r of d.results) {
        if (r.action === 'notify') await kv.put(notifyKey(r.user), JSON.stringify({ lastTs: r.session.lastTs, emailedAt: now }));
    }
    return d;
}

// Find the true last-activity ts across the fake store, to anchor `now`.
let lastTs = 0, sampleUser = null;
for (const [key, val] of kv._store) {
    if (!key.startsWith('answers:')) continue;
    for (const a of JSON.parse(val)) if (a.ts > lastTs) { lastTs = a.ts; sampleUser = key.split(':')[1]; }
}
console.log(`anchor: latest answer ts=${lastTs} (${new Date(lastTs).toISOString()}), user=${sampleUser}\n`);

// 1. The most-recently-active child, only 5 min quiet, is NOT emailed (still
//    playing). Other children who finished earlier today may legitimately fire.
let r = await sweep(kv, { now: lastTs + 5 * 60 * 1000, idleMs: IDLE });
const latest = r.results.find(x => x.user === sampleUser);
ok(latest && latest.action === 'skip' && latest.reason === 'still playing',
    `no email for the child still mid-session, 5 min quiet (${sampleUser}: ${latest?.reason})`);

// 2. Past the idle window (but fresh) -> the latest-active child is notified.
r = await runOnce(lastTs + IDLE + 60 * 1000);
const notified = r.results.filter(x => x.action === 'notify');
ok(notified.some(x => x.user === sampleUser), `notified after ${IDLE / 60000} min idle (${notified.map(x => x.user).join(',') || 'none'})`);
const target = notified.find(x => x.user === sampleUser);
ok(target && target.session.answered > 0, `session summary is populated (${target?.session.answered} answers, ${target?.session.rounds} rounds)`);

// 3. Run again -> watermark (written by runOnce above) suppresses a repeat.
r = await runOnce(lastTs + IDLE + 2 * 60 * 1000);
ok(!r.results.some(x => x.action === 'notify' && x.user === sampleUser), 'same session never emails twice (watermark holds)');

// 3b. A session that finished hours ago is skipped as too old (no activation
//     backfill, no email about yesterday's play).
const { kv: fresh } = loadKv();
r = await sweep(fresh, { now: lastTs + 5 * 60 * 60 * 1000, idleMs: IDLE });
ok(r.results.every(x => x.action !== 'notify'), 'stale session (5h old) is not emailed');

// 4. currentSession splits on a >idle gap.
const synth = [{ ts: 1000, correct: true, round_id: 'a' }, { ts: 2000, correct: false, round_id: 'a' },
    { ts: 2000 + IDLE + 1, correct: true, round_id: 'b' }, { ts: 2000 + IDLE + 2000, correct: true, round_id: 'b' }];
const s = currentSession(synth, IDLE);
ok(s.startTs === 2000 + IDLE + 1 && s.answered === 2, `session boundary respects the ${IDLE / 60000}-min gap (answered=${s.answered})`);

// Show the actual email that would go out.
if (target) {
    console.log('\n--- example email ---');
    console.log(`Subject: ${target.name} finished a maths session`);
    console.log(renderEmail({ name: target.name }, target.session, {}));
}

console.log(`\n${fail ? `${fail} FAILED` : `all ${pass} checks passed`}`);
process.exit(fail ? 1 : 0);
