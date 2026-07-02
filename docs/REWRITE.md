# RewardMaths v5 — Site Rewrite Plan

**Date**: 2026-07-02 · **Spec**: `docs/DESIGN.md` (evidence-locked) · **Status**: approved, ready to build

Full rewrite of the site around the v5 engine. Old v4 game/admin UI and data are
retired (old KV `scores:*` keys deleted at cutover — user decision: no archive).

---

## 1. Decisions (user-confirmed)

| Decision | Choice |
|---|---|
| Input | **Custom on-screen keypad always rendered + physical keyboard always accepted** (0–9, Backspace, Enter light up the pad). Answer box is not a text field → tablet OS keyboard never appears. Every answer tagged `input: "tap"\|"key"`; typing baselines kept **per input method per child**. |
| Login | **Tap avatar + 4-digit PIN** on the shared keypad. Parent area keeps a password. PINs/password stored hashed (SHA-256; home-app threat model). |
| Old data | **Nuked.** v5 launches clean; placement sweep rebuilds each child's profile from play. |
| Email | **Deferred.** Parent layer ships dashboard-only; the daily digest + cron Worker come later. Consequence: daily adaptation runs lazily client-side (below), no Worker needed yet. |
| Stack | Vanilla ES6 modules, no framework, no build step (repo convention). Cloudflare Pages + KV as now. |
| Form factor | **Tablet-first** responsive design; laptop fully supported. **PWA** (manifest + service worker) → installable, full-screen, offline-capable on the tablet. |

---

## 2. Architecture principle: the answer log is the truth

Every per-answer record (`docs/DESIGN.md` §2) is append-only and synced
local-first (IndexedDB ↔ KV, union-merge by timestamp — same pattern as v4
scores). **All other state — fact states, family EMAs, streaks, medals, flags —
is derived and recomputable from the log.** The stored state object is a cache:

- **Daily adaptation runs lazily**: on first app-open of a new day (per child),
  a pure, idempotent function processes any unprocessed complete days
  (off-day guard → P_day → EMA → promote/demote → audit entries) and writes the
  state cache. Same inputs → same outputs on any device; a sync conflict is
  resolved by recomputing from the merged log.
- Corollary: rule changes or bug fixes can re-derive everything from history.

### KV schema (replaces `scores:*`)
| Key | Value | Writes |
|---|---|---|
| `answers:<user>:<yyyy-mm-dd>` | array of answer records, appended per round | ~5–10/day/child |
| `state:<user>` | derived cache: fact states, family EMAs, streak/shields, medals, big-goal, baselines, `lastProcessedDay`, audit log | ~few/day |
| `profile:<user>` | name, avatar, PIN hash, DOB, per-child settings (easy-day toggle, anxiety-buffer opener) | rare |

Profiles move to KV (v4 kept them device-local — that limitation dies here; the
kids can log in from any device). Free-tier KV limits (1k writes/day) are ~50×
headroom.

---

## 3. Screen inventory

### Child (index.html)
| Screen | Content |
|---|---|
| **Who's playing** | Two big avatars + parent-area lock. Tap → PIN pad. |
| **Today** | Streak flame + count, goal-reveal card (bronze + one-line why + micro-proof), three round cards (ready → done ✓), medal ladder with progress, big-goal bar (only if campaign active). |
| **Round** | Question large and central, answer display, keypad, progress dots (1–10), count-up clock only for timed-phase content. Correct → ~300ms tick, next. Wrong → fact shown neutrally 2s (+ ≤8-word cue if untimed-phase), requeued seamlessly. |
| **Round end** | Score, medal progress, "2 facts to watch" recap with one tap-to-answer retry each, data-gated improvement line, honest bad-round copy. |
| **Break / stop-lock** | Break prompt after 3–4 consecutive rounds; post-gold lock state with greyed tomorrow-preview. Victory-lap offer if ending on a failed round. |
| **Sprint round** | Weekly 60s variant, framed as a normal round type. |
| **Free play** | Unlocked after dailies; pick anything; counts toward nothing. |

### Parent (admin.html, password)
Per child: today/week summary (rounds, streak, medals, easy-day log) · fluency
index band + growth-slope chart · struggle flags with their triggering evidence ·
state-transition audit · exclusion-rate alarm · MTC probe launcher · CSV export ·
per-child toggles. Launch banner: "scores dip in the first weeks — that's the
interleaving working; judge at weeks 4–10." Big-goal wizard lands in Phase 4.

