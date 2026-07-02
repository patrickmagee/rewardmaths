# RewardMaths

A home-use mental-arithmetic tutor for kids, built as an evidence-locked
adaptive practice engine. Zero dependencies, no build step, free hosting.

**Live:** https://rewardmaths.pages.dev

---

## How it plays

1. Tap your avatar, enter your 4-digit PIN.
2. The app shows your **streak**, today's **goal reveal** ("Bronze today =
   2 rounds"), and three **system-picked rounds**: a warm-up on a table you
   own, a challenge targeting your weakest facts, and a mixed round.
3. Answer 10 timed questions per round on the big keypad (physical keyboard
   works too). Wrong answers show the correct fact and come round again.
4. Effort medals — bronze (2 rounds) / silver (4) / gold (6) — and a streak
   that survives real life (2 automatic shields a week, bounce-back bonuses,
   the occasional surprise easy day).

There is no difficulty picker and no sibling leaderboard — the engine chooses
content from each child's own per-fact accuracy and speed, and every child
only ever sees their own progress.

## The engine (docs/DESIGN.md)

Every mechanic is sourced to adversarially fact-checked education research
(five research reports in `docs/research/`): spaced retrieval, interleaving,
incremental rehearsal, forgiving streaks, effort-based rewards, volume caps
at the point of diminishing returns, and positive-tone-but-always-corrective
feedback.

Every answer is logged (`fact`, correct, thinking time, typing time) and all
adaptive state derives from that log — fact states (fluent / slow / unknown /
stuck), an add/sub fact-family ladder, a bad-day-tolerant adaptation rule,
and struggle flags for the parent.

## Parent dashboard

`admin.html` (password-gated): per-child activity, an age-normed fluency
index + growth trend, a times-table fact map, struggle flags with the
evidence and a scripted 10-minute kitchen-table fix, audit trail, CSV export.

## Tech

- Vanilla ES6 modules; tablet-first PWA (installable, offline-capable).
- Local-first: IndexedDB per device, union-merged into Cloudflare KV via
  Pages Functions (`/api/answers`, `/api/profiles`).
- Hosted free on Cloudflare Pages; a push to `master` auto-deploys.

```powershell
python -m http.server 8000   # local dev (offline path)
node tests/run.js            # 108 engine tests
node tests/simulate.js       # 60-day synthetic-child simulation
```

See `CLAUDE.md` for the full project guide and `docs/REWRITE.md` for
architecture.
