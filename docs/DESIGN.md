# RewardMaths v5 — Evidence-Locked Design & Implementation Plan

**Date**: 2026-07-02
**Status**: Approved design, pre-implementation
**Basis**: Five multi-agent research reviews (~106 agents, every key claim adversarially
fact-checked against primary sources). Full reports in `docs/research/`:
1. `01-daily-format.md` — daily loop, streaks, medals, feedback tone, parent score
2. `02-big-goal.md` — parent-set tangible goal ("skateboard bar")
3. `03-engagement-mechanics.md` — warmup, calibration, goal reveal, easy days, volume caps
4. `04-feedback-and-diagnosis.md` — in-game feedback depth, struggle detection, parent playbook
5. `05-adaptive-engine.md` — RT cleaning rules, add/sub fact-family ladder, adaptation metric

Goal: get Tom (10, average+) and Eliza (11, slightly below average) to excellent
mental-arithmetic fluency via short daily practice. Self-improvement only — **no
sibling comparison anywhere, ever** (the one thing the evidence actively warns
against for this pair).

---

## 1. The Child Experience

### Daily loop (~2 min minimum, ~12 min gold)
On login the child sees their streak, today's goal reveal, and **three system-built
rounds** in a default order (review → focus → mixed); the child may reorder them —
bounded choice, motivationally useful and pedagogically free:

1. **Review round** — a rotating previously-mastered table. Feels easy (this IS the
   "warmup"), is genuinely useful spaced retrieval. Every mastered table resurfaces
   at least every 1–2 weeks.
