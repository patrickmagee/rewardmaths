# Engine Rules: RT Cleaning, Add/Sub Ladder, Adaptation Metric

Synthesized from verified findings. Rules marked **[JC]** are judgement calls — convention-informed engineering choices within literature-supported ranges, not literature-mandated point values. Everything is implementable against the per-answer log `{fact_id, correct, initiation_ms, typing_ms, round_type, timestamp}` plus the already-decided per-fact state machine.

---

## 1. RT CLEANING RULES — per-answer pipeline

Implement as a single pure function, run once at write time, that classifies every answer without ever mutating raw data:

```js
classifyAnswer(answer, factStats, childStats) ->
  { counts_for_accuracy: bool, counts_for_rt: bool,
    exclusion_reason: 'anticipation'|'rapid_guess'|'timeout'|'lapse_suspect'|null }
```

All constants live in `js/config.js`, fixed **a priori** — never re-tuned after seeing a child's data (Vankov 2023: post-hoc flexibility in outlier handling is a researcher degree of freedom; on null data trying multiple methods can roughly triple false alarms and manufacture ~0.33 SD of spurious effect).

**Ordered rules (first match wins):**

1. **Timeout / hard ceiling — auto-advance at 12,000 ms.** Don't wait for a 60 s trial to exist; the question auto-advances at 12 s (cleaning by prevention, per Math Garden's 20 s deadline logic). Record `exclusion_reason='timeout'`. For an **UNKNOWN/STUCK** fact: counts as wrong (full negative evidence, `counts_for_accuracy=true`). For a **FLUENT/SLOW** fact: treated as a lapse — `counts_for_accuracy=false, counts_for_rt=false` (children 9–12 have heavier slow RT tails than adults; on a monotonous task they are genuinely on-task only ~47% of the time, so a very slow response on a normally-2 s fact is overwhelmingly a lapse, not forgetting).

2. **Anticipation floor — `initiation_ms < 300`** → invalid, full discard (`anticipation`, both booleans false). Does not count as a retrieval toward the 3-per-day cap. Basis: Whelan (2008) 100–200 ms anticipation cutoffs for *simple* button-press RT; arithmetic needs encoding (~300–500 ms) + retrieval (~400–900 ms in the automatized range), so 300 ms is a conservative lower bound. **[JC within 200–400 ms]**

3. **Rapid guess — `!correct && initiation_ms < 500`** → disengaged guess (`rapid_guess`, both booleans false), increment a per-session disengagement counter. Basis: Wise & Kong's response-time-effort framework — sub-threshold responses are non-solution behavior and say nothing about knowledge; score as missing, never as low ability. This protects Eliza especially: frustrated button-mashing must never drive facts into STUCK. **[JC within 400–600 ms]**

4. **Lapse-suspect — `correct && RT > 3 × fact_median`** (once the fact has ≥3 valid attempts; before that, only the 12 s ceiling applies) → `counts_for_accuracy=true, counts_for_rt=false` (`lapse_suspect`). A slow-correct is weak-memory evidence, never failure (ARTS/Anki logic): it does **not** demote a FLUENT fact unless the slowness repeats — **≥2 of the last 5 valid attempts** slower than the child's fluency cutoff → FLUENT→SLOW, schedule sooner.

5. **Valid band — everything else between floor and `min(12,000 ms, 4 × fact_median)`** → full evidence: `counts_for_accuracy=true, counts_for_rt=true`. The RT feeds the per-fact median (raw ms — **no log transforms**; medians are already robust and raw ms keeps the dashboard interpretable: "Tom answers 7×8 in 2.1 s").

6. **Wrong-and-slow (within/above band, not rapid)** → full negative evidence, `counts_for_accuracy=true`. An effortful error is real signal. This is the deliberate **asymmetry**: fast-wrong = ignored (disengagement), slow-correct = accuracy-only (weak strength), slow-wrong = counted (genuine not-knowing).

7. **Suspicious fast-correct** **[JC]**: a first-ever-presentation correct answer with total time (after typing-baseline subtraction) under ~700 ms is logged normally but requires a second fast-correct before crediting fluency.

