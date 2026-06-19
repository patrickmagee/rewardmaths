# Reward Maths Game

A small, zero-dependency ES6 browser math game for kids. The player picks a name,
enters a password, chooses a practice category, and answers 10 quick questions. Each
category keeps a personal top-10 leaderboard.

## Features
- **Name + password login**: pick Tom, Patrick, or Eliza and enter the password.
- **Category practice**: Addition (Easy/Medium/Hard), Subtraction (Easy/Medium/Hard),
  and times tables 2× to 12×.
- **10 questions per game** with a running timer (`APP_CONFIG.QUESTIONS_PER_GAME`).
- **Weekly ticks**: each category tile shows a green tick once you score a perfect 10/10
  in it that week; the ticks reset every Sunday at midnight (local time).
- **Personal leaderboard**: per-category top 10, sorted by score (descending) then time
  (ascending).
- **Visual progress**: a row of circles fills green (correct) / red (incorrect) as you
  go through the 10 questions.
- **Play Again / Exit** popup at the end of each game.
- **Local IndexedDB storage**: works fully offline; no server, no cloud.
- **Responsive UI**: clean and mobile-friendly.

## File Structure

### Core Files
- `index.html` — Single-page UI: login, menu, game, and completion popup
- `favicon.svg` — Site icon
- `README.md` — This file

### JavaScript Modules (`js/`)
- `js/app.js` — Main application controller and entry point
- `js/auth.js` — Login/logout (wraps the local auth in `localdb.js`)
- `js/game.js` — Core game flow: 10 questions, scoring, timer
- `js/ui.js` — Screen transitions, leaderboard rendering, popups
- `js/mathLevels.js` — Generates questions from the `categoryId`
- `js/storage.js` — Reads/writes the `scores` store
- `js/localdb.js` — IndexedDB database, local auth, and default-user seeding
- `js/config.js` — Constants: categories, difficulty settings, messages
- `js/utils.js` — Helper functions

### CSS Modules (`css/`)
- `css/main.css` — Imports all CSS modules
- `css/base.css` — Base styles, reset, typography
- `css/components.css` — Component-specific styles
- `css/responsive.css` — Media queries / responsive design

### Module Graph
```
index.html
  └─ js/app.js
       ├─ auth.js   → localdb.js, config.js, utils.js
       ├─ game.js   → mathLevels.js, storage.js
       ├─ ui.js     → config.js, utils.js
       ├─ config.js
       └─ localdb.js
```

## Login

The app auto-seeds these profiles on first run (see `createDefaultUsers` in
`js/localdb.js`). Login is by name + password — there is no email login.

| User    | Password |
|---------|----------|
| Tom     | dino     |
| Patrick | laura    |
| Eliza   | anime    |

## How It Works

1. Pick a name on the login screen and enter the matching password.
2. Choose a category tile (Addition / Subtraction difficulty, or a times table).
3. Answer 10 questions. The progress circles and timer update as you play.
4. At the end, a popup shows your score and time. Choose **Play Again** or **Exit**.
5. Your result is saved to IndexedDB and the per-category top-10 leaderboard updates.

### Categories and Difficulty
Defined by the `.game-tile` buttons in `index.html`, with add/subtract ranges in
`DIFFICULTY_SETTINGS` (`js/config.js`), and generated in `js/mathLevels.js`:
- **Addition** — easy: single+single, medium: double+single, hard: double+double.
- **Subtraction** — always produces a non-negative result; easy/medium/hard widen the
  number ranges.
- **Times tables** — `multiply_N` for N from 2 to 12, with a multiplier of 1–12.

## Storage (IndexedDB)

Database `RewardMathsDB` with three object stores (see `js/localdb.js`):
- **`profiles`** — `id`, `username`, `display_name`, `email` (`<name>@local`),
  `avatar_emoji`, `is_admin`, `password` (plain text), timestamps.
- **`scores`** — `user_id`, `category`, `score`, `time_ms`, `played_at`.
- **`auth_sessions`** — the single active local session.

There is no Supabase, no levels, and no progression system. `localdb.js` exposes a
small Supabase-shaped wrapper (`supabase`, `.from()`, `.auth`) only so the rest of the
code can talk to IndexedDB through a familiar API.

## How to Run Locally
ES6 modules must be served over `http://` (not opened via `file://`):
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` and log in with one of the names + passwords above.

## Development Guidelines

### Common changes
- **Questions per game**: `APP_CONFIG.QUESTIONS_PER_GAME` in `js/config.js`.
- **Difficulty ranges**: `DIFFICULTY_SETTINGS` in `js/config.js`.
- **Add a category**: add a `.game-tile` button with `data-category` in `index.html`,
  add a matching entry to `DIFFICULTY_SETTINGS` in `js/config.js` if it needs
  add/subtract ranges, and make sure `generateQuestion` in `js/mathLevels.js`
  handles the prefix.
- **Add/change users**: edit `createDefaultUsers` in `js/localdb.js`. Seeding only runs
  when no profiles exist, so clear the `RewardMathsDB` IndexedDB to re-seed.
- **Completion messages**: `MESSAGES.GAME_COMPLETE` in `js/config.js` (keyed by name).

### Code style
- ES6+ (classes, modules, arrow functions, const/let).
- JSDoc on functions; small, single-purpose functions.
- Keep concerns separated across modules; update imports when adding modules.

## Security

This is a **local-only kids game on a single device**. Profiles and passwords are
stored in **plain text in the browser's IndexedDB**, the passwords are simple memorable
words, and there is no server or real authentication boundary. Do not store anything
sensitive here. Password hashing is intentionally not implemented.

## Contact
This is a personal/educational project; there is no support address.