All child-facing strings live in one module (`game/copy.js`) so the tone rules
(matter-of-fact, no fake praise, lock-not-done framing) are enforced in one place.

---

## 4. Module map

```
index.html  admin.html  manifest.json  sw.js
css/                     design system (tablet-first, pointer-size aware)
js/
  config.js              ALL tunable constants (thresholds, ladder, copy timing)
  data/db.js             IndexedDB: answers, state, profiles
  data/sync.js           KV sync — append answers, merge, state cache push/pull
  engine/facts.js        fact universe, features (crosses_10…), families, ladder
  engine/classify.js     RT-cleaning pure fn → {counts_for_accuracy, counts_for_rt, reason}
  engine/states.js       per-fact state machine (FLUENT/SLOW/UNKNOWN/STUCK)
  engine/adapt.js        lazy daily fn: off-day guard, EMA, promote/demote, audit
  engine/scheduler.js    round builder: focus/review/mixed/sprint/placement + daily caps
  engine/flags.js        theme aggregation, error tagging, flag state machine
  engine/metrics.js      fluency index (Westwood SS), growth slope, MTC conversion
  game/session.js        round flow controller (timing capture, requeue, validity)
  game/keypad.js         pad + keyboard unified input, per-method baselines
  game/streaks.js        shields, repair, bounce-back, milestones
  game/medals.js         tiers, round validity, day state (incl. easy days, goal reveal)
  game/screens/*.js      login, today, round, roundEnd, stop, freePlay
  game/copy.js           every child-facing string
  parent/*.js            dashboard views
functions/api/
  answers.js  state.js  profiles.js     (KV-backed, replace scores.js)
tests/
  run.js  classify.test.js  states.test.js  adapt.test.js  scheduler.test.js
  simulate.js             synthetic-child simulation (see §5)
```

Carried over from v4: nothing verbatim; patterns reused (localdb IndexedDB
wrapper shape, fetch-with-timeout, merge logic). v4 files
(`js/game.js`, `js/mathLevels.js`, `admin-new.html`, …) deleted at cutover.

---

## 5. Build steps

Work happens on a **`v5` branch** (push-to-deploy only fires on `master`; the
live v4 site stays up until cutover). Local dev: `python -m http.server` for UI,
`npx wrangler pages dev` for KV paths, `node tests/run.js` for the engine.

| Step | Deliverable | Done when |
|---|---|---|
| **1. Engine core** | `config`, `facts`, `classify`, `states`, `adapt`, `scheduler`, `flags`, `metrics` as pure modules + unit tests | Tests pass; **simulation harness** runs 60 synthetic days for modeled children (steady 85%-er, bad-day-prone, slow-typer, masher) and shows: ladder promotes sanely, one bad day never demotes, masher earns nothing, flags fire only when they should |
| **2. Data layer** | IndexedDB schema, KV functions, sync, lazy-adaptation trigger | Two browsers with interleaved offline play converge to identical derived state |
| **3. Child app** | Screens, keypad, session flow, PWA shell | Full daily loop playable on tablet + laptop; installable; works offline |
| **4. Loop mechanics** | Streaks/shields/repair, medals + validity, goal reveal + gate, easy days, break/stop/lock, sprint round, placement mode | Copy audit against DESIGN tone rules; easy-day randomness verified over simulated weeks |
| **5. Parent dashboard** | admin.html views on live derived state | Flags show evidence trails; fluency band/slope render from simulated + real data |
| **6. Cutover** | Delete old KV keys + v4 files, `wrangler.toml`/workflow check, merge `v5` → `master` | Deployed; kids' placement week begins |
| **7. Later** | Email Worker (cron + provider TBD), big-goal wizard | — |

Step 1 is deliberately first and UI-free: the engine is where the evidence
lives, and the simulation harness proves the rules behave before a child ever
sees them. Steps 2–3 can overlap once 1 is green.

---

## 6. Design language (slick, not babyish)

10–11-year-olds, so: clean, confident, fast — closer to a sports-watch UI than
a CBeebies game. Large type for questions, one accent colour per child (their
choice — a free peripheral choice), satisfying micro-transitions (streak flame
tick, medal fill, bar animation) but **zero decoration during answering** —
the evidence excluded per-question reward animations, and seductive-details harm
is worst for weaker learners. Dark-friendly palette for evening sessions.
Touch targets ≥48px; keypad thumb-reachable in landscape and portrait.
