# Reward Maths Game - Claude Code Project Guide

**Last Updated**: June 2026
**Version**: 4.0 (Category Practice, Local IndexedDB)
**Status**: Ready to Use

---

## Working Mode for Claude (REQUIRED)

For ALL non-trivial work in this project:
- **Always use maximum effort** — reason thoroughly, verify findings, do not cut corners.
- **Always use a multi-agent swarm** — orchestrate work with the Workflow tool (ultracode-style): fan out parallel agents to explore/implement, and adversarially verify results before reporting. Prefer parallel sub-agents over doing everything in a single thread.

Only skip the swarm for trivial, single-step conversational replies.

---

## Quick Start for Claude

### What Is This Project?
A small, zero-dependency ES6 browser math game for kids. The player picks a name,
enters a password, chooses a practice category, and answers 10 questions as fast as
possible. Each category keeps a personal top-10 leaderboard (by score, then time).

- Category-based practice (no levels, no progression rules)
- 10 questions per game (`APP_CONFIG.QUESTIONS_PER_GAME`)
- Personal per-category top-10 leaderboard (score descending, then time ascending)
- Local IndexedDB storage via `js/localdb.js` (offline, no cloud, no server)
- Name + password login with a few seeded local profiles
- Clean ES6 modular architecture with zero external dependencies

### Categories
- **Addition**: Easy / Medium / Hard
- **Subtraction**: Easy / Medium / Hard
- **Times tables**: 2× through 12×

Categories are defined by the `.game-tile` buttons (with `data-category`) in
`index.html`. Add/subtract ranges live in `DIFFICULTY_SETTINGS` in `js/config.js`;
times tables need no settings entry. Questions are generated in `js/mathLevels.js`
by string-parsing the `categoryId` (e.g. `add_easy`, `multiply_7`).

### Default Login Credentials
The app auto-seeds these local profiles on first run (see `createDefaultUsers` in
`js/localdb.js`). Login is by name + password; there is no email login.

| User    | Password | Notes      |
|---------|----------|------------|
| Tom     | dino     |            |
| Patrick | laura    | is_admin   |
| Eliza   | anime    |            |

Note: `is_admin` is just a flag on the profile. There is no admin dashboard in the
shipped app.

---

## Project Structure Overview

```
TE_Math/
├── index.html                   # Single-page game UI (login, menu, game, popup)
├── favicon.svg                  # Site icon
│
├── js/                          # Modular ES6 JavaScript
│   ├── app.js                   # Main application controller / entry point
│   ├── auth.js                  # Login/logout (wraps localdb auth)
│   ├── game.js                  # Core game flow (10 questions, scoring, timer)
│   ├── ui.js                    # Screen transitions, leaderboard, popups
│   ├── mathLevels.js            # Question generation from categoryId
│   ├── storage.js               # Score read/write (scores store)
│   ├── localdb.js               # IndexedDB database + local auth + seeding
│   ├── config.js                # Constants: categories, difficulty, messages
│   └── utils.js                 # Helper functions
│
├── css/                         # Modular CSS
│   ├── main.css                 # Imports all CSS modules
│   ├── base.css                 # Base styles & reset
│   ├── components.css           # Component-specific styles
│   └── responsive.css           # Media queries
│
└── Documentation/
    ├── CLAUDE.md                # This file
    ├── README.md                # Main project documentation
    ├── AI_AGENT_GUIDE.md        # Stub -> see README/CLAUDE
    ├── DOCUMENTATION_INDEX.md   # Stub -> see README/CLAUDE
    └── REFACTORING_SUMMARY.md   # Stub -> see README/CLAUDE
```

### Module Graph (live)
```
index.html
  └─ js/app.js
       ├─ auth.js   → localdb.js, config.js, utils.js
       ├─ game.js   → mathLevels.js, storage.js
       ├─ ui.js     → config.js, utils.js
       ├─ config.js
       └─ localdb.js
```

---

## Quick Start

### Running Locally
```bash
# Start a local server (ES6 modules require http://, not file://)
python -m http.server 8000

# Open in browser
http://localhost:8000
```

The app auto-creates the default profiles on first load. Pick a name, enter the
matching password, choose a category, and play.

---

## Storage Schema (IndexedDB)

Database name `RewardMathsDB` (see `js/localdb.js`). Object stores:

