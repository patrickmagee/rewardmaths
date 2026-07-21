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
  initiation_ms: 1840,   // question render → first keypress (THE measure)
  typing_ms: 950,        // first keypress → submit (motor; diagnostics only)
  round_type: "focus" | "review" | "mixed" | "sprint" | "placement" | "mtc" | "free",
  ts: <ISO> }
```
Only initiation latency is diagnostic. Median per fact, never mean. Commuted pairs
(7×8 / 8×7) stored separately, **pooled for flagging**. Since 2026-07-20 `typing_ms`
is recorded but plays **no part in classification** — see "Speed cutoff" below.

### RT cleaning (pure function at write time; classifies, never mutates raw data)
Every answer gets `{counts_for_accuracy, counts_for_rt, exclusion_reason}`.
Constants fixed a priori in `js/config.js` — never re-tuned after seeing a child's
data. Ordered rules, first match wins:

1. **Auto-advance at 40s** (question times out — prevention beats cleaning).
   On a **settled** fact (FLUENT/SLOW): attention lapse — excluded from both
   accuracy and RT (kids are on-task far less than adults; a 60s answer on a
   normally-2s fact is distraction, not forgetting). On UNKNOWN/STUCK **or
   UNSETTLED**: counts as wrong (real negative evidence).
   **UNSETTLED takes the evidence branch, corrected 2026-07-20**: it was briefly
   grouped with FLUENT/SLOW on the reasoning that only a *speed* verdict was
   pending. That made UNSETTLED an **absorbing state**. A forgiven timeout is not
   appended to the fact record (`appendAttempt` returns early on non-evidence),
   so the record could never grow the history needed to re-judge it, while
   `weakTargets` remediates UNKNOWN/STUCK only. Measured through the real fold: a
   fact answered correctly twice on day 1, then timed out 33 times over 11 days,
   stayed at `attempts=2, state=UNSETTLED` — never re-practised, and invisible to
   the parent (flags filter on `counts_for_accuracy`, and the fact map read "too
   few attempts to judge yet" after 33 failures). Forgiveness must be *earned*:
   only FLUENT/SLOW carry the demonstration that the child can retrieve the fact.
   This does not reintroduce spurious amber. A forced-wrong timeout usually
   sends a thin-history fact to UNKNOWN; it **can** land on SLOW at the 5th
   attempt (4 corrects over 2 days then a timeout → accuracy 4/5 = 0.80 clears
   the UNKNOWN gate but misses the FLUENT bar, so it falls through to SLOW —
   claim corrected in the `classify.js` comment 2026-07-21, verified against
   `states.factState`). That is benign: post-decouple SLOW drives no scheduling,
   so it earns the child no extra drilling, and the fact self-heals to
   FLUENT/UNSETTLED on the next within-ceiling correct. `ACCURATE_STATES` still
   includes UNSETTLED for the ladder mastery gate, where counting
   accurate-but-young facts is right.
   Untimed rounds (placement, blocked warm-up, shaky-family focus) never arm the
   clock, so nothing auto-advances and no answer there can be a timeout.
   **Parent-tunable per child** (dashboard → Settings → question timeout), 6–60s,
   default 40s. This is an *accessibility* dial for a child who needs longer to
   answer, not a knob for tuning the engine to a child's data — the bands in
   rules 2–6 are unchanged by it.
   **Immutability corrected 2026-07-21 — trust the play-time flag, never
   re-ceiling at derive.** Rule 1 now fires on the `timeout` flag the round
   screen stamped **alone** (`session.js` sets it iff the auto-advance timer
   actually fired); it no longer re-imposes `total >= ceiling_ms` at derive time.
   The old derive-time arm forged timeouts on untimed rounds — a slow-but-correct
   answer on a placement/warm-up round (real case: Eliza's 6×8, 40.8s initiation,
   correct, untimed) was flipped to forced-wrong, shown to the parent as "not
   secure" and requeued for re-teach. Because a *timed* round stamps
   `timeout:true` the instant it advances, a `timeout:false` record over the
   ceiling can only be an untimed round, so the arm was redundant for timed play
   and wrong for untimed. `ceiling_ms` is still stamped on every answer for the
   dashboard/audit but is now purely informational; the flag is fixed at write
   time, so changing the setting can never reclassify already-logged attempts
   (which would otherwise have retro-rewritten fact states and medals through the
   derive fold). Session records now also carry `untimed` (a durable marker that
   the round never armed the clock — recorded for future consumers, not read by
   `classify.js`, which legacy records lack). **Legacy 12-second-ceiling
   timeouts** (`timeout:true`, no `ceiling_ms`, `given:null` — e.g. all of
   Eliza's 32) predate untimed rounds, carry their own flag, and **remain
   negative evidence by owner decision (2026-07-21)**: this change touches only
   the derive-time re-ceiling of `timeout:false` answers, never a played
   timeout.
2. **Anticipation floor**: initiation <300ms → full discard, doesn't consume the
   fact's 3-per-day retrieval budget.
3. **Rapid guess**: wrong AND initiation <500ms → non-evidence (disengagement
   counter, not knowledge). Mashing can never drive a fact into STUCK.
4. **Lapse-suspect**: correct but >3× that fact's median (once ≥3 valid attempts)
   → counts for accuracy, excluded from RT. A single slow-correct never demotes
   FLUENT; only **≥3** of last 5 valid attempts over the speed cutoff →
   FLUENT→SLOW (`STATES.DEMOTE_SLOW_OF_5`, was 2, changed 2026-07-20). 3-of-5
   is not a loosening so much as a symmetry fix: "≥3 of 5 over cutoff" IS
   "the median of the last 5 is over cutoff" — the same statistic promotion
   uses (median of last 10 under cutoff), on a shorter window. At 2-of-5,
   demotion ran on a strictly weaker standard than promotion, so a fact could
   satisfy both at once and oscillate; on a right-skewed RT distribution a
   genuinely fluent fact tripped it on roughly a coin flip per window.
5. **Valid band** — anything reaching this rule → full evidence, raw ms. The band
   is bounded below by rule 2's floor and above by rule 1's ceiling; for *correct*
   answers rule 4 also caps it at 3× the fact's median. `RT.VALID_MEDIAN_MULT`
   (4×) is defined in config but **not read by any code** — the originally
   specified 4×-median upper bound was never implemented, so a slow *wrong*
   answer under the ceiling is full evidence however far past the median it sits
   (which is rule 6's intent anyway).
6. **Wrong-and-slow** → full negative evidence (effortful error = real signal).

Asymmetry is deliberate: fast-wrong ignored, slow-correct accuracy-only,
slow-wrong counted. Session voided for state updates if ≥3 **disengagement**
exclusions in a round or >20% in a session (feeds the off-day guard).
**Disengagement means anticipations and rapid guesses only** — a child who is
merely slow must never have their work discarded. Timeouts are *evidence*
(rule 1: on an UNKNOWN/STUCK fact a timeout is what keeps it there) and
lapse-suspects are evidence too, so neither counts toward voiding. Voiding on
timeouts silently deleted a real session (Eliza, 2026-07-19: 5 rounds, 42
answers, zero fast answers) and reported it to the parent as "rapid guessing".
Excluded trials stay in the log
with reasons (auditable, re-runnable). Admin alarm if a child's weekly
**disengagement** rate exceeds ~10–15% — scope narrowed 2026-07-21 to genuine
disengagement (anticipations + rapid guesses only); see §3. Floors and bands
apply to **initiation**.

### Typing baseline
30-second "type the number you see" mini-game per child, re-run quarterly.
**Changed 2026-07-20**: the baseline is now a *diagnostic* only (dashboard,
`STATES.DEFAULT_TYPING_MS` as the pre-measurement placeholder). It is no longer
subtracted from anything, because nothing classified is a total time any more.
Its original purpose — stopping Eliza's typing speed reading as a maths deficit —
is served more completely by not measuring typing at all. (The old `typingOf()`
helper in `derive.js` was also *wrong*: it took a median across input methods,
blending on-screen keypad taps with physical-keyboard presses.)

### Speed cutoff (changed 2026-07-20 — initiation only)
Speed is judged on **`initiation_ms` alone** (question shown → first keypress).
Typing time is excluded from classification entirely.

**Why.** Typing time scales with the number of digits in the answer, and digit
count is confounded with problem size. Measured on Tom's real 471-answer log:
median total RT on times tables 2444ms, median initiation 1756ms, and typing by
answer length 1-digit 130ms · 2-digit 652ms · 3-digit 1113ms. A threshold on
*total* time therefore penalises large facts twice — once for being genuinely
harder to retrieve, once for having a longer answer to type — and paints the
top-right of the multiplication grid amber regardless of the child.

**The 2500ms floor** (`STATES.FLUENT_CUTOFF_FLOOR_NET_MS`, was 2000ms net + a
typing baseline ≈ 2750ms total). Anchored on measured fluent latency for this
age with minimal motor output:

| Source | Method / sample | Finding |
|---|---|---|
| Van Beek, Ghesquière, Lagae & De Smedt 2014 | voice key, mean age 11.9 | large additions 1707ms (±415) |
| Dickson, Grenier, Obinyan & Wicha 2022 | gamepad, grades 3–5 | large multiplications 1438ms (SE 62); **problem-size effect 317ms** |
| Iancu et al., CogSci 2024 | tablet, typed | fluent typed *total* 2.238s |
| npj Science of Learning 2025, n=824 | tablet | defines RT as time to **first button press**, not submit — the one age-matched tablet study, and the precedent we follow |
| Wu et al. 2008 | experimenter manual keypress, mean age 8.05 | ROC optimum 3662.5ms — inflated by both method and younger sample |
| Commercial anchors | — | Prodigy Grade 6+ 3s · TTRS Rock Star 3s · DfE MTC 6s (Year 4, pass/fail) |

1707 and 1438 × ~1.5 lands at ~2.2–2.6s; 2500ms sits inside the age-matched
commercial band and below Wu's inflated optimum. Fixed a priori, not fitted.

**Problem-size allowance**: facts with both operands ≥6
(`STATES.LARGE_FACT_MIN_OPERAND`) get **+300ms** on their cutoff
(`STATES.LARGE_FACT_ALLOWANCE_MS`), from Dickson et al.'s measured 317ms
problem-size effect. Large facts are slower *even when retrieved*; this
formalises the §3 problem-size guard at the fact-state level instead of leaving
it to the parent-flag layer.

**Personal multiplier stays at 1.5** (`STATES.FLUENT_CUTOFF_MULT`). The floor
above is derived as *published fluent median × ~1.5*; the personal term is
*this child's fluent median × 1.5*. One multiplier, one meaning — a cutoff is
always "1.5 × a fluent median", and only the median changes.

A raise to 2.0 shipped and was reverted the same day (2026-07-20). The cutoff
is **self-referential** — the fluent set is defined by the cutoff — so its fixed
point is ≈MULT × the child's own median, and the multiplier decides what
fraction of a child's own distribution passes. At the fixed point:

| child median initiation | MULT 2.0 → cutoff (% passing) | MULT 1.5 → cutoff (% passing) |
|---|---|---|
| 1100ms | 2500ms (96%) | 2500ms (96%) |
| 1800ms | 3433ms (92%) | 2500ms (77%) |
| 2900ms | 5531ms (92%) | 3316ms (61%) |
| 4200ms | 8011ms (92%) | 4803ms (61%) |

At 2.0 the pass rate is ~92% for **every** child however slow: the criterion
stops discriminating and merely ratifies whatever the child already does, which
is not a fluency threshold at all. At 1.5 it degrades with slowness, which is
the entire purpose of having one. 2.0 also carried Tom's own large-fact cutoff
to 3812ms — past Wu et al. 2008's 3662.5ms ROC optimum that this section
explicitly argues we must stay below — so it contradicted its own sourcing
rather than trading against it. Guarded by literal assertions in
`tests/states.test.js`.

**Direction of risk — stated, not hidden.** The remaining 2026-07-20 changes
loosen the criterion (floor 2000→2500ms, demotion 2-of-5→3-of-5, plus
the large-fact allowance and the removal of typing time). Wu et al. 2008 at its
ROC optimum achieved only **78.7% sensitivity / 72.1% specificity**, i.e.
over-crediting fluency was already the larger failure mode of any RT criterion
of this kind. So these changes move *with* the pre-existing bias, not against
it. Accepted deliberately: the failure they fix (a near-all-amber fact map that
tells the parent nothing and drags genuinely-fine facts into focus rounds) was
concrete and observed, whereas the cost — a fact credited FLUENT slightly early
— is self-correcting, since review rounds keep resampling it and ≥3 of 5 over
cutoff demotes it. Revisit at 4–6 weeks against each child's own distribution.

**Caveat — fluency criterion, not strategy classifier.** For **addition** a fast
answer is not proof of retrieval: Thevenot, Barrouillet, Uittenhove & Castel
(2016) found 10-year-olds solve even 2+3 procedurally, by fast automated
counting. The add/sub cutoff should therefore be read as "fast enough to not be
a bottleneck", never as "retrieved from memory". For **multiplication** the
retrieval framing is safe — tables are retrieval-dominant from Grade 3
(Koshmider & Ashcraft 1991).

### Fact states (rolling last 5 valid attempts across ≥2 days; last-10 for fluency)
| State | Rule |
|---|---|
| FLUENT | 9 of last 10 correct AND **median initiation** under the personal speed cutoff = max(2500ms, 1.5× that child's own median initiation on fluent facts) + 300ms if a large fact; demotes to SLOW only on ≥3 of last 5 over the cutoff |
| SLOW | ≥80% correct in window, enough history to judge, but median initiation over the cutoff — counting/deriving. **Diagnostic only: shown to the parent, never scheduled on** (see Scheduler, 2026-07-20) |
| UNSETTLED | ≥80% correct, but **not yet enough history to judge speed** — <5 valid attempts, or attempts spanning <2 distinct days. Answering it right; verdict pending |
| UNKNOWN | <80% recent accuracy, timeout-dominated, or never seen |
| STUCK | ≥10 attempts without 3-in-a-row correct, or <60% over last 10 → feeds parent flag |

**UNSETTLED added 2026-07-20.** Previously the insufficient-evidence branch fell
through to SLOW, which was simply wrong: SLOW asserts a speed verdict the data
could not support. It was also the dominant cause of the near-all-amber fact map
the parent dashboard was showing. On Tom's log, 79 facts were SLOW under the old
rules — **76 of them the insufficient-evidence branch, only 3 genuinely
median-over-cutoff**. Under the new rules the same log gives 18 FLUENT · 0 SLOW ·
85 UNSETTLED · 23 UNKNOWN. Related: `RT.MIN_ATTEMPTS_FOR_BANDS` 3→5, since a
per-fact median over 3 attempts is close to noise given the right skew of
single-trial RT (Geary 2012: M=2789ms, SD=1892).

`ACCURATE_STATES` = {FLUENT, SLOW, UNSETTLED} — the set that counts as "the
child is getting this right", used by the family mastery gate. UNSETTLED is
**not** a weakness: `weakTargets` deliberately excludes it (an unjudged fact is
not evidence of a problem), while the mixed round *does* include it at
`SCHEDULER.UNSETTLED_WEIGHT` 1.5, because the way an unsettled fact settles is
by being seen again.

**Parent decision, 2026-07-20 — speed is a *reading*, not an instruction.**
None of the three accurate states buys a fact extra repetitions any more. SLOW
and FLUENT are scheduled identically; only UNKNOWN/STUCK (the child is getting
it *wrong*) drive remediation. Rationale, verbatim: *"it's training, not a
test"* — a child must never be drilled harder for thinking slowly. This is why
the whole of §3's flag layer keys on the weak states rather than on latency, and
why the only remaining speed term anywhere in scheduling is `UNSETTLED_WEIGHT`,
which is a request for more data, not a verdict on the child.

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

**Speed does not influence what a child is served (parent decision, 2026-07-20).**
In the parent's words: *"it's training, not a test."* A fact the child answers
correctly is a fact the child knows, whether they recalled it or worked it out,
and being slow must never earn extra drilling. Concretely:

- `weakTargets()` (focus rounds) means **the child is getting it wrong** —
  UNKNOWN or STUCK only. SLOW is gone from it, and UNSETTLED was never eligible.
- `mixedRound()` weights SLOW at 1×, identical to FLUENT. The old 2.5× boost was
  `SCHEDULER.SLOW_WEIGHT`; it is now `SCHEDULER.STALE_WEIGHT` and applies **only**
  to facts unseen for `FACT_STALE_DAYS`. Staleness is still a reason to
  resurface a fact; slowness is not.
- SLOW is still derived, still on the parent's fact map, and still feeds the
  struggle-flag playbook (`flagType` → "slow"). It simply has no vote in
  scheduling. Diagnosis and remediation are separated on purpose: a parent may
  want to know a child is counting rather than recalling; the child must not be
  punished with repetitions for it.

Round shapes:
- Focus round: 2–3 UNKNOWN/STUCK facts with highest error-weighted staleness, each
  repeated 2–3× within the round at increasing spacing, embedded ~80/20 in knowns.
- Review round: mastered table with oldest `last_seen`.
- Mixed round: samples all met categories at 1×, plus UNSETTLED facts at
  `SCHEDULER.UNSETTLED_WEIGHT` 1.5 (since 2026-07-20) and stale facts at
  `SCHEDULER.STALE_WEIGHT` 2.5. The UNSETTLED boost is **not** a speed judgement —
  extra exposure is exactly what resolves an unsettled fact into a verdict.
  Focus-round `weakTargets` excludes UNSETTLED: unjudged ≠ weak.
- Blocked (single-table) rounds only briefly when introducing a new weak table,
  until 80–90% accuracy — then it joins mixed (interleaving hurts novices).
- Warm-up blocked rounds share the focus slot **day-about** with the true focus
  round (2026-07-12): the ladder frontier lives in warm-up for weeks at a time,
  and letting it monopolise the slot starves times-table weak-fact work —
  simulation showed the weak-7s struggle flag never firing without this.
  **Rotation fix 2026-07-21**: the day-of-month parity gates *entry* to the slot
  (day-about), but the warm-up family *index* now rotates independently
  (`floor(dom/2) % wu.length`, was `dom % wu.length`). Reusing `dom` for both
  pinned a 2-element list to `wu[0]` forever — the slot opens only on even days,
  and every even day indexed `wu[0]`, so `wu[1]` never ran.
- `workingTable()` (the "next table to work on", which also drives the
  child-facing "today" copy) counts a fact as done if it is in `ACCURATE_STATES`
  (FLUENT/SLOW/UNSETTLED), not FLUENT-only (changed 2026-07-21). Counting FLUENT
  only meant a table full of settled-but-not-yet-fluent facts never cleared the
  70% bar, pinning every child on table 2 — same speed-shouldn't-gate-progression
  principle as the ladder mastery gate and the decouple above.
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
  circulating facts in `ACCURATE_STATES` (FLUENT/SLOW/UNSETTLED — updated
  2026-07-20; the gate has always been about accuracy, and UNSETTLED facts are
  accurate) AND sustained ≥2 sessions on ≥2 days. (Direct
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

- **Off-day guard runs first**: if today's median **initiation** on the child's
  own FLUENT facts >1.5× their trailing 14-day median initiation, or FLUENT
  accuracy <70%, or the session-void rule fired → session flagged; mix eases
  live, **nothing is written** to states or averages. (A bad day depresses
  everything at once; real forgetting is fact-specific.) Implementation note
  2026-07-12: "nothing" now includes per-fact records — the derive fold rolls
  back a flagged day's fact updates (previously bad-day attempts leaked into
  fact windows, knocking facts out of FLUENT and stalling family promotion for
  weeks after). **Initiation-based since 2026-07-21**: the speed arm still read
  *total* RT after the state machine moved to initiation (§2 speed cutoff), so a
  keyboard→tablet switch stepped the total median up and fired a spurious
  off-day — which self-latched, because the baseline series is appended only on
  non-off days and froze at the last fast-regime day. It now medians
  `initiation_ms` on FLUENT facts, mirroring `states.js`; the accuracy arm is
  unchanged (`fluentRtByDay` entries now store `medianInit`).
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
- **Declining trends read amber, not green (2026-07-21)**: `growthSlope`
  special-cased only *flat*, so a genuinely falling slope — being "not flat" —
  fell through to green. A negative slope below the green threshold now returns
  amber. Green is reserved for genuinely rising trends: this is the dashboard's
  single "is it working?" signal.
- **Dashboard warning shown at launch**: interleaving will *lower* scores for the
  first weeks (desirable difficulty). Judge at weeks 4–10, 30+ sessions. Habit
  formation median ~66 days.

### MTC probe (real national percentile)
Once per half-term, parent-triggered: 25 questions, tables 2–12, 6s window
(median of 2–3 administrations). Convert via DfE's open distribution (2024: mean
20.6/25, 34% full marks). Displayed caveat: norms are Year 4 (age 8–9) — for these
kids it's a floor; target is consistent 25/25.

### Disengagement-rate alarm (scope narrowed 2026-07-21)
The dashboard raises an alarm when >~10–15% of a child's recent answers are
genuine **disengagement** — anticipations (<300ms) and rapid guesses
(wrong, <500ms), i.e. the child mashing. It no longer counts timeouts or
lapse-suspects: since b5a51a5 a timeout on a non-settled fact is *counted*
negative evidence (`counts_for_accuracy:true`), not discarded, and
lapse-suspects are counted too, so folding either into a "discarded" alarm both
double-punished a slow child and misreported the cause. `admin.js` mirrors the
classifier's disengaged set (`{anticipation, rapid_guess}`), and the alarm copy
now reads "very fast guesses or mashing (not counted)" rather than
"mashing/timeouts".

### Struggle flags ("Child X is struggling with theme Z")
Theme = a times table (computed bottom-up from facts) or an add/sub fact family
from the §2 ladder.

| State | Trigger | Visibility |
|---|---|---|
| Watching | early weak signal (first 3–5 attempts poor) | dashboard only |
| Flagged | **structural**: ≥3 of the theme's facts durably weak, ≥80% of the theme durably weak, and that share ≥0.15 above the child's own baseline — **corroborated** by a live window deficit vs the child's same-week baseline (theme−overall accuracy; theme÷overall **median initiation** — differencing cancels global bad days) over ≥`MIN_ATTEMPTS_WATCHING` attempts on ≥3 days | daily email |
| Resolved | ≥60–70% of theme facts fluent, or not re-confirmed in 2 weeks | email notes clearance |

#### Escalation is structural, not volumetric (changed 2026-07-20)

Earlier the same day, `FLAGS.MIN_ATTEMPTS` (24 attempts of evidence) was
softened from window-only to window-**or**-cumulative. That was the right
diagnosis and an insufficient fix. The defect is not *which window* the
attempts are counted over — it is that **any** count of attempts is chosen by
the scheduler, and the scheduler serves weak themes less:

- UNKNOWN facts are excluded from mixed rounds entirely and rationed to
  `FOCUS_WEAK_FACTS` per focus round; review rounds draw only from mastered
  material.
- Measured over 45 simulated days: a weak theme's facts carry **4.1** attempts
  each against a healthy theme's **10.0**. Only 23% of the weak child's table-7
  facts cleared the 5-attempt "measured" bar, against 65% for the steady twin —
  so the corroboration test typically ran on a denominator of one or two facts.
- The cumulative path did not rescue it: cumulative weak attempts plateaued at a
  median of 15 against a bar of 24, clearing in only ~15% of post-placement
  evaluations. Sensitivity measured **64.8%** [59.9–69.4], n=392 paired seeds.

This is the *same defect class* as the UNSETTLED bug, one layer up: a
quantity-of-evidence threshold that is anti-correlated with the thing it gates
on. The fix is to stop gating on quantity at all.

**The escalation test is now inverted.** The per-fact state distribution decides
whether a theme is weak; the trailing window only corroborates that the problem
is live and currently visible.

1. **Durably weak, per fact.** A fact votes only if it is UNKNOWN/STUCK **and**
   the child has failed it on ≥`MIN_DAYS` (3) distinct days spanning
   ≥`DURABLE_MIN_SPAN_DAYS` (7) **calendar** days. Calendar time is the one
   field the scheduler cannot allocate — a fact cannot be made older by serving
   it more. This is also the guard against the opposite error, flagging a table
   the child met on Tuesday: measured span for a genuinely weak fact is 18–20
   days, for a newly-introduced one 2–5. Both terms are load-bearing (days alone
   passes a table drilled hard for three days; span alone passes a fact touched
   once in placement and once a month later). `DURABLE_MIN_SPAN_DAYS` is
   inherited from `MIN_FLAG_DAYS`: a fact must have been failing for at least as
   long as the flag it would raise is required to last.
2. **Near-total, per theme.** ≥`WEAK_FACT_SHARE` (**0.80**, raised from 0.50) of
   the theme's facts durably weak, and ≥`MIN_DURABLE_WEAK_FACTS` (3) of them.
   0.80 is `ADAPT.PROMOTE_FACTS_OK` read backwards — the ladder calls a family
   learned at 80% accurate facts, so a theme is failing at 80% durably-weak
   ones. A **simple majority does not work here**, and the reason is structural
   rather than empirical: every learner has a frontier, and a not-yet-taught
   table is by definition mostly unlearned, so "more weak than not" describes
   the curriculum edge as well as it describes a broken theme. Measured
   `durableShare`: weak table-7 p10 **0.82**, median 1.00; the steady twin's
   worst untaught table p90 **0.70**, median 0.60. The bar sits in that gap by
   derivation, and the measurement confirms it rather than choosing it. The
   3-fact floor is `MIN_DAYS` applied to facts instead of days: three failing
   facts, as the window demands three failing days. Two facts is a fact problem,
   not a theme problem, and "work on your 5s" is the wrong instruction for it.
3. **Relative to the child's own baseline.** The share must exceed the child's
   durable-weak share across comparable themes (tables vs tables, ladder
   families vs families) by ≥`WEAK_SHARE_DEFICIT` (0.15) — inherited from
   `ACCURACY_DEFICIT`, the same "this far below the child's own baseline"
   construct applied to the state distribution instead of to a fortnight's
   accuracy. Without it a child who is behind on everything gets a dashboard of
   solid amber, which tells a parent nothing.
4. **Corroboration.** The window must still show a real deficit on
   ≥`MIN_ATTEMPTS_WATCHING` attempts across ≥`MIN_DAYS` days. It no longer
   decides *whether* there is a problem, only that it is still live.

`FLAGS.MIN_ATTEMPTS` and `MIN_FACT_ATTEMPTS_FOR_EVIDENCE` are **deleted** —
every volume gate is gone from escalation by design.

Measured effect, 400 paired seeds (weak-7s persona vs identically-seeded steady
twin, 45 days each):

| | before (window+cumulative) | after (structural) |
|---|---|---|
| sensitivity (weak table-7 flagged) | 64.8% [59.9–69.4] | **88.0% [84.5–90.8]** |
| false table-7 on the steady twin | 0.0% | 0.5% |
| mean false flags / steady seed | 0.05 | 0.25 (bar 0.40) |
| newly-introduced-table false positives | 3 of 6 scenarios at **100%** | **0%** |

The specificity cost is real and is stated: 0.05 → 0.25 false flags per steady
run. It buys +23pt of sensitivity and eliminates the new-table false positive
the old implementation's own comment claimed to prevent and did not. Residual
false flags are concentrated in small ladder families (4–5 facts), where the
3-fact floor is a weak denominator guard; revisit if a real dashboard shows it.

**Known limits, unchanged.** `FLAGS.MIN_DAYS` counts days the theme was
*played*, not days the deficit *persisted*, and the temporal machinery
(`prevFlags`, expiry, `MIN_FLAG_DAYS`) is still unreachable while both call
sites pass `{}` — a real persistence test needs rolling evaluation and is not
yet built. The structural criterion also makes the parent-facing alarm depend
primarily on the derived fact-state *cache* rather than directly on the log, so
a change to the state machine's thresholds now moves the flag layer too. That is
an accepted coupling, not an oversight: the states are themselves a pure fold of
the log, and no stored state was added (`spanDays` is computed from the existing
capped `attempts` array).

**Speed is judged on initiation here too**, matching §2. The flag layer was left
on total RT when the state machine moved to initiation, so the fact map and the
parent-facing flag disagreed about what "slow" means, and typing time — which
scales with answer digit count — leaked into a theme-level comparison where
large-answer themes (the 12s) systematically carry more of it.

**How the flag checks are tested (changed 2026-07-20).** `tests/simulate.js`
asserted a *single seed's* flag outcome. That is not a valid test of this
system: `persona.rng` is shared between scheduler item-selection and answer
generation, so any change touching the round-building path — **including a pure
relabel that alters no semantics** — reshuffles every subsequent draw across 45
simulated days. The old assertions sat on a knife edge (the weak persona's
table-7 cleared `MIN_ATTEMPTS` by exactly zero margin), and a control that adds
one wasted `rng()` call and changes nothing else flips them both. They were
reading a coin flip, not the engine.

They are now **seed-averaged over paired runs** — the same seed played once with
a weak 7s table and once without, so the headline check is *discrimination*
between the two rather than a base rate.

**SEEDS 20 → 100 (2026-07-20). The 70% bar is unchanged, deliberately.** Seed
averaging alone did not make the gate meaningful: at n=20 the 95% CI on a rate
near 0.7 is roughly ±20pt, and measured over 392 seeds the engine that set the
70% bar had a *true* sensitivity of 70.2% — so it failed its own gate about 39%
of the time. Twenty-seed block rates ranged 50–85% on unchanged code. An
assertion that fails two runs in five trains people to re-run it, and a bar
lowered until it goes green guards nothing; the fix for an underpowered test is
sample size. At n=100 with measured sensitivity **88.0% [84.5–90.8]** (n=400),
the whole interval sits ~18pt clear of the bar and P(spurious failure) ≈ 1e-7.
Cost: ~30s.

Current margins: sensitivity 89% (bar 70%), false-positive rate 0% (bar 20%),
discrimination gap 89pt (bar 50pt), ≤1 flag in 97% of steady seeds (bar 60%),
false flags 0.24/seed (bar 0.40). Bars sit between measured regimes, not at
observed values.

The simulation also now logs `initiation_ms` on every synthetic answer. It did
not, so `flags.js` silently fell back to total RT and the mandatory pre-ship
gate was **not exercising** the initiation metric it was supposed to validate.

**Mutation results (2026-07-20)** — every new assertion verified to fail when
the behaviour it guards is reverted:

| mutation | assertion that failed |
|---|---|
| span gate removed (`spanDays` → always true) | a table introduced this week is not flagged |
| distinct-days gate removed | wide span but only two days does not flag |
| `WEAK_FACT_SHARE` gate removed | a half-failing theme is mid-acquisition, not a weak theme |
| `MIN_DURABLE_WEAK_FACTS` floor removed | a two-fact theme does not flag however weak |
| baseline-relative term removed | theme level with the child's own baseline does not flag |
| structural term dropped from escalation | window deficit on a fluent theme does not flag |
| window volume gate reintroduced (old 24) | starved-but-failing theme still flags |
| bare-state-map back-compat broken | bare state map still evaluates |
| evidence reports baseline as its own share | share stands out from the child's own baseline |
| `blockedRound` table branch reverted | scheduler test throws (the pre-existing crash) |
| flag forced always-off (`DURABLE_MIN_SPAN_DAYS` 60) | sim sensitivity 0% + discrimination, both fail |
| flag forced near-always-on (`WEAK_FACT_SHARE` 0.20) | sim false flags 1.02/seed, fails |

Still standing from earlier the same day: flag speed metric reverted to total
RT → typing-only unit test fails; `FLUENT_CUTOFF_MULT` restored to 2.0 → three
`states.test.js` assertions fail.

**Incidental fix, same day: a real crash.** `adapt.js` keys demotion evidence by
`familyOf()`, which returns `table-N` for multiplication, so a mastered times
table that collapses is pushed into `warmupFamilies` and reaches
`blockedRound()`. Table ids are not `familyFacts()` members, so it fell through
to the parametric sampler, which has no members for a table, and threw
`Cannot read properties of null` — a hard crash of round building **in the child
app**, hit by ~1 simulated run in 250 (4–6 of 400 on master). `blockedRound()`
now resolves `table-N` via `tableFacts()`, which is the behaviour a demotion
implies anyway: a broken table gets blocked warm-up rounds.

- **Problem-size guard**: 6×7/7×8/8×9 are always slower than 2s/5s — judge against
  the child's own comparable-fact baseline, never a global threshold. Since
  2026-07-20 the fact-state layer also carries its own +300ms large-fact
  allowance (§2), so this guard is a second line rather than the only one.
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