**Session-level guard:** ≥3 excluded trials in a 10-question round, or >20% exclusions in a session → session is junk for state updates; end it gently, update nothing (feeds §3's bad-day guard). **[JC — the 5–15% "budget" is a Whelan recommendation, not an observed norm; real surveys find ~2% typical removal, so >20% is unambiguously pathological.]**

**Mechanics:**
- Floors apply to `initiation_ms`; the quarterly typing baseline is subtracted only from total-time comparisons, **never** from initiation.
- Per-fact **median-multiple bands, not SD bands** — a child has 5–20 attempts per fact and SDs are unstable at that n; this also sidesteps the unresolved MAD-vs-SD literature dispute (Leys 2013 vs Berger & Kiefer 2021), which mostly dissolves for a median-based engine.
- Keep every excluded trial raw in the log with its `exclusion_reason` — never delete or winsorize. This makes decisions auditable and lets you re-run improved rules over history.
- **Monitor exclusion rate** per child per week in the admin dashboard; if >~10–15% of answers are being discarded, the thresholds are wrong or the child is disengaged — surface it, don't silently widen cutoffs.
- After ~1,000 answers per child, sanity-check: floor should sit below the 1st percentile of correct FLUENT initiations, lapse band above the 95th. Revisit constants only from the child's own logged distributions (~4–6 weeks in).

**Honest caveat:** no published norms exist for typed multi-keystroke child arithmetic; the 300/500 ms floors are extrapolations from verification/oral paradigms and vendor mechanisms (Reflex, Math Facts Pro describe individualized cutoffs but publish no constants). The short 10-question round is itself your strongest lapse-prevention tool — keep rounds short rather than cleaning harder.

---

## 2. ADD/SUB DIFFICULTY LADDER

**Yes to the ZPD ramp.** The difficulty ordering is among the most replicated findings in cognitive arithmetic; the *strategy-family sequencing* is strong convention supported by instruction studies (Thornton 1978; Steinberg 1985; Baroody 2013–2016), **not** a directly RCT-tested scheduling policy **[flag: no study randomizes fact-introduction order holding practice constant]** — so treat family order as a prior the per-fact states can override.

### Empirical difficulty structure (verified)

| Effect | Data |
|---|---|
| **Problem-size** | RT/errors rise with operand size; Grade-1 slope ~410 ms per unit of min addend (counting on), adult ~20 ms (retrieval) — Groen & Parkman 1972; all four operations, Campbell & Xue 2001; child replication: small sums (≤10) 1129 ms / 3.1% errors vs large 1707 ms / 7.7% (Van Beek 2014) |
| **Ties/doubles** | Faster and more accurate than matched non-ties at every age (mechanism debated, effect undisputed); +0/+1/+2 learned as cheap rules (Baroody) |
| **Discontinuity at 10** | Subtraction shows a categorical "stair-step" jump at 11−n: retrieval self-reports fall 97%→67%, errors <5%→10–22%, heavy WM load under dual-task (Seyler, Kirk & Ashcraft 2003). Not just linearly bigger — categorically harder |
| **Frequency confound** | Small facts appear far more often in textbooks (Ashcraft & Christy 1995) — large facts are partly under-practiced, and respond to exposure |
| **Two-digit** | Carry/borrow cost is large, grows continuously with unit-digit sum, and children pay proportionally more (Deschuyteneer 2005; Klein 2010; Moeller 2011) |

### The ladder (addition families, in order)

1. +0 / +1 (count-on rules)
2. +2
3. Doubles to 5+5
4. Near-doubles (doubles ±1)
5. Make-10 pairs (sums to 10)
6. Big doubles 6+6…9+9
7. Bridge-through-10 sums 11–18, grouped by make-10 decomposition (e.g., 8+n family, 9+n family)
8. Leftover hard facts
9. Two-digit ± ones, no crossing (34+5)
10. Two-digit ± tens (34+20)
11. Two-digit ± ones crossing the decade (37+5)
12. Two-digit ± two-digit, no carry
13. With carry/borrow

Track `crosses_10` / `crosses_decade` as explicit fact features so struggle flags can distinguish a decade-crossing deficit from general slowness — and so the expected RT step at the bridge-10 boundary isn't misread as STUCK.

### Subtraction interleaving

Subtraction is reliably harder (largely reconstructed, not retrieved; subtraction-by-addition is efficient but not adopted spontaneously — must be taught). Rules:

- **Unlock each subtraction family only after its addition family is FLUENT** (e.g., 13−n unlocks when the make-10 additions for 13 are fluent).
- **Present new subtraction facts alongside their addition family member** (9+4=13 → 13−9, 13−4) so the retrieval route is the addition fact.
- **Calibrate speed cutoffs per operation, never pooled** — subtraction medians legitimately run slower than addition on the same numbers.

### Mastery gate to introduce the next family

Advance when **all** of:
- ≥85–90% accuracy on the current family's presented facts (family EMA ≥ 0.85, see §3),
- majority of the family's circulating facts individually FLUENT under the decided per-fact rule (9/10 + 1.5× own-median speed cutoff),
- sustained across ≥2 sessions on ≥2 days.

Basis: mastery-learning convention (80–90% band; Fuchs speeded-practice RCTs), and critically the **child** evidence: Jansen et al. 2013 RCT (n=207, success rates 0.6/0.75/0.9) found *higher* preset success → more problems attempted → larger gains. Your 80–90% known mix is on the right side of this. Cite Wilson et al. 2019's "85% rule" only as convergent ML heuristic, not evidence — and **do not force errors** if a child cruises at 92%; that's fine.

### Mix weighting (ZPD ramp)

- Round composition stays 80–90% known (already decided). Only the **current frontier family** feeds the 3–6 unknown-fact slots.
- Within the frontier family, order facts by a **hard-coded difficulty score** from the Math Garden-validated features (min operand, sum size, crosses-10, tie, ±1/±2 rule, borrow) — with two children you don't need Elo calibration; the child's own data reorders locally.
- Once a harder family unlocks, give its facts **at least equal** scheduling priority — deliberately counteract the textbook under-exposure of large facts instead of letting easy facts dominate forever.
- Blocked warm-up on a new family until 80–90% accuracy, then interleave (already decided).

### Placement for Tom and Eliza **[JC, medium confidence]**

Both are past the ladder's bottom. On first run, do a few mixed **placement sweep** rounds across all families, mark facts FLUENT/SLOW/UNKNOWN from data, and start each child's ramp at their **first non-fluent family** — likely bridge-10 addition / minuends 11–18 subtraction (the exact stair-step zone) and decade-crossing two-digit work; expect Eliza's frontier lower than Tom's. Don't burn the 3-retrievals/day budget on ceiling-level facts, and don't block the ladder on one STUCK early fact.

---

## 3. BALANCED ADAPTATION METRIC

**Core principle (converged across Math Garden's tiny Elo steps — base K=0.0075 per answer — BKT's slip parameter, and ALEKS's checkpoint-gated demotion): never let a single session move a mastery decision; accumulate small updates into a slow estimate, and make demotion structurally harder than promotion.**

Why one round proves nothing: a child truly at 85% accuracy produces 10-item rounds spanning ~6/10–10/10 by binomial sampling alone (SD ≈ 1.13); single math-CBM probes carry roughly 7–27% occasion/form error variance (up to ~50% for the weakest single-skill probes). And in BKT with canonical bounds, one error at P(mastery)=0.95 only drops the posterior to ≈0.73 — "probably a slip."

### The metric

Per fact family `f`, per child, per **calendar day** with ≥6 presented items from `f`:

```
P_day(f) = correct / presented          // classified answers only, off-day sessions excluded
M(f)     ← 0.75·M(f) + 0.25·P_day(f)    // EMA, α=0.25, applied ONCE per day, not per round
```

Initialize `M(f)` from the first two days' pooled raw accuracy (fast calibration, then small steps — mirrors Math Garden's K_start). α=0.25 gives a half-life of ~2–3 days: one catastrophic day (0% on a family usually at 90%) moves M from .90 to ~.68 — bruised, still above the demotion floor, recovered in 1–2 normal days. Day-level (not round-level) updating means a marathon bad evening cannot compound. **[α and bands are JC within supported ranges.]**

### Off-day guard (runs first, before anything writes)

Flag a session **off-day** if, on the child's own FLUENT facts:
- today's median RT > 1.5× their trailing 14-day FLUENT median, **or**
- accuracy < 70%,
- (or the §1 rule: >20% excluded trials / ≥3 exclusions in a round).

A bad day depresses *everything at once* (state: tiredness, mood — cf. Sievertsen 2016, ~2M Danish tests: −0.9% SD per hour later in the day); fact-specific forgetting doesn't. Global depression is diagnostic of state, not knowledge. Off-day sessions: **ease the live mix, write nothing** to M or fact states.

### Asymmetric transitions (hysteresis)

**PROMOTE** (add next family / graduate warm-up to interleaving) — fast:
- `M(f) ≥ 0.85` AND ≥2 distinct days of data AND ≥80% of the family's circulating facts at FLUENT/SLOW. Fires as soon as met — cheap to reverse silently. (Jansen 2013: erring easier is safe.)

**DEMOTE** (shrink family's share, resume blocked warm-up) — slow, evidence-gated:
- `M(f) < 0.70` AND raw `P_day(f) < 0.70` on **≥3 sessions spanning ≥3 distinct days**, at least one not flagged off-day. Same shape as the decided struggle flag. **One bad day can never demote; neither can two.** Optionally confirm with an ALEKS-style dedicated mini-check of that family on a fresh day before acting.

**WITHIN-SESSION controller** — aggressive downward only:
- After 2 consecutive misses or 3-of-last-5: raise known-fact share to ~95%, stop introducing UNKNOWNs for the rest of the session. **No stored-state writes.** Never make a session harder mid-stream; upward moves happen only between days, off the EMA.

### Visibility

**All adaptation is silent.** Children see only monotonic indicators: lifetime facts mastered, streaks, personal bests. No level numbers that can go down, no "demoted" messaging — when a family demotes internally, the child just quietly gets friendlier rounds. The parent/admin dashboard shows the true state machine plus every transition with its triggering evidence (dates, sessions, P_day values). **[Flag: visible-loss demotivation rests on the IXL SmartScore consumer backlash + games-DDA convention, not an RCT on children — but it's low-risk and consistent with Jansen 2013's perceived-competence finding.]**

### Implementation shape

Nightly pure function per child over the answer log: off-day flags → P_day → EMA → promote/demote transitions → transition audit log. Constants (0.85, 0.70, α=0.25, 6-item minimum, 1.5×, 70%, 3/3) in `js/config.js`. The design's robustness comes from its **structure** (day aggregation, multi-day gates, off-day exclusion, asymmetry, silence), which survives any reasonable parameter choice — ship defaults, log richly, revisit after ~4 weeks of real data.

### Worked examples

**"Eliza scores 4/10 on Tuesday after two normal weeks":**
1. Off-day check: if her FLUENT-fact accuracy that session was <70% or her FLUENT median RT >1.5× typical → session flagged, **nothing changes**; Tuesday's rounds just got easier live (mix shifted to ~95% known after her 2nd/3rd consecutive miss).
2. If the session was *not* globally depressed (misses concentrated on the frontier family): P_day(frontier)=0.40 → M drops .90→.78. Still above the .70 floor. No demotion (needs 3 sub-.70 sessions over 3 days). Wednesday at her usual 90% → M back to ~.81; recovered by Thursday. **Net effect of one rough day: nothing visible, nothing demoted.**
3. Any fast-wrong mashes (<500 ms initiation) never even entered P_day — they went to the disengagement counter, and 3+ of them would have voided the round entirely.

**"Tom answers 7×8 in 41 s (normally 2.1 s)":** auto-advance already fired at 12 s → `timeout`; 7×8 is FLUENT so it's an excluded lapse — no accuracy hit, no RT pollution, no state change. Only if 2 of his last 5 valid attempts on 7×8 breach his speed cutoff does it go FLUENT→SLOW and get scheduled sooner.

**"Tom hits M=0.86 on bridge-10 addition after 3 days, 85% of its facts FLUENT/SLOW":** next family (leftover hard facts / corresponding 1n−n subtraction if the addition family is fluent) unlocks immediately; he just starts seeing a few new facts in the 3–6 unknown slots. No announcement.

---

## 4. KEY NUMBERS

| Constant | Value | Basis | Status |
|---|---|---|---|
| Anticipation floor | initiation < 300 ms → discard | Whelan 2008 (100–200 ms simple RT) + encoding/retrieval decomposition | JC within 200–400 |
| Rapid-guess threshold | wrong ∧ initiation < 500 ms → non-evidence | Wise & Kong 2005 RTE framework | JC within 400–600 |
| Hard ceiling / auto-advance | 12,000 ms | Already decided; Math Garden 20 s deadline; PVT lapse literature | Decided |
| Lapse band | correct ∧ RT > 3× fact median → accuracy-only | Child slow-tail/lapse literature (tau; ~47% on-task on monotonous SART) | JC within 3–5× |
| Valid-band ceiling | min(12 s, 4× fact median) | Same | JC |
| FLUENT→SLOW demotion | ≥2 of last 5 slow, never 1 | BKT slip math (0.95→≈0.73 after one error, C&A max-bound params); ARTS strength logic | Supported |
| Session-void threshold | ≥3 exclusions/round or >20%/session | Typical real-world trim is ~2% (Vankov 2023); >20% = pathology | JC |
| Exclusion-rate alarm | >10–15%/week → dashboard | Ratcliff 1993 / Whelan recommendation | Supported |
| Grade-1 vs adult min-slope | 410 vs ~20 ms/unit | Groen & Parkman 1972 | Verified |
| Small vs large sums (children) | 1129 ms/3.1% vs 1707 ms/7.7% | Van Beek 2014 | Verified |
| Subtraction stair-step | at 11−n; retrieval 97%→67% | Seyler, Kirk & Ashcraft 2003 | Verified |
| Success-rate target | 85–90% (not 75%) | Jansen 2013 RCT: 0.9 > 0.75 > 0.6 for volume & gains | Verified |
| Family-advance gate | EMA ≥0.85 ∧ ≥2 days ∧ ≥80% facts FLUENT/SLOW | Mastery-learning 80–90% band; Fuchs RCTs | JC within band |
| EMA smoothing | α=0.25, once daily, ≥6 items | Pelánek time-decay; half-life ~2–3 days | JC within 0.2–0.3 |
| Demotion floor | M<0.70 ∧ raw<0.70 on ≥3 sessions/≥3 days | ALEKS checkpoint demotion; BKT slip; decided struggle flag | JC, structure supported |
| Off-day flag | FLUENT median RT >1.5× 14-day typical, or FLUENT acc <70% | Sievertsen 2016 (−0.9% SD/hr); CBM single-probe error 7–27% | JC, rationale verified |
| Within-session easing | 2 consecutive or 3-of-5 misses → ~95% known | Jansen 2013; Papoušek & Pelánek 2016 asymmetry | JC |
| 10-round binomial noise | SD ≈ 1.13 at p=.85 (6/10–10/10 spans ~99%) | Arithmetic | Verified |
| Math Garden Elo step | K=0.0075/answer (shape to copy: a failed round moves ≤20–30% of the promote–demote gap) | Klinkenberg 2011 | Verified |

**Corrections honored from verification:** the "5–15% trimming standard" is a recommendation, not the norm (actual ~2%; the 1,000–4,000 ms survey is Vankov 2023, not Berger & Kiefer); Vankov's 31%→86% is a power swing on effect-present data, not a null false-positive rate; the ~47% on-task figure is from a monotonous lab SART, not classrooms (~70% engaged in real educational tasks) — which is why the lapse ceiling is a per-fact relative band, not aggressive global trimming; BKT's 0.10/0.30 are fitted-parameter *ceilings* against degeneracy, so ≥2-errors-before-demotion is enforced structurally in the state machine rather than trusted to slip math; and single-probe unreliability is 1−r (7–27%), not 1−r².