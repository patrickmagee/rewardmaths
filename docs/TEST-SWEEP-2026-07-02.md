# RewardMaths v5 — Consolidated Test Sweep Report (2026-07-02, live @ rewardmaths.com)

## 1. VERDICT

The product core is solid: the full child loop, medal/break/gold-lock logic, anti-farming round voiding, parent dashboard rendering, and API contract all verified working on live with **zero JS page errors across ~20 rounds and 4 browser sessions**, and the repo suite passes 108/0. However, the derivation engine has a **confirmed determinism bug** that will make synced devices disagree on fact states within ~2–3 weeks of normal play, and the parent dashboard **silently loses settings writes** while reporting success. Ship-blockers are few and each has a small, well-located fix.

## 2. FINDINGS TABLE

| # | Severity | Area | Title | Detail |
|---|----------|------|-------|--------|
| 1 | critical | engine (`js/data/derive.js`) | deriveState not deterministic: baselines computed from raw answer array | `estimateTypingBaselines` gets the unsorted, non-deduped log (derive.js:28); `xs.slice(-200)` (:137) is array-order-dependent and dup-sensitive → `derive(shuffle(log)) != derive(log)` and `derive(mergeAnswers(log,log)) != derive(log)`, flipping FLUENT↔SLOW. Violates the module's own byte-identical contract. |
| 2 | major | dashboard (`js/parent/admin.js`) | Settings save shows "saved ✓" when server rejected the write | `wireSettings()` (~:286-291) never inspects the PUT response; server returned `{kept:'existing'}` yet UI claimed success. Reproduced live; write never persisted. |
| 3 | major | API (`functions/api/profiles.js`) | No server-side clamp on client `updated` — future timestamp bricks profile edits | 'test' profile in KV carries `updated` ~53 min in the future; every `Date.now()`-stamped dashboard save is rejected until then. `onRequestPut` (:50-53) trusts client timestamps, so one skewed clock permanently wedges a profile. Compounds #2 (rejection is invisible). |
| 4 | major | game (`js/game/session.js` / `screens.js` / `keypad.js`) | Keypad live during model reveal — submit fires before `renderAt` is set | **Verified in source this session:** `Keypad` defaults `enabled = true` (keypad.js:20); the `showModel` hook (screens.js:159-163) never disables it; `renderAt` is set only after the awaited reveal (session.js:53-55). If a round's *first* item is a model item, a tap during the 2.2s reveal calls `submit()` with `renderAt === undefined` → `initiation_ms = NaN` recorded into the log. |
| 5 | minor | game UI (`js/game/main.js` + `derive.js`) | Round-card ✓ ticks count voided rounds; medal note doesn't | `byType` (derive.js:58) counts VOID rounds; medal note uses `validRounds()`. Live repro: 2 cards ticked, note says "1 round today". On-screen numbers contradict each other after a voided round. |
| 6 | minor | game UI (`js/game/main.js:76`) | Today screen never re-renders after background sync | `syncAll().then(refreshDerived)` doesn't re-call `showToday()`. Fresh device shows 0 rounds / unlocked cards despite KV holding a gold-locked day. Reported independently by two agents. |
| 7 | minor | game UI (`js/game/screens.js:222-237`) | Recap "say it →" reveals an answer already shown; canonical strategy line missing | Tap replaces "10 × 9 = 90" with identical text — no retrieval moment; spec's strategy line absent from recap. |
| 8 | minor | API (`functions/api/answers.js:23,65`) | Impossible calendar dates accepted | `DAY_RE` is format-only; `day:'2026-99-99'` → 200, creates a garbage KV key that pollutes all-days responses. |
| 9 | minor | engine (`js/engine/classify.js:44`) | `counts_as_retrieval` can be `undefined` | Rule-5 fallthrough returns `ans.correct` unboxed; robustness only (in-app callers always pass a boolean). |
| 10 | info | game UX | Placement branded "Explorer", not disguised as normal rounds | Deviates from DESIGN.md §2 "disguised" wording; "test" never appears and medals are earned, so judgement call. |
| 11 | info | API security (by design) | Unauthenticated reads of any user's answers; `GET /api/profiles` ships `pinHash` | 4-digit-PIN SHA-256 is trivially brute-forceable offline. Acceptable for home threat model; revisit if ever multi-family. |

## 3. DETAIL — critical/major

### #1 deriveState order/merge non-determinism (critical)
- **What:** Typing baselines (which set the personal FLUENT cutoff) are computed from the raw answers array while the state fold uses the deduped, ts-sorted stream. With >200 typing samples on one input method (~2–3 weeks of play), different insertion orders of the *same* log select different `slice(-200)` subsets → different `childCutoff` → different fact states. Duplicate ids (naive sync-append) skew the median and can cross the ≥8-sample threshold, so `derive(merge(log,log)) != derive(log)`.
- **Where:** `C:\Projects\RewardMaths\js\data\derive.js:28` (raw array passed in), `:137` (`xs.slice(-200)`), vs dedupe at `:34`.
- **Repro:** `node fuzz-targeted.mjs` in scratchpad — scenarios B1 (shuffle, seed 1001), B2/B3 (duplicate ids), all deterministic. Random fuzz (600 scenarios) passes; only adversarial-but-realistic constructions trip it.
- **Fix:** One line — run `estimateTypingBaselines` on the deduped, ts-sorted answers (the same stream the fold consumes).

