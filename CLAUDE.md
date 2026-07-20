# RewardMaths — Claude Code Project Guide

**Last Updated**: 2026-07-20
**Version**: 5.0 (evidence-locked adaptive engine)
**Status**: Live at https://rewardmaths.com (custom domain) and
https://rewardmaths.pages.dev — same Cloudflare Pages project.

---

## What Is This Project?

A home-use mental-arithmetic tutor for two children — Tom (10) and Eliza (11) —
built to get them genuinely fluent (addition, subtraction, times tables 2–12).
Self-improvement only: **no sibling comparison anywhere, ever**.

v5 is a ground-up rewrite whose every mechanic is sourced to adversarially
fact-checked education research:

- **`docs/DESIGN.md`** — the evidence-locked product spec. **Read it before
  changing any game mechanic.** Sources: `docs/research/01–05`.
- **`docs/REWRITE.md`** — architecture, module map, build progress.

Core loop: child taps their avatar, enters a 4-digit PIN, sees today's goal
reveal + streak, and plays **system-picked** 10-question rounds
(review → focus → mixed). No child choice of content (learner control g=0.05).
Effort medals bronze/silver/gold (2/4/6 rounds), streak with 2 shields/week
(5-of-7 model), random weekly easy day, volume caps with lock-framed stop
states. Wrong answers always show the correct fact neutrally and requeue.

- Vanilla ES6 modules, no framework, no build step. Tablet-first PWA
  (`manifest.json`, `sw.js`), on-screen keypad + physical keys both live.
- **The answer log is the source of truth**: every per-answer record
  (fact, correct, initiation_ms, typing_ms) syncs local-first
  (IndexedDB ↔ Cloudflare KV, union-merge by id). ALL adaptive state —
  fact states, family EMAs, streaks, medals, flags — derives from the log
  via a pure fold (`js/data/derive.js`) and is recomputable on any device.
- **Speed is judged on `initiation_ms` only** (question shown → first keypress);
  typing time is diagnostics, never classification — it scales with answer
  digit count, which is confounded with problem size. Cutoff = max(2500ms,
  2.0× the child's own fluent-initiation median), +300ms where both operands
  ≥6. Sourcing and the 2026-07-20 revision rationale: DESIGN §2 "Speed cutoff".

---

## Architecture

```
index.html   → js/game/main.js      child app (who → PIN → today → rounds)
admin.html   → js/parent/admin.js   parent dashboard (password: patrick's)
js/
  config.js            ALL tunable engine constants (fixed a priori — see DESIGN)
  engine/              pure logic: facts/ladder, RT classifier, fact states,
                       daily adaptation, scheduler, flags, metrics
  data/                derive (log→state fold), IndexedDB, KV sync
  game/                copy (all child-facing strings), keypad, session,
                       streaks, medals, screens, main
functions/api/
  answers.js           KV: answers:<user>:<yyyy-mm-dd> (union by answer id)
  profiles.js          KV: profile:<user> (any-device avatar+PIN login)
tests/                 node tests + 60-day synthetic-child simulation
```

`npm test` (180 unit tests) and `npm run simulate` (5 personas through the
real engine) must pass before any engine change ships.

The simulation is **chaotic**: `persona.rng` is shared between scheduler
item-selection and answer generation, so any change to the round-building path
— even a semantically neutral one — reshuffles every subsequent draw. Never
assert a single seed's outcome there; seed-average it (see the flag checks at
the end of `tests/simulate.js`) or you are testing a coin flip.

### Accounts
Avatar + PIN login (hashes in KV profiles). Seeded: **tom 1111 · eliza 2222 ·
test `Laura` (typed password, not keypad) · parent password `laura`**
(dashboard can change PINs). Kids' streaks/medals/bars are private per
child — never surface one child's data to the other.

### Parent dashboard (admin.html)
Runs the same derive fold on each child's log: 14-day activity (easy days
outlined), Westwood-normed fluency-index band + growth slope (needs 3 sprint
rounds + DOB), times-table fact map (fact states **FLUENT / SLOW / UNSETTLED /
UNKNOWN / STUCK** — UNSETTLED = answering it right but <5 valid attempts or
<2 distinct days, so no speed verdict yet; it is not a weakness and never a
focus-round target), add/sub ladder, struggle flags with
evidence + literal playbook scripts, engine audit trail, exclusion alarm,
CSV export, per-child settings (easy days on/off, DOB, PIN, **question
timeout** 6–60s default 40s — an accessibility dial, not an engine knob;
the ceiling in force is stamped on each answer as `ceiling_ms` so changing
it never reclassifies history).

---

## Local Development

```powershell
python -m http.server 8000        # UI against IndexedDB (offline path)
# API locally: npx wrangler pages dev dist   (after build-dist.ps1)
node tests/run.js                 # engine tests
node tests/simulate.js            # synthetic-child simulation
```

## Deploy (Cloudflare Pages)

**Push to `master` auto-deploys** (`.github/workflows/deploy.yml` assembles
dist = index.html, admin.html, favicon.svg, manifest.json, sw.js, css/, js/,
functions/). Manual fallback: `./build-dist.ps1` + wrangler (token in
`.cloudflare.env`, gitignored). KV binding `SCORES`
(id dd938e9f5745405b91a8e6e1dd01b3cf) in `wrangler.toml` — key namespaces:
`answers:*`, `profile:*` (v4 `scores:*` deleted at cutover).

---

## Conventions & Guardrails

- **docs/DESIGN.md governs mechanics.** Thresholds live in `js/config.js`,
  fixed a priori — don't re-tune them from a child's data (researcher degrees
  of freedom); revisit only per DESIGN's rules.
- Child-facing strings only via `js/game/copy.js` (tone rules: matter-of-fact,
  no fake praise, correction is information, lock-framing never "all done").
- Never accuracy-gate medals; never surface adaptation/demotions to kids;
  never leak easy-day status in the reveal.
- Raw answer records are append-only; derived state is a cache. New features
  should derive from the log, not add stored state.
- Keep this file, README, docs/DESIGN.md and memory current when anything
  changes.

## Pending / Roadmap

- Daily parent email (deferred by choice): Worker cron + email API (provider
  TBD — MailChannels free tier is dead; Resend/Brevo fit). Digest + playbook
  format specified in DESIGN §3/§5.
- Big-goal campaign wizard (DESIGN §4) — rare parent-set tangible goal.
- MTC probe mode (25 q / 6s window, parent-triggered, half-termly).
- Victory-lap round + data-gated improvement lines at round end.
