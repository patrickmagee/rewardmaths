# Testing & Deployment

This project uses **Vitest** for unit/integration tests and **Playwright** (Chromium) for
end-to-end browser tests. Both run automatically in CI on every push to `master` and on every
pull request. Deployment to the live host is **gated** behind those tests passing.

---

## Running tests locally

```bash
# 1. Install dependencies (runtime app has zero deps; these are dev/test only)
npm install

# 2. Install the Chromium browser Playwright drives
npx playwright install chromium

# 3a. Run everything (unit + e2e)
npm test

# 3b. Or run a single suite
npm run test:unit    # Vitest only
npm run test:e2e     # Playwright only
```

Useful extras:

```bash
npm run test:watch   # Vitest in watch mode while developing
npm run serve        # Serve the repo root at http://127.0.0.1:8000 (same server e2e uses)
```

---

## What each suite covers

### Unit / integration (Vitest — `tests/unit/`)
Runs in jsdom with `fake-indexeddb` (see `tests/setup.js`) and imports the **real** modules
from `js/`:

- **`js/mathLevels.js`** — `generateQuestion()` invariants across all categories (subtraction
  answers never negative, multiplication products correct, canonical key dedupes `5x3`/`3x5`),
  plus `getCategoryDisplayName()` and `resetLastQuestion()`.
- **`js/localdb.js`** — default-data seeding, case-insensitive `signInByName()` login, and the
  error paths (`User not found`, `Wrong password`), plus the `supabase.from(...)` query builder.
- **`js/storage.js`** — `saveScore()` persistence and `getTopScores()` ordering (score DESC,
  then time ASC) and limiting.
- **`js/game.js`** — full 10-question game flow against a stubbed auth, verifying scoring,
  completion detection, the in-flight and post-completion double-submit guards, and that
  `Storage.saveScore` is called exactly once on completion (with `delay()` mocked for speed).
  Also covers the UI helpers: `renderLeaderboard()` (empty + populated), `formatTime`/`formatDate`,
  and per-user completion messages.
- **`js/game.js` (timer)** — `tests/unit/timer.test.js`: MM:SS formatting (e.g. `65s → 1:05`,
  `610s → 10:10`), `getElapsedTime()` under fake timers, `cleanup()`/`stopTimer()` idempotency,
  and the positive elapsed time captured at completion.
- **Weekly ticks** — `tests/unit/week.test.js` covers `getWeekStartMs()` (most recent Sunday
  local midnight, idempotent within the week, week-apart spacing); `tests/unit/weekly-ticks.test.js`
  covers `Storage.getWeeklyPerfectCategories()` (only 10/10 scores on/after the week start count,
  boundary inclusive, last-week excluded, deduped, per-user scoped).

### End-to-end (Playwright — `tests/e2e/`)
Drives the real `index.html` served at `http://127.0.0.1:8000` (config in
`playwright.config.js`, static server in `tests/static-server.mjs`): login, category
selection, answering questions, the leaderboard, the completion popup (Play Again / Exit /
Escape), and the weekly "aced" tick lighting up after a 10/10.

---

## Deployment

Deployment runs **only after the `test` job succeeds**, and **only** on a push to `master`
(not on pull requests). It copies the static site files (`index.html`, `favicon.svg`, `js/**`,
`css/**`) to the cPanel host over SCP via `appleboy/scp-action`. `node_modules`, `tests`,
`.github`, and docs are never deployed.

### Required GitHub secrets

Add these under **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Required | Description |
|--------|----------|-------------|
| `DEPLOY_HOST` | Yes | cPanel server hostname or IP |
| `DEPLOY_USER` | Yes | SSH / cPanel username |
| `DEPLOY_SSH_KEY` | Yes | Private SSH key (full PEM contents) authorized on the host |
| `DEPLOY_PATH` | Yes | Absolute target directory on the host (e.g. `/home/USER/public_html`) |
| `DEPLOY_PORT` | Optional | SSH port; defaults to `22` if unset |

**Steps:**
1. Go to the repository on GitHub → **Settings**.
2. In the sidebar, open **Secrets and variables → Actions**.
3. Click **New repository secret**, enter the name and value for each secret above, and save.
4. Repeat for every required secret (and `DEPLOY_PORT` only if your host uses a non-standard port).

### Blocking merges on red tests
The workflow runs on pull requests, but to **prevent merging** when tests fail you must enable
branch protection:

1. **Settings → Branches → Add branch protection rule** (or edit the existing `master` rule).
2. Enable **Require status checks to pass before merging**.
3. Select the **`test`** check.
4. Save.

### Note on the live host
The live host currently returns a **cPanel "Account Suspended"** page, so the deploy step will
only succeed once hosting is active. Until then the gated deploy may run but cannot publish a
working site.