**`profiles`** (keyPath `id`)
- `id`, `username`, `display_name`, `email` (`<name>@local`), `avatar_emoji`,
  `is_admin`, `password` (plain text), `created_at`, `updated_at`.
- Indexes: `username` (unique), `email` (unique).

**`scores`** (keyPath `id`, autoIncrement)
- `user_id`, `category`, `score`, `time_ms`, `played_at`.
- Indexes: `user_id`, `category`, `user_category`.

**`auth_sessions`** (keyPath `id`)
- Holds the single active local session.

There is no Supabase, no levels, no `game_sessions`, no `question_attempts`, and no
`level_configs`. `localdb.js` exposes a small Supabase-shaped wrapper (`supabase`,
`.from()`, `.auth`) purely so the rest of the code can use a familiar API against
IndexedDB.

---

## Game Rules

- Each game is exactly `APP_CONFIG.QUESTIONS_PER_GAME` (10) questions for one category.
- Score = number of correct answers (0–10). A timer records total elapsed time.
- On completion a popup shows the score and time with **Play Again** / **Exit**.
- The leaderboard (`storage.js getTopScores`) shows the player's top 10 results for
  that category, sorted by score descending, then `time_ms` ascending.

### Difficulty (from `DIFFICULTY_SETTINGS` in `config.js`)
- `add_easy`: single + single. `add_medium`: double + single. `add_hard`: double + double.
- `sub_easy/medium/hard`: subtraction with a guaranteed non-negative result.
- `multiply_N`: the N times table, N from 2 to 12, multiplier 1–12.

---

## Common Tasks

### Change questions per game
Edit `APP_CONFIG.QUESTIONS_PER_GAME` in `js/config.js`.

### Tune difficulty
Edit the `min/max` ranges in `DIFFICULTY_SETTINGS` in `js/config.js`. Generation logic
lives in `js/mathLevels.js`.

### Add or change a category
1. Add a `.game-tile` button with a `data-category` value in `index.html`.
2. If it needs add/subtract ranges, add a matching entry to `DIFFICULTY_SETTINGS`
   in `js/config.js` (times tables don't need one).
3. Ensure `generateQuestion` in `js/mathLevels.js` handles the `categoryId` prefix.

### Add / change users
Edit `createDefaultUsers` in `js/localdb.js`. Because seeding only runs when no
profiles exist, clear the IndexedDB database (browser devtools → Application →
IndexedDB → `RewardMathsDB`) to re-seed.

### Add personalized completion messages
Edit `MESSAGES.GAME_COMPLETE` in `js/config.js` (keyed by display name).

---

## Browser Compatibility

- Chrome/Edge: Full support (recommended)
- Firefox: Full support
- Safari: Full support
- Mobile: Responsive design

### Requirements
- ES6 Modules (served over http://)
- IndexedDB
- Modern CSS (Grid, Flexbox)

---

## Security

This is a **local-only educational game for a handful of kids on one device**. Be
realistic and do not overstate its security:

- Profiles and passwords are stored **in plain text in the browser's IndexedDB**.
  Passwords are simple words chosen for kids to remember, not real credentials.
- There is no server, no network calls, and no real authentication boundary — anyone
  with access to the browser can read or change the data.
- Do not put any sensitive information into this app.
- Password hashing is intentionally not implemented (a `hashPassword` helper exists in
  `localdb.js` but is unused). If real security is ever needed, that is a deliberate
  future change, not a quick patch.

---

## Troubleshooting

### "App not configured" Error
`isSupabaseConfigured()` in `localdb.js` returns true for the local DB, so this should
not appear normally. If it does, check that `localdb.js` loaded without errors.

### Login Fails
- Confirm the name + password match a seeded profile (see table above).
- Open devtools and inspect IndexedDB → `RewardMathsDB` → `profiles`.

### Questions Not Loading
- Check the browser console for an "Unknown category" error — the `data-category`
  value in `index.html` must match a handler prefix in `mathLevels.js`.

### Must Use a Server
Opening `index.html` via `file://` breaks ES6 module imports. Always use
`python -m http.server 8000` (or any static server).

---

## Summary

A finished, zero-dependency, local-first kids math game: pick a name + password, pick a
category (Addition, Subtraction, or a times table), answer 10 questions, and beat your
personal top-10 leaderboard. All data lives in browser IndexedDB. No cloud, no levels,
no admin dashboard.