### #2 Dashboard "saved ✓" on rejected write (major)
- **What:** Save button reports success unconditionally; the API's last-write-wins guard rejected the PUT (`{kept:'existing'}`) and the setting never persisted (polled GET for 75s). A parent unticking "easy days on" believes it took effect.
- **Where:** `C:\Projects\RewardMaths\js\parent\admin.js` `wireSettings()` ~lines 286-291.
- **Repro:** `node settings-roundtrip.js` (scratchpad) — login as laura, untick easy days on Test card, save; capture PUT response.
- **Fix:** Inspect the PUT response; if `kept:'existing'`, show an error/retry state instead of "saved ✓".

### #3 Client-trusted `updated` timestamp, no clamp (major)
- **What:** `test` profile sat at `updated=1783010750000` (~53 min in the future) *before* this sweep; all dashboard edits to it are silently rejected until wall-clock catches up. One skewed device clock or synthetic write wedges a profile with no regression path (guard forbids lowering).
- **Where:** `C:\Projects\RewardMaths\functions\api\profiles.js:50-53`.
- **Repro:** `curl https://rewardmaths.com/api/profiles` → test.updated > now; any PUT with `updated=Date.now()` → `{kept:'existing'}`.
- **Fix:** Server-side clamp `updated = Math.min(clientUpdated, Date.now() + small_skew)` on write. Note: restore writes during testing left test at `...50002` — the condition is still live in KV; clamp + a one-off repair write needed.

### #4 Keypad live during model reveal (major — source-verified this session)
- **What:** During the awaited `showModel` reveal, the keypad is not disabled and `session.renderAt` is stale/undefined. On the first item of a round with `model:true`, an early tap + Enter drives `submit()` → `initiation_ms = Math.round(firstInputAt - undefined) = NaN` written to the answer log (and the answer is scored against a question the child never saw). Subsequent model items are shielded only incidentally (showCorrect/showWrong happen to disable the pad first).
- **Where:** `C:\Projects\RewardMaths\js\game\keypad.js:20` (`this.enabled = true` default), `js\game\screens.js:159-163` (showModel hook — no `pad.setEnabled(false)`), `js\game\session.js:53-55` (`renderAt` set after the await), `:78` (NaN arithmetic).
- **Repro:** Start a round whose first item is a model item; press a digit + Enter during "now you…".
- **Fix:** `pad.setEnabled(false)` at the top of the showModel hook (re-enabled by showQuestion); optionally guard `submit()` against `renderAt == null`. Note NaN `initiation_ms` also feeds the derive/classify pipeline (#1's input), so this pollutes stored logs.
- **Provenance caveat:** the reporting agent's summary was truncated/garbled ("Test minimal payload to isolate schema error") — the finding itself was re-verified against source in this consolidation and is real.

## 4. COVERAGE

**Tested (live production unless noted):**
- Child loop e2e as user 'test': PIN reject/accept, goal reveal copy, miss→correction→cue→requeue, round-end recap, bronze unlock, free play (7×, correctly medal-excluded), break prompt at 3 rounds.
- Endurance: 14 rounds/2 sittings; gold lock at 6 valid rounds + persistence across reload; anti-farming RT-void rule (bot-speed rounds silently voided, humanized rounds count); full physical-keyboard round; landscape 1180×820 layout; monotonic counters; zero pageerrors throughout.
- Parent dashboard e2e: login gating, all kid-card panels, CSV download initiation, settings round-trip (which found #2/#3), layout screenshots.
- API contract (`/api/answers`, `/api/profiles`): 16 checks — validation, union/idempotency, silent invalid-record dropping, last-write-wins guard (15 pass, 1 fail = #8).
- Engine fuzz (in-memory, not live): 600 seeded deriveState scenarios + 75 free-only + 6000 extreme classifyAnswer inputs + adversarial constructions (found #1); repo suite 108/0.

**NOT tested:**
- Real touch devices / portrait mobile; audio/accessibility/screen readers.
- Fluency-index sprint rounds and DOB flow (Test card showed "needs 0/3 sprint rounds"); PIN-change flow; CSV *content* correctness (only that download starts).
- Multi-day scheduler progression (placement ~12-day arc, review→focus→mixed ordering post-placement) — single-day sweep only.
- Concurrent multi-device writes / KV race conditions; KV quota/eviction behavior; offline-first behavior of v5.
- tom/eliza/patrick real data paths (deliberately untouched).
- The 5th agent's session truncated mid-run — its intended scope beyond finding #4 is unknown; treat that surface (model-reveal/input timing) as only spot-checked.

**Test residue in production KV:** 'test' has 4+ rounds on 2026-07-02 incl. voided timeout rounds and a `updated` stamp still ~future (see #3); a `swarmtest` profile exists with `role=admin` (kept off the kids' login screen); `answers:swarmtest:2026-99-99` garbage key exists (from #8 repro).