2. **Focus round** — targets the child's 2–3 weakest facts, embedded ~80/20 among
   known facts (incremental-rehearsal shape). Opens with 2–3 of the child's fastest
   facts, first weak fact within seconds (behavioural momentum window <10s).
   New/weak facts are **modeled** first: shown once *with* the answer ("7 × 8 = 56 —
   now you") before being quizzed.
3. **Mixed round** — interleaved across all learned tables + add/sub families.
   Steady-state format; source of the parent metric.

Extra rounds (toward silver/gold) widen review and mixed — **never** re-drill facts
already cleared today (see scheduler caps).

**No standalone easy round. No child choice of table — ever.** (Learner control:
g = 0.05; kids reliably re-practice what they know.) *Free play was removed
entirely (parent decision 2026-07-02):* after the daily set, a single "Play"
button serves extra system-picked rounds toward silver/gold; the gold lock
still caps the day. (`round_type: "free"` remains in the log schema for
compatibility but nothing writes it.)

**The Easy/Medium/Hard picker is REMOVED entirely** (decision 2026-07-02). The
child-facing category/difficulty UI goes away — kids only ever see "today's
rounds". For add/sub, `DIFFICULTY_SETTINGS` operand ranges are replaced by an
evidence-based **fact-family ladder** (+0/+1/+2 → doubles → near-doubles →
make-10/bridge-10 → crossings; subtraction families trailing their addition
counterparts), with the ~85–90% success gate deciding when the next family enters
the mix. Exact ladder, mastery gates, RT-cleaning rules, and the bad-day-tolerant
adaptation rule: §2 below and `docs/research/05-adaptive-engine.md`.

### Goal reveal (adopt — best-evidenced feature)
- Each day shows **today's bronze only**, concrete: "Bronze today = 2 rounds."
- **Attainability gate (mandatory)**: only reveal a target the child's history says
  they hit ≥70–80% of recent days. After a missed day, bounce-back bronze is modest.
- One-line why: "Today is 7s because you almost had them yesterday."
- Micro-proof from own data: "You did 3 rounds on Tuesday."
- Framing by content: performance ("get 8/10") for known material; mission ("crack
  the 7×8 family") when the focus round holds unknown facts; pure process ("do 2
  rounds") for Eliza after a rough patch.
- The reveal must never disclose easy-day status.

### Easy days (adopt as instrumented n=2 experiment — no direct study exists)
- Exactly **1 per rolling 7 days, position random**. Never a fixed weekday.
- Only bronze drops (1 round instead of 2); silver/gold unchanged and visible.
- Anti-licensing copy: "Bronze done early — silver is only 2 more rounds."
- Log per child: rounds-completed + next-day return on easy vs normal days.
  Per-child kill switch in admin. Kill if it lowers total effort.

### Streaks (private per child)
- **Streak survives on any 1 completed round.** Weekly model: **5 of 7 days** keeps
  it alive (parent's chosen rule), implemented as **2 auto streak-shields per week**
  (auto-covers up to 2 missed days — that IS the 5-of-7), plus 48h repair as a
  backstop (a double session restores a fully broken streak).
- **Bounce-back bonus**: day after a miss, meeting bronze earns extra celebration
  (top intervention of 54 in the Milkman megastudy, +27%).
- Milestones: day 3, 7, 30, 60. Record-best streak permanently visible.
- Breaks framed externally ("the app paused your streak"), never as failure.
  No countdown/doom notifications.

### Medals (effort tiers, per day, symbolic only)
- **Bronze = 2 rounds · Silver = 4 · Gold = 6.** No higher tier.
- Effort-gated, never accuracy-gated (performance-contingent rewards: d = −0.28 +
  most anxiety). Anti-farming is silent and reuses the §2 RT rules: a round voided
  by the session-void rule (≥3 excluded answers — mashes/anticipations) doesn't
  count toward medals; requeue-on-miss makes mashing pointless anyway. Never show
  an "accuracy failed" message.
- Matter-of-fact copy ("Gold — 60 questions today"), no gushing: from ~age 11,
  effort praise reads as a low-ability signal (Amemiya & Wang 2018).
- **Never convertible to money/toys/screen time** (Deci d ≈ −0.4 for children).
  The big-goal campaign (§4) is the one bounded exception, by design.

### Volume caps & stop state (adopt — spacing, not reverse psychology)
- Per fact: max **~3 correct retrievals/day**, then that fact stops being served.
- Per child: **3–6 genuinely unknown facts in circulation** (Eliza ~3, Tom ~5–6).
- After 3–4 consecutive rounds: break prompt — "Nice run. Rounds count more with a
  gap — come back after school and they'll be waiting." (Within-day split needs
  hours, not minutes.)
- After gold: **full stop state, lock framing**: "Gold! Today's medals are full —
  tomorrow's rounds unlock in the morning." + greyed preview of tomorrow's focus
  table. **Never "You're all done!"** (completion framing discharges the urge to
  return; lock framing keeps it alive).
- Fatigue detector: round median RT >20–25% slower than round 1 at equal
  difficulty, or accuracy under 50% → fire break prompt early.
- Peak-end: if the day would end on a failed round, offer one short easy "victory
  lap" so the stop fires after a success.

### In-round feedback (the line: 1 second to read, or it's out)
- Wrong answer → correct fact shown neutrally ~2s ("7 × 8 = 56"), fact requeued at
  end of round. Always. Positive-only applies to TONE, never to information.
- One **≤8-word derived-fact cue** on error, **only** for facts still below 90%
  accuracy (untimed phase): "7×8: think 7×7+7". Never for fluent facts.
- Timer: count-up (no pressure display) for any table under ~90% accuracy; normal
  timer once accurate. (Timed-practice anxiety claim: not experimentally supported.)
- Excluded from the app: multi-step explanations, arrays/number lines on error
  screens, mid-round strategy lessons, per-question reward animations. All routed
  to the parent (§5).

### End of round (~15s)
- Score, medal-tier progress, personal-best sparkline (self-comparison only).
- **"2 facts to watch" recap**: worst 1–2 missed facts, full fact + the canonical
  strategy line + one tap-to-answer retry each.
- Genuine-improvement messages only when data-true: "New personal best on the 8s —
  2 seconds faster than last week."
- Bad round (4/10): honest, no fake praise: "That was a tough set — the 7s are the
  hard ones, and you stuck with the whole round. They'll show up again tomorrow."

---

## 2. The Engine (per-fact model & scheduler)

### Logging (BLOCKING PREREQUISITE — nothing above works without it)
Extend score records + `/api/scores` payload with per-item data:
```
{ fact_id: "7x8", op: "mul", correct: true,
  initiation_ms: 1840,   // question render → first keypress (diagnostic)
  typing_ms: 950,        // first keypress → submit (motor, subtracted)
  round_type: "focus" | "review" | "mixed" | "sprint" | "placement" | "mtc" | "free",
  ts: <ISO> }
```
Only initiation latency is diagnostic. Median per fact, never mean. Commuted pairs
(7×8 / 8×7) stored separately, **pooled for flagging**.

### RT cleaning (pure function at write time; classifies, never mutates raw data)
Every answer gets `{counts_for_accuracy, counts_for_rt, exclusion_reason}`.
Constants fixed a priori in `js/config.js` — never re-tuned after seeing a child's
data. Ordered rules, first match wins:

1. **Auto-advance at 12s** (question times out — prevention beats cleaning).
   On UNKNOWN/STUCK fact: counts as wrong. On FLUENT/SLOW fact: attention lapse —
   excluded from both accuracy and RT (kids are on-task far less than adults; a
   60s answer on a normally-2s fact is distraction, not forgetting).
2. **Anticipation floor**: initiation <300ms → full discard, doesn't consume the
   fact's 3-per-day retrieval budget.
3. **Rapid guess**: wrong AND initiation <500ms → non-evidence (disengagement
   counter, not knowledge). Mashing can never drive a fact into STUCK.
4. **Lapse-suspect**: correct but >3× that fact's median (once ≥3 valid attempts)
   → counts for accuracy, excluded from RT. A single slow-correct never demotes
   FLUENT; only ≥2 of last 5 valid attempts over the speed cutoff → FLUENT→SLOW.
5. **Valid band** (floor…min(12s, 4× fact median)) → full evidence, raw ms.
6. **Wrong-and-slow** → full negative evidence (effortful error = real signal).

Asymmetry is deliberate: fast-wrong ignored, slow-correct accuracy-only,
slow-wrong counted. Session voided for state updates if ≥3 exclusions in a round
or >20% in a session (feeds the off-day guard). Excluded trials stay in the log
with reasons (auditable, re-runnable). Admin alarm if a child's weekly exclusion
rate exceeds ~10–15%. Floors apply to initiation; typing baseline is subtracted
only from total-time comparisons.

### Typing baseline
30-second "type the number you see" mini-game per child, re-run quarterly. All
latency bands are net of this — Eliza's typing speed must never read as a maths
deficit.

### Fact states (rolling last 5 valid attempts across ≥2 days; last-10 for fluency)
| State | Rule |
|---|---|
| FLUENT | 9 of last 10 correct AND median under the personal speed cutoff = 1.5× that child's own median RT on fluent facts (floor ~2.5–3s total incl. typing); demotes to SLOW only on ≥2 of last 5 over the cutoff |
| SLOW | ≥80% correct in window but over the cutoff — counting/deriving; focus-round target |
| UNKNOWN | <80% recent accuracy, timeout-dominated, or never seen |
| STUCK | ≥10 attempts without 3-in-a-row correct, or <60% over last 10 → feeds parent flag |

Cutoffs are per operation (subtraction legitimately slower than addition) and use
only answers the §2 RT rules marked valid — fast-wrongs and lapses never move a state.

### Calibration (one-time seed + continuous; never "calibration weeks")
- Initial placement disguised as normal medal-earning mixed rounds over **1–2
  weeks** (~2–3 exposures/fact, stratified rotation; commutativity + table priors
  shrink the item count). Output is a prior, not a verdict.
- After that every ordinary answer updates the model. Event-driven recalibration:
  fact unseen 21–28 days → silently reinjected; 2 misses in last 5 → demote a band;
  >2-week break → short disguised re-triage.
- The word "test" never appears child-side.
- Seed Eliza's placement rounds with a higher share of likely-known facts.

### Scheduler
- Focus round: 2–3 UNKNOWN/SLOW facts with highest error-weighted staleness, each
  repeated 2–3× within the round at increasing spacing, embedded ~80/20 in knowns.
- Review round: mastered table with oldest `last_seen`.
- Mixed round: samples all met categories, weighted toward SLOW facts.
- Blocked (single-table) rounds only briefly when introducing a new weak table,
  until 80–90% accuracy — then it joins mixed (interleaving hurts novices).
- Warm-up blocked rounds share the focus slot **day-about** with the true focus
  round (2026-07-12): the ladder frontier lives in warm-up for weeks at a time,
  and letting it monopolise the slot starves times-table weak-fact work —
  simulation showed the weak-7s struggle flag never firing without this.
- All thresholds in `js/config.js` — this is an n=2 experiment; keep tuning cheap.

### Add/sub fact-family ladder (replaces Easy/Medium/Hard)
Empirical order (problem-size effect, ties advantage, categorical stair-step at
crossing 10 — all verified; family *sequencing* is strong convention, treated as a
prior the per-fact states can override):

1. +0/+1 → 2. +2 → 3. doubles to 5+5 → 4. near-doubles → 5. make-10 pairs →
6. big doubles (6+6…9+9) → 7. bridge-through-10 (sums 11–18, grouped by
decomposition family) → 8. leftover hard facts → 9. two-digit ± ones (no
crossing) → 10. ± tens → 11. ± ones crossing decade → 12. two-digit ± two-digit
no carry → 13. with carry/borrow.

- **Subtraction unlocks per family only after its addition family is FLUENT**, and
  new subtraction facts are presented alongside their addition partner
  (9+4=13 → 13−9, 13−4) so retrieval routes through the addition fact. Speed
  cutoffs calibrated per operation, never pooled.
- Tag `crosses_10`/`crosses_decade` as fact features so the expected RT step at
  the bridge isn't misread as STUCK.
- **Mastery gate to admit the next family**: family EMA ≥0.85 AND ≥80% of its
  circulating facts FLUENT/SLOW AND sustained ≥2 sessions on ≥2 days. (Direct
  child RCT: *higher* preset success rates → more volume AND bigger gains — don't
  force errors if a kid cruises at 92%.)
- Only the current frontier family feeds the 3–6 unknown slots; newly unlocked
  harder families get at least equal scheduling priority (counteracts the
  documented under-exposure of large facts).
- **First run: placement sweep** — a few mixed rounds across all families, then
  each child starts at their first non-fluent family (expect the bridge-10 /
  minuends-11–18 zone; Eliza's frontier likely below Tom's). Don't spend the
  daily retrieval budget on ceiling-level facts.
- **Starting frontier (changed 2026-07-12, parent decision)**: children begin
  with families 1–6 pre-unlocked (plus those families' subtraction partners)
  and **family 7 (bridge-10) as the warm-up frontier** —
  `SCHEDULER.ADD_START_FAMILY`. Starting every child at +0/+1 was far too easy
  for ages 10–11 and, worse, gated the placement sweep to the one unlocked
  family. Going *down* still works without re-locking: pre-unlocked families
  are probed by placement, weak facts surface as UNKNOWN → focus-round
  targets, and sustained failure demotes a family back to warm-up.

### Adaptation metric (bad-day-tolerant, all silent)
Nightly pure function per child over the answer log; constants in `js/config.js`.

- **Off-day guard runs first**: if today's median RT on the child's own FLUENT
  facts >1.5× their trailing 14-day median, or FLUENT accuracy <70%, or the
  session-void rule fired → session flagged; mix eases live, **nothing is
  written** to states or averages. (A bad day depresses everything at once;
  real forgetting is fact-specific.) Implementation note 2026-07-12: "nothing"
  now includes per-fact records — the derive fold rolls back a flagged day's
  fact updates (previously bad-day attempts leaked into fact windows, knocking
  facts out of FLUENT and stalling family promotion for weeks after).
- **Per family, per day (≥6 items)**: `P_day = correct/presented` (classified
  answers only), smoothed `M ← 0.75·M + 0.25·P_day` — once per day, not per
  round, so a marathon bad evening can't compound. Half-life ~2–3 days.
- **Promote fast**: M ≥0.85 + the mastery gate above — fires immediately (cheap
  to reverse silently).
- **Demote slow (hysteresis)**: M <0.70 AND raw P_day <0.70 on ≥3 sessions over
  ≥3 distinct days, ≥1 not off-day-flagged. One bad day can never demote;
  neither can two.
- **Within-session controller, downward only**: 2 consecutive (or 3-of-5) misses
  → known-fact share to ~95%, no new UNKNOWNs this session, no state writes.
  Sessions never get harder mid-stream; upward moves happen between days.
- **All adaptation invisible to the child** — they see only monotonic indicators
  (facts mastered, streaks, personal bests). No level numbers that can go down.
  The admin dashboard shows the true state machine + every transition with its
  triggering evidence.

Worked example (the "occasional bad day"): Eliza scores 4/10 after two normal
weeks → off-day check first (globally depressed → nothing written); if it was
frontier-specific, M drops .90→.78 — above the .70 floor, no demotion, recovered
within 1–2 normal days. Net visible effect: none.

---

## 3. Parent Metrics (admin dashboard + daily email; kids never see any of it)

### Fluency index (the "100" number — honest version)
- **Weekly 60-second "sprint round"** (fixed format, single category, answer as
  many as you can). Presented to the child as just another round variant that
  counts toward medals like any round — never called a test. It replaces one
  normal round that day, so it costs no extra time.
- Convert to correct-facts/min → **SS = 100 + 15z** against Westwood One Minute
  norms interpolated by age in months (multiplication age 10: mean 13/min,
  age 11: 17/min, SD ≈ 5.9). Store DOB in profile. Clamp 60–140.
- Display as a **band** ("96–108"), median of 3 probes, labelled "fluency index
  (home proxy — not a school standardised score)". Suppress until 3 probes exist.
- Caveats displayed: 1995 Australian written norms, typed mode, practice inflation.
  Record the kids' real annual GL PTM score beside it as ground truth.

### Growth slope (the real "is it working?" signal)
- Weekly median correct-facts/min on mixed rounds, fitted 6–8-week slope.
- Green ≥ ~0.25–0.4 typed facts/min/week; amber if flat 4+ weeks on a non-mastered
  theme → scheduler shifts + parent flag. Slope marked provisional until 6+ weekly
  points. A plateau at mastery = success, rotate to maintenance.
- **Dashboard warning shown at launch**: interleaving will *lower* scores for the
  first weeks (desirable difficulty). Judge at weeks 4–10, 30+ sessions. Habit
  formation median ~66 days.

### MTC probe (real national percentile)
Once per half-term, parent-triggered: 25 questions, tables 2–12, 6s window
(median of 2–3 administrations). Convert via DfE's open distribution (2024: mean
20.6/25, 34% full marks). Displayed caveat: norms are Year 4 (age 8–9) — for these
kids it's a floor; target is consistent 25/25.

### Struggle flags ("Child X is struggling with theme Z")
Theme = a times table (computed bottom-up from facts) or an add/sub fact family
from the §2 ladder.

| State | Trigger | Visibility |
|---|---|---|
| Watching | early weak signal (first 3–5 attempts poor) | dashboard only |
| Flagged | ≥20–30 attempts AND deficit vs child's own same-week baseline (theme−overall accuracy; theme÷overall median RT — differencing cancels global bad days) AND persists ≥3 sessions on ≥3 days | daily email |
| Resolved | ≥60–70% of theme facts fluent, or not re-confirmed in 2 weeks | email notes clearance |

- **Problem-size guard**: 6×7/7×8/8×9 are always slower than 2s/5s — judge against
  the child's own comparable-fact baseline, never a global threshold.
- Slow-but-correct during learning is healthy — flag only "no RT improvement over
  2 weeks of regular play".
- Absolute backstop: theme "on track" needs ~30–40 dcpm equivalent + ≥90% accuracy
  (stops relative logic passing a uniformly-slow child).
- Error tagging (drives flag type): answer in either operand's table = table
  confusion (log which neighbour); ±1/2 = counting slip; equals a+b = operation
  confusion; same wrong answer twice+ = bug; other = weak/absent fact.

### Daily email (to patrick.magee@lumen-electronics.com) — DEFERRED
Deferred at parent's request (2026-07-02): the parent layer ships dashboard-only
first; this digest + its cron Worker are a later addition (provider TBD).
One short digest: streaks/medals/easy-day log per child + any flag lines.
Observations with counts, never diagnoses:
> Eliza — 7s table (7×6, 7×8, 7×9): 68% correct vs 91% on her other tables, about
> 2× slower, over 42 attempts in 10 days. Most misses were 8s/9s answers — mixing
> neighbours. Worth 10 minutes tonight (script below).

Flag emails attach the matching playbook script (§5).
Plumbing: Cloudflare Worker with a cron trigger (free tier; Pages Functions can't
cron) + a transactional email API (provider TBD — MailChannels' free Workers tier
is discontinued; Resend or Brevo free tiers fit), reading the same KV.

---

## 4. Big-Goal Campaign (skateboard bar) — rare overlay, not the economy

Run **1–2× per year max**, ideally as a rescue tool when a child's play frequency
drops below their own norm. Core medals/streaks stay symbolic and unconvertible.

- **Parent UI**: pick a reward menu (no money/screen time; kit/activity good) + a
  target date **3–4 weeks out (hard cap 6)**. Child picks the prize from the menu
  and agrees the target. **No free-text points box** — the app prices it:
  `target = mean(points/play-day, trailing 14–21d) × planned play-days × 1.15`
- Points: 10 per completed round (same §2 round-validity rule as medals), +3
  silver day, +5 gold day, small personal-best bonuses. No speed/score bonuses.
  Points never decrease.
- Bar mechanics: pre-fill 10–15% as honest credit for last week's real play;
  milestones every 20–25% with symbolic celebration; instant point animation at
  round end; dynamic caption (to-date below 50%, to-go above); "at this pace: ~12
  days" projection. Daily floor must visibly move the bar ≥2–3%.
- **Private per child**: bar visible only on that child's logged-in screen.
  Different prizes, separately computed targets — equal effort = equal fill rate.
  Neither child structurally finishes first.
- **Exit plan built before launch**: completion → celebration framed on the skill
  ("you earned this by getting fast at your 7s") → 2–4 week mandatory no-goal
  cooldown → medals-only steady state. Never chain into a bigger prize; wizard
  warns if a new prize implies a bigger target than the last (inflation check).
- If pace projection blows the cap, the app tells the **parent** to lower the
  target — never exhorts the child.

---

## 5. Parent Playbook (emailed with flags; scripts are literal)

Constraints from evidence: scripted parent tutoring works (ES ~0.55); unstructured
help can backfire (math-anxious parent effect). Hence: script, imperative voice,
**10-minute hard cap**, explicit exit rule, app re-verifies by re-measuring the
theme (never trusts the session happened).

- **Flag type 1 — inaccurate facts**: incremental-rehearsal flashcards, app
  auto-fills the deck (1 unknown folded into up to 9 of the child's own solid
  facts), strategy line said once first, 2s-hesitation → model-and-repeat, stop at
  10 min / 3 misses on same fact / any tension, end on a success.
- **Flag type 2 — accurate but slow**: no teaching — paced flashcard race at ~2s
  beat, 5 min max; mostly "keep the daily rounds going, speed comes from volume".
  Only escalates to a session if stagnant ≥2 weeks.
- **Flag type 3 — conceptual bug** (operation confusion, repeated identical wrong
  answer): the one case where explanation belongs — counters/drawn arrays, one
  model, no worksheet; app automatically drops those facts back to untimed phase.
- Dosage: 5–10 min, 2–3 evenings/week until the app's own data clears the flag.
  CCC (look-cover-write-compare) sheets auto-attached as the no-parent-available
  fallback.

**Canonical strategy lines** (hard-coded, shared verbatim between end-of-round cue
and parent email): 9s "10× it minus one of it" · 8s "double double double" ·
7s "5s fact + 2s fact" (anchor 7×7=49) · 6s "5s fact + one more".

---

## 6. Build Order

| Phase | Scope | Blocking? |
|---|---|---|
| **1. Engine** | Per-item logging (`fact_id`, `initiation_ms`, `typing_ms`, `round_type`) through localdb + `/api/scores` + KV; RT-cleaning classifier; typing-baseline game; fact-state model; add/sub family ladder; scheduler (focus/review/mixed, daily caps); nightly adaptation function (off-day guard, EMA, promote/demote); disguised placement sweep | Yes — everything depends on it |
| **2. Child loop** | Daily 3-round flow, streak (shield/repair/bounce-back), medals + silent validity check, goal reveal + attainability gate, easy days, stop/lock states, break prompts, in-round feedback + recap | After 1 |
| **3. Parent layer** | Admin dashboard: fluency index, growth slope, flags, MTC probe mode, playbook content; daily-email Worker (cron + email API) | After 1, parallel with 2 |
| **4. Big-goal campaign** | Wizard, pricing, bar, cooldown logic | Last; optional first term |

This is a full site rewrite — architecture, screen inventory, module map, KV
schema, and build steps live in **`docs/REWRITE.md`**. Concepts that carry over
from v4: local-first IndexedDB + KV merge pattern, Cloudflare Pages + KV hosting.
`QUESTIONS_PER_GAME = 10` unchanged.

### Evidence-thin items (explicit judgement calls, instrument & review per child)
Easy days (analogical only) · stop-message motivational bounce · peak-end victory
lap · fatigue RT threshold · big-goal stretch factor 1.15 · strategy-line scripts ·
parent-session efficacy at ages 10–11.
