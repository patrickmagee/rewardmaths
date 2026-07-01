# Reward Maths Game — Claude Code Project Guide

**Last Updated**: 2026-07-01
**Version**: 4.0 (Local IndexedDB + Cloudflare KV)
**Status**: Live at https://rewardmaths.pages.dev

---

## What Is This Project?

A simple, zero-dependency math practice game for kids, for **home use**. A child logs
in with a username + password, picks a category (addition, subtraction, or a times
table), answers **10 timed questions**, and gets a score. Best scores per category are
kept and shared across the family's devices. A parent/admin dashboard shows each
child's activity.

- Vanilla **ES6 modules**, no framework, no build step for the app itself.
- **Local-first**: works fully offline against browser IndexedDB.
- **Shared scores**: a Cloudflare Pages Function backed by **Cloudflare KV** syncs
  score history across devices.
- Hosted free on **Cloudflare Pages**.

> **There is no Supabase.** Earlier versions targeted Supabase; that is gone. The
> `supabase` object exported by `js/localdb.js` is a **local IndexedDB shim** that
> mimics the Supabase client API so the older calling code (`.from().select()`,
> `.auth.signInByName()`, etc.) keeps working unchanged. Do not add a Supabase client,
> credentials, or cloud calls. All shared state goes through Cloudflare.

---

## Architecture at a Glance

```
Browser (static site, ES6 modules)
├── index.html         Game UI            → js/app.js → js/game.js
├── admin-new.html     Admin dashboard    → js/admin.js
│
├── Data layer
│   ├── js/localdb.js      IndexedDB "supabase" shim  (local, offline mirror)
│   ├── js/scoreStore.js   fetch adapter for /api/scores
│   └── js/storage.js      Storage: merges local + remote scores
│
└── Cloudflare
    └── functions/api/scores.js   Pages Function  ── KV binding: env.SCORES
                                                     (shared score history)
```

### Two data stores, on purpose

| Store | Where | Holds | Source of truth for |
|-------|-------|-------|---------------------|
| **IndexedDB** (`RewardMathsDB`) | each browser, via `js/localdb.js` | `profiles`, `scores`, `auth_sessions` | **profiles & auth** (per-device); offline score mirror |
| **Cloudflare KV** (`SCORES`) | cloud, via `functions/api/scores.js` | score history | **shared scores** across devices |

- **Scores** are written to *both* (local mirror + KV) and **read merged** from both,
  so offline play and cross-device play both work.
- **Profiles / login / levels** live **only** in local IndexedDB — they are **not**
  synced across devices yet. See "Known limitations" below.

---

## Data Flow

### Saving a score (`Storage.saveScore`, `js/storage.js`)
1. Build the record `{ user_id, category, score, time_ms, played_at }`.
2. Write the **local** IndexedDB mirror and **POST** to `/api/scores` **concurrently**
   (`Promise.allSettled`) — a slow network never blocks the local write.
3. Return `true` if the score survived in **at least one** store.

### Reading best scores (`Storage.getTopScores`, `js/storage.js`)
1. Fetch remote (`GET /api/scores?user_id=&category=`) and local **concurrently**.
2. **Merge** both lists, **dedupe** (`user_id|category|score|time_ms|played_at`),
   sort best-first (higher score, then faster time), slice to the limit.
   Merging is why a just-played score shows immediately even before KV propagates,
   and why offline/pre-existing scores are never hidden by an empty remote result.

### Admin stats (`js/admin.js`)
- `fetchAllScores()` → `GET /api/scores?all=1` (every score across all users), with a
  fall back to this device's local `scores` if the API is unreachable.
- Users tab aggregates per-user totals; Performance tab builds per-game session rows
  (joined to profile names) and the CSV export.

---

## The Cloudflare Function: `functions/api/scores.js`

KV key scheme: `scores:<category>:<user_id>` → JSON array of score objects, kept
best-first and capped at `PER_USER_CAP` (50). A per-user history read is a single KV
`get`.

Routes:
| Method | Query | Returns |
|--------|-------|---------|
| `GET`  | `?user_id=&category=` | that user's history for the category |
| `GET`  | `?all=1` | every score across all users (admin dashboard) |
| `POST` | body `{ user_id, category, score, time_ms, played_at? }` | appends, trims to cap |

Notes:
- `?all=1` follows the KV **list cursor to completion** and **skips corrupt values**
  (one bad key cannot 500 the whole response).
- There is **no cross-user leaderboard route** — it was unused and was removed. The app
  only ever shows a single player's own best scores.
- No auth on the API (home use, low stakes; only score counts, no PII).

---

## Authentication (`js/localdb.js` `LocalAuth`, `js/auth.js`)

- **Username + password**, checked locally against the `profiles` store.
  `signInByName(username, password)`:
  - looks up the profile by username (**case-insensitive**, lower-cased),
  - **requires** a password — an account with no password set is **rejected** (not
    waved through), and a wrong password is rejected.
- Session is stored in the `auth_sessions` store and restored on load.
- Passwords are stored/compared as **plaintext** in IndexedDB (fine for a home game;
  see limitations).

### Default users (seeded on first load, `createDefaultUsers`)
| Username | Password | Role |
|----------|----------|------|
| `tom` | `dino` | player |
| `patrick` | `laura` | **admin** |
| `eliza` | `anime` | player |

Seeding only happens when the `profiles` store is empty. The admin dashboard logs in as
`patrick`.

---

## The Game (`js/game.js`, `js/mathLevels.js`, `js/config.js`)

- Player picks a **category** (`js/config.js` `CATEGORIES`):
  - Addition / Subtraction × Easy / Medium / Hard (operand ranges in
    `DIFFICULTY_SETTINGS`).
  - Times tables **2–12**.
