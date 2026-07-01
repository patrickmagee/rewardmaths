# Reward Maths Game

A simple, zero-dependency math practice game for kids — for **home use**. Log in, pick a
category, answer 10 timed questions, beat your best score. Scores are shared across the
family's devices via Cloudflare; everything also works offline.

**Live:** https://rewardmaths.pages.dev

---

## How it plays

1. Log in with a username + password (see default users below).
2. Pick a category:
   - **Addition** / **Subtraction** — Easy, Medium, or Hard.
   - **Times tables** — 2 through 12.
3. Answer **10 timed questions**.
4. Your score (correct out of 10) and time are saved, and your **best scores for that
   category** are shown.

### Default users
| Username | Password | Role |
|----------|----------|------|
| `tom` | `dino` | player |
| `patrick` | `laura` | admin |
| `eliza` | `anime` | player |

These are seeded automatically the first time the app runs (when no users exist yet).

---

## Architecture

Vanilla **ES6 modules**, no framework, no dependencies. Two data stores:

- **Local IndexedDB** (`js/localdb.js`) — per-browser store for **profiles, login, and
  an offline mirror of scores**. It exposes a Supabase-shaped API (`supabase.from(...)`,
  `supabase.auth...`) so the calling code stays simple, but it is **entirely local** —
  there is no Supabase/cloud database.
- **Cloudflare KV** (`functions/api/scores.js`) — a Cloudflare Pages Function that
  stores **shared score history** so scores sync across devices.

Scores are **written to both** stores and **read merged** from both, so offline play and
cross-device play both work. Profiles/login live only in local IndexedDB (not yet
synced across devices).

```
Browser (static ES6 modules)
├── index.html      → js/app.js → js/game.js        (the game)
├── admin-new.html  → js/admin.js                    (parent dashboard)
├── js/localdb.js    IndexedDB shim (local)
├── js/scoreStore.js fetch adapter for /api/scores
├── js/storage.js    merges local + remote scores
└── functions/api/scores.js  Pages Function → Cloudflare KV (env.SCORES)
```

### Key files
| File | Purpose |
|------|---------|
| `js/game.js` | Game flow: category → 10 questions → score |
| `js/mathLevels.js` | Question generation per category |
| `js/config.js` | `APP_CONFIG`, `CATEGORIES`, difficulty settings, messages |
| `js/localdb.js` | Local IndexedDB store + Supabase-shaped shim + local auth |
| `js/scoreStore.js` | Talks to `/api/scores` (`remoteSaveScore/GetScores/GetAllScores`) |
| `js/storage.js` | `Storage`: concurrent save, merged read |
| `js/admin.js` | Admin dashboard: users, session history, CSV export |
| `functions/api/scores.js` | Shared score history over Cloudflare KV |

### The scores API (`functions/api/scores.js`)
KV key scheme `scores:<category>:<user_id>` → JSON array (best-first, capped at 50).

| Method | Query | Returns |
|--------|-------|---------|
| `GET` | `?user_id=&category=` | that user's history for the category |
| `GET` | `?all=1` | every score (admin dashboard stats) |
| `POST` | `{ user_id, category, score, time_ms, played_at? }` | appends a score |

---

## Admin dashboard

Open `admin-new.html` and log in as `patrick`.
- **Users** — per-user stats (sessions, questions, accuracy) from the shared KV store.
- **Performance** — per-game Session History (User · Date · Category · Score · Accuracy ·
  Time), filterable by user/date, with CSV export.
- **Create User** / **Set Level** — manage local profiles.

---

## Run locally

ES6 modules must be served over HTTP (not opened as `file://`):

```powershell
python -m http.server 8000
# Game:  http://localhost:8000/index.html
# Admin: http://localhost:8000/admin-new.html
```

`python -m http.server` does not run the Cloudflare Function, so `/api/scores` calls
fail fast and the app falls back to local IndexedDB — the intended offline behavior. To
test the Function locally, build `dist/` (below) and run `npx wrangler pages dev dist`.

---

## Build & deploy (Cloudflare Pages)

Hosted free on Cloudflare Pages (migrated off Bluehost 2026-07-01).

**Push to deploy:** a `git push` to `master` automatically builds and deploys to
production via GitHub Actions (`.github/workflows/deploy.yml`, using the
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo secrets). Feature branches and PRs
do **not** deploy. You can also trigger it manually from the Actions tab.

**Manual fallback** (from your machine, if ever needed):
```powershell
./build-dist.ps1   # assemble dist/ (static assets + Pages Functions)

# Load the API token (repo-local, gitignored — never commit it)
$env:CLOUDFLARE_API_TOKEN  = (Get-Content .cloudflare.env | ? { $_ -match '^CLOUDFLARE_API_TOKEN=' })  -replace '^CLOUDFLARE_API_TOKEN=',''
$env:CLOUDFLARE_ACCOUNT_ID = (Get-Content .cloudflare.env | ? { $_ -match '^CLOUDFLARE_ACCOUNT_ID=' }) -replace '^CLOUDFLARE_ACCOUNT_ID=',''

npx wrangler pages deploy dist --project-name rewardmaths --branch main
```
`dist/` is a build artifact — always regenerate it, never hand-edit it. The KV binding
(`SCORES`) comes from `wrangler.toml`. After deploying, verify at
https://rewardmaths.pages.dev.

---

## Known limitations / follow-ups

Tracked as GitHub issues:
- **Profiles & levels are local-only** — not synced across devices (scores are).
- **Passwords are stored plaintext** in IndexedDB (home-use game).
- **Create-user username case** — created as typed, but login lower-cases it.
- **Level machinery is partly vestigial** — gameplay is category-based, not level-based.

---

## Notes for AI code assistants

- **No Supabase / no cloud DB.** The `supabase` export in `js/localdb.js` is a local
  IndexedDB shim. All *shared* state goes through Cloudflare KV via `/api/scores`.
- After editing app files, **push to `master`** — GitHub Actions builds and deploys
  automatically (`.github/workflows/deploy.yml`).
- `QUESTIONS_PER_GAME` is defined once in `js/config.js`; import it, don't redeclare.
- See `CLAUDE.md` for the full architecture, data-flow, and conventions.
