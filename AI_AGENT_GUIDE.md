# AI Agent Guide - Reward Maths Game

This standalone guide has been retired. The earlier version described an abandoned
design (30 levels, level-progression rules, Supabase, an admin dashboard, a test
suite) that does not match the shipped app.

For accurate, current information see:

- **README.md** — features, file structure, login, storage schema, how to run.
- **CLAUDE.md** — project guide, module graph, storage schema, common tasks, security.

### One-paragraph orientation
Zero-dependency ES6 browser game. Entry point `js/app.js`. The player logs in by name +
password (Tom/dino, Patrick/laura, Eliza/anime — seeded in `js/localdb.js`), picks a
category (Addition or Subtraction easy/medium/hard, or a times table 2×–12×), and
answers 10 questions (`APP_CONFIG.QUESTIONS_PER_GAME` in `js/config.js`). Questions are
generated in `js/mathLevels.js` from the `categoryId`. Results are stored in IndexedDB
(`js/localdb.js`, stores: `profiles`, `scores`, `auth_sessions`) and surfaced as a
per-category top-10 leaderboard (`js/storage.js getTopScores`). There are no levels, no
progression rules, no Supabase, and no admin dashboard. Run with
`python -m http.server 8000`.
