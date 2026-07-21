/**
 * Real-data health snapshot. Runs the SHIPPED engine (deriveState) over a
 * child's actual answer log and prints everything we keep re-deriving by hand:
 * fact-state distribution, RT percentiles, timeout breakdown, exclusion rate
 * (with the alarm verdict), flags, and a "looks mislabelled?" audit.
 *
 * This is a diagnostic, not a pass/fail test — it never fails a build. It
 * exists so a person or agent can answer "what does the engine actually think
 * of this child right now?" in ONE command instead of authoring a fresh script.
 *
 *   node tests/health.mjs <logdir>        # reads every *.json in <logdir>
 *   node tests/health.mjs tmp-logs        # default dir if omitted
 *   node tests/health.mjs tmp-logs eliza   # filter to one user
 *
 * Each *.json is either a raw answers array or {answers:[...]}/{days:{...}} as
 * stored in KV. Pull real logs into tmp-logs/ (gitignored) with:
 *
 *   set -a; . ./.cloudflare.env; set +a
 *   for k in $(npx wrangler kv key list --binding SCORES --remote --prefix "answers:eliza:" | grep -o 'answers:[^"]*'); do
 *     npx wrangler kv key get --binding SCORES --remote "$k" > "tmp-logs/${k//:/_}.json"
 *   done
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const derivePath = pathToFileURL(join(process.cwd(), 'js/data/derive.js')).href;
const flagsPath = pathToFileURL(join(process.cwd(), 'js/engine/flags.js')).href;
const configPath = pathToFileURL(join(process.cwd(), 'js/config.js')).href;
const { deriveState } = await import(derivePath);
const { evaluateFlags } = await import(flagsPath);
const { RT } = await import(configPath);

const dir = process.argv[2] || 'tmp-logs';
const onlyUser = process.argv[3] || null;

// ---- load + group by user ----
let records;
try {
    records = readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .flatMap(f => {
            const j = JSON.parse(readFileSync(join(dir, f), 'utf8'));
            if (Array.isArray(j)) return j;
            if (Array.isArray(j.answers)) return j.answers;
            if (j.days) return Object.values(j.days).flat();
            return [];
        });
} catch (e) {
    console.error(`Could not read logs from "${dir}/": ${e.message}`);
    console.error('Pass a directory of KV answer JSON files (see header for the pull command).');
    process.exit(2);
}
if (!records.length) { console.error(`No answer records found in "${dir}/".`); process.exit(2); }

const byUser = {};
for (const a of records) (byUser[a.user || 'unknown'] ||= []).push(a);

// ---- helpers ----
const opOf = id => /x/.test(id) ? 'mul' : /\+/.test(id) ? 'add' : /-/.test(id) ? 'sub' : '?';
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const dist = xs => xs.length ? `p10=${pct(xs, .1)} p25=${pct(xs, .25)} med=${pct(xs, .5)} p75=${pct(xs, .75)} p90=${pct(xs, .9)}` : '(none)';

for (const [user, log] of Object.entries(byUser)) {
    if (onlyUser && user !== onlyUser) continue;
    console.log(`\n${'='.repeat(64)}\n  ${user.toUpperCase()} — ${log.length} answers over ${new Set(log.map(a => a.day)).size} days\n${'='.repeat(64)}`);

    // Raw shape.
    const to = log.filter(a => a.timeout);
    const legacyTo = to.filter(a => a.ceiling_ms == null);
    console.log(`correct=${log.filter(a => a.correct && !a.timeout).length}  wrong=${log.filter(a => !a.correct && !a.timeout).length}  timeout=${to.length} (legacy 12s-era: ${legacyTo.length})`);

    // Fact states through the real fold.
    const { state, classified } = deriveState(log, {});
    const facts = Object.entries(state.facts);
    const counts = {};
    for (const [, r] of facts) counts[r.state] = (counts[r.state] || 0) + 1;
    console.log(`fact states: ${JSON.stringify(counts)}  (${facts.length} facts tracked)`);

    // RT by op (correct answers only), initiation vs typing vs total.
    const ok = log.filter(a => a.correct && !a.timeout);
    for (const op of ['mul', 'add', 'sub']) {
        const g = ok.filter(a => opOf(a.fact_id) === op);
        if (!g.length) continue;
        console.log(`  ${op}: init  ${dist(g.map(a => a.initiation_ms))}`);
        console.log(`  ${' '.repeat(op.length)}  typing ${dist(g.map(a => a.typing_ms || 0))}`);
    }

    // Exclusion rate + alarm verdict (mirrors admin.js after the b5a51a5 fixes).
    const DISENGAGED = new Set(['anticipation', 'rapid_guess']);
    const disengaged = classified.filter(a => DISENGAGED.has(a.cls.exclusion_reason)).length;
    const exclRate = classified.length ? disengaged / classified.length : 0;
    console.log(`exclusion (mashing) rate: ${(exclRate * 100).toFixed(1)}%  ${exclRate > RT.ALARM_EXCLUSION_RATE ? '⚠ ALARM' : 'ok'}  (threshold ${(RT.ALARM_EXCLUSION_RATE * 100)}%)`);

    // Mislabel audit: facts sitting in a weak state driven only by timeouts.
    const suspect = facts.filter(([id, r]) => {
        const rows = log.filter(a => a.fact_id === id);
        const wrong = rows.filter(a => !a.correct && !a.timeout).length;
        const tos = rows.filter(a => a.timeout).length;
        return (r.state === 'UNKNOWN' || r.state === 'STUCK') && wrong === 0 && tos > 0;
    });
    if (suspect.length) console.log(`⚠ ${suspect.length} weak-state facts have ZERO wrong answers (timeout-driven): ${suspect.map(([id]) => id).join(' ')}`);

    // Flags.
    const today = [...new Set(log.map(a => a.day))].sort().pop();
    const recent = classified.filter(a => !a.void);
    const flags = evaluateFlags(recent, {}, state.facts, today);
    const fired = Object.entries(flags).filter(([, f]) => f.state === 'flagged').map(([t]) => t);
    console.log(`flags: ${fired.length ? fired.join(', ') : 'none'}`);
}
console.log();