- **`APP_CONFIG.QUESTIONS_PER_GAME = 10`** questions per game, timed.
- Score = number correct out of 10, plus total `time_ms`. Saved via `Storage.saveScore`.
- After a game, the player's **best scores for that category** are shown (merged
  local+remote).
- `QUESTIONS_PER_GAME` is defined **once** in `js/config.js`; `js/admin.js` imports it
  (do not redeclare it).

> **Levels are vestigial.** `profiles.current_level` exists and the admin can "Set
> Level", but gameplay is **category-based**, not level-based. `js/mathLevels.js`
> generates questions per category. Old references to a 30-level curriculum and
> `level_configs` are legacy; `level_configs` has no local store (reads return `[]`).

---

## Admin Dashboard (`admin-new.html`, `js/admin.js`)

Log in as `patrick`. Tabs:
- **Users** — per-user aggregate stats (sessions, questions, accuracy) computed from the
  **shared KV** scores (`?all=1`), local fallback. "Set Level" edits `current_level`.
- **Performance** — per-game **Session History** (User · Date · Category · Score ·
  Accuracy · Time) with user/date filters, plus **CSV export**. Both are built from the
  same score data.
- **Create User** — creates a local profile. Stores the password on the profile (so the
  new account can actually log in).
- **Level configs** — legacy editor; no local backing store.

---

## Local Development

```powershell
# ES6 modules need to be served over HTTP, not opened as file://
python -m http.server 8000
# Game:  http://localhost:8000/index.html
# Admin: http://localhost:8000/admin-new.html
```

Running the static files this way exercises the **local IndexedDB** path. The
`/api/scores` Function is not served by `http.server`, so `remote*` calls fail fast
(4s timeout) and the app falls back to local — which is the intended offline behavior.
To exercise the Function locally, use `npx wrangler pages dev dist` after a build.

---

## Build & Deploy (Cloudflare Pages)

**Live:** https://rewardmaths.pages.dev  (migrated off Bluehost 2026-07-01).

### 1. Assemble `dist/`
```powershell
./build-dist.ps1
```
`build-dist.ps1` produces a clean `dist/` containing the deployable assets **and** the
Pages Functions:
```
dist/
├── index.html  admin-new.html  favicon.svg
├── css/  js/
└── functions/            # Pages Functions must live inside the deployed dir
```
`dist/` is a build artifact — always regenerate it; don't hand-edit it.

### 2. Deploy
```powershell
# Load the API token (repo-local, gitignored — never commit it)
$env:CLOUDFLARE_API_TOKEN  = (Get-Content .cloudflare.env | ? { $_ -match '^CLOUDFLARE_API_TOKEN=' })  -replace '^CLOUDFLARE_API_TOKEN=',''
$env:CLOUDFLARE_ACCOUNT_ID = (Get-Content .cloudflare.env | ? { $_ -match '^CLOUDFLARE_ACCOUNT_ID=' }) -replace '^CLOUDFLARE_ACCOUNT_ID=',''

npx wrangler pages deploy dist --project-name rewardmaths --branch main
```

### KV binding
`wrangler.toml` marks this as a Pages project and binds the KV namespace as
`env.SCORES`:
```toml
name = "rewardmaths"
pages_build_output_dir = "dist"
[[kv_namespaces]]
binding = "SCORES"
id = "dd938e9f5745405b91a8e6e1dd01b3cf"
```

---

## File Map

| File | Responsibility |
|------|----------------|
| `index.html` | Game UI + login |
| `admin-new.html` | Admin dashboard UI |
| `js/app.js` | App bootstrap / controller |
| `js/game.js` | Game flow: category → 10 questions → score |
| `js/mathLevels.js` | Question generation per category |
| `js/config.js` | `APP_CONFIG`, `CATEGORIES`, `DIFFICULTY_SETTINGS`, messages |
| `js/auth.js` | Login/logout UX over `LocalAuth` |
| `js/localdb.js` | IndexedDB store **+** Supabase-shaped shim (`supabase`, `LocalAuth`) |
| `js/scoreStore.js` | `remoteSaveScore` / `remoteGetScores` / `remoteGetAllScores` |
| `js/storage.js` | `Storage`: merge-read + concurrent-write scores |
| `js/admin.js` | Admin: users, per-game history, CSV, create user, set level |
| `js/ui.js` | Screen transitions, popups |
| `js/utils.js` | Helpers (time formatting, DOM) |
| `functions/api/scores.js` | Pages Function: shared score history over KV |
| `build-dist.ps1` | Assemble `dist/` for deploy |
| `wrangler.toml` | Pages + KV config |
| `.cloudflare.env` | API token / account id (gitignored) |

---

## Known Limitations / Follow-ups

Tracked as GitHub issues — check the tracker before "fixing" these afresh:
- **Profiles & levels are local-only** — not shared through Cloudflare, so the user
  list and `current_level` reflect only the device you're on. Scores *are* shared.
- **Passwords are plaintext** in IndexedDB (`hashPassword` exists but is unused).
- **Create-user username case** — `createUser` stores the username as typed, but login
  lower-cases it; an account created with capitals won't be found at login.
- **Levels / `level_configs` / `mathLevels` level machinery** is partly vestigial.

---

## Conventions

- Vanilla ES6 modules, JSDoc on functions, small focused functions.
- Keep all shared state going through Cloudflare KV; keep local IndexedDB as the
  offline mirror. Don't reintroduce a cloud DB client.
- After changing app files, **rebuild `dist/` and redeploy** — the live site serves
  `dist/`, not the repo root.
- Keep this file and `README.md` current when architecture, hosting, or credentials
  change.
