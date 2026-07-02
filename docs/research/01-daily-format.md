# Evidence Synthesis: RewardMaths Format Recommendation

## 1. VERDICT ON PARENT'S FORMAT

**The format is validated. Ship it with refinements, not a redesign.** All five research strands converge: no evidence clearly demands a different format, and several features are directly supported by the strongest causal studies available.

**What survives as proposed:**

- **Daily streak minimum (feature 1)** — Strongly supported. Spaced short daily practice beats massed practice (Schutte et al. 2015, J. School Psychology: distributed 1-minute timings beat the same minutes back-to-back; Murray, Horner & Göbel 2025 meta: g = 0.28–0.43). Total accumulated sessions is the dosage moderator that matters — 30+ sessions significantly outperform <10 (Douglas et al. 2026, β = 1.83, p = .046) — and the streak is the delivery mechanism for that. The only experimental study of streaks in education (Aulagnon et al., NBER w34173, ~60,000 Peruvian grade 4–6 students) found streak-highlighting causally increased practice volume, with suggestive (not established) learning gains of 0.13–0.17 SD.
- **Effort-based bronze/silver/gold (feature 2)** — Supported. Input/effort incentives beat output/performance incentives in the child-incentive RCT literature (Fryer 2011 QJE; Hirshleifer's India experiment: 0.57 vs 0.24 SD), and performance-contingent rewards carry the clearest motivational costs for children (Deci, Koestner & Ryan 1999: performance-contingent d = −0.28, expected tangible d = −0.36). Symbolic digital medals on a drill task are low overjustification risk. Tiers work as proximal goals (Bandura & Schunk 1981: proximal subgoals raised arithmetic mastery AND intrinsic interest in 7–10-year-olds).
- **System-picked content + mixed rounds (feature 3)** — **The single most evidence-backed feature.** Interleaved practice beats blocked (Rohrer et al. 2020 preregistered RCT: d = 0.83; Brunmair & Richter 2019 meta, math subset: g ≈ 0.34). Children left to choose reliably prefer blocked easy practice and sincerely believe it works better even when their own data show otherwise (Kornell & Bjork 2008; Yan et al. 2016 — the illusion survives feedback). Learner control over content yields zero learning benefit (Karich et al. 2014: g = 0.05, CI includes 0). The kids' cherry-picking is the textbook failure mode; removing the picker costs nothing pedagogically.
- **No sibling competition / parent-only performance data (features 4–5)** — Correct. Social comparison is at peak salience at ages 9–14 (Butler 1998), temporal/self-comparison delivers pride without superiority pressure (Gürel, Brummelman et al. 2020), and leaderboard gamification shows declining intrinsic motivation over time (Hanus & Fox 2015).

**What needs adjusting (two genuine corrections):**

1. **"Positive-only feedback" must be re-specified as positive-only TONE, never positive-only INFORMATION.** Right/wrong-only feedback is nearly worthless (d = 0.05); showing the correct answer is d = 0.32, short explanations d = 0.49, with maths the biggest beneficiary (Van der Kleij et al. 2015, RER). Neutral error correction ("7 × 8 = 56") is information, not criticism, and errors + corrective feedback improve retention in primary-age children (Metcalfe 2017). A mode that hides which questions were wrong would measurably hurt learning. This is the one clearly wrong reading of the proposal.
2. **The parent metric must be rate-based (correct facts per minute), not score-out-of-10.** Accuracy on 10 questions ceilings almost immediately on known tables; rate data is also more reliable than accuracy data (Burns, VanDerHeyden & Jiban 2006). Feature 5 is right in spirit but needs a fixed-format weekly benchmark probe separate from daily practice (Section 3).

**Minor refinements:** add streak forgiveness (Silverman & Barasch 2023: repair opportunities recover ~2/3 of broken-streak demotivation; Lally 2010: one missed day doesn't harm habit formation); gate the timer on accuracy per table (McNeil et al. 2025 PSPI consensus: time pressure only after ~90% accuracy); keep medal copy matter-of-fact rather than gushing (Amemiya & Wang 2018: effort praise can read as a low-ability signal from ~age 11 — Eliza's exact profile). Note: the "timed tests cause math anxiety" worry is not experimentally supported — keep the timer.

---

## 2. RECOMMENDED FORMAT

### Daily loop (what happens when a child opens the app)

1. **Login screen shows streak** ("Day 12 🔥") — streak salience at login and after sessions is what drove the Peru RCT effect.
2. **The app announces today's content, pre-picked** ("Today: 7s + mixed") — predictable and fair-feeling, but not choosable. Child chooses only content-irrelevant things: round order ("mixed first or 7s first?"), theme/avatar (Patall et al. 2008: 2–4 modest, instructionally irrelevant choices boost motivation, especially in children).
3. **Round structure (10 questions, ~1–2 min each):**
   - If a weak/new fact is scheduled, show it once with its answer first ("7 × 8 = 56 — now you") before quizzing it (modeling — largest component effect, Codding et al. 2011).
   - Immediate per-item feedback: wrong answer → the correct fact appears neutrally for ~2s, and that fact is requeued at the end of the round.
   - Untimed-feel (count-up, no ticking) for tables below 90% accuracy; normal timing once accurate.
4. **End of round:** medal-tier progress bar, personal-best sparkline for that category, missed facts listed with answers.
5. **Once weekly, one round is silently a 60-second benchmark probe** (Section 3), slotted inside the daily minimum so it costs nothing extra.

### Streak rules

- **Streak ticks on ANY completed round** (Duolingo's ">40% more 7-day streaks" finding: decouple streak from the stretch goal).
- **Daily minimum "streak met" = 2 rounds (~3–4 min).** Small enough to survive bad days; the evidence says persistence (30+ total sessions) beats per-day volume.
- **1 auto-earned streak shield per week** (a missed day is auto-covered) + **next-day repair** (double session restores). Repair largely neutralizes broken-streak demotivation (Silverman & Barasch 2023) and costs nothing in learning terms (Lally 2010).
- **After a full loss:** auto-start a new streak immediately with a fresh-start message; frame any break externally ("the app paused your streak"), never as the child's failure.
- Early milestones at day 3 and 7 with fanfare (make the first week deliberately easy to complete).

### Medal thresholds (effort-gated, per day)

- **Bronze = the daily minimum** (2 rounds / 20 questions) — reachable every normal day (proximal-goal evidence).
- **Silver = 4 rounds (40 questions)** — modest stretch.
- **Gold = 6 rounds (60 questions)** — big-session day.
- No fourth tier, no escalating requirements, never accuracy-gated, **never convertible to money/toys on a fixed contingency** (that recreates Deci's worst condition, d = −0.40). Frame informationally: "Gold — 60 questions today," not "do your questions to earn gold."

### Content-selection algorithm (per child, per fact)

Track per-fact `{attempts, correct, median latency, last_seen}` (the existing `time_ms` field extends naturally).

1. **Classify facts:** *weak* (<90% accuracy or latency > ~3s), *known* (≥90% and fast), *mastered* (fast + accurate over 2+ weeks).
2. **Round composition — incremental rehearsal shape (Burns 2012: among the largest effects in this literature):** ~10–30% of each round from the child's 2–3 weakest facts (repeated within the round at increasing spacing), remainder from known facts. This yields an ~85–90% success rate, which makes positive-only tone naturally honest — crucial for Eliza, for whom untargeted mixed rounds would produce discouraging error rates.
3. **Mixed is the default round type.** Single-table blocked rounds only briefly when introducing a weak/new table, after which its facts fold into the mix (Rohrer 2020). Occasionally mix in addition/subtraction.
4. **Spacing scheduler:** weak tables resurface every 1–2 days; known every 2–4 days; mastered weekly as retention checks (Cepeda et al. 2006: stretch the revisit gap as retention strengthens). A per-table `last_practised + accuracy` record in KV suffices — no SM-2 engine needed.
5. **Target band:** the picker should aim each child at content in the 24–49 digits-correct-per-minute instructional range (Burns et al. 2006); below 24 = too hard for timed drill (more modeling, smaller fact set), above ~49 = rotate to maintenance.

### Feedback copy principles

Task- and trend-focused, never person-focused (Kluger & DeNisi 1996: self-directed feedback is where the ~38% of negative feedback effects concentrate). Matter-of-fact and quantitative like a fitness tracker; enthusiastic ONLY for data-verified genuine improvement (new personal best, table mastered). Every correction carries the correct answer. No inflated praise (Brummelman: backfires for low-self-esteem children), no "you're so smart," no praise quotas (the 5:1 positivity ratio is debunked — Brown, Sokal & Friedman 2013).

**Example messages:**

1. *Routine good round:* "9 out of 10 — and your 7s are getting faster. Silver is 2 rounds away."
2. *Genuine improvement (data-triggered):* "New personal best on the 8s — 10/10, your fastest ever. The practice is working."
3. *Bad round:* "4/10 on mixed tables today. The ones to practise: 7×8=56, 6×9=54, 12×7=84 — they'll come back tomorrow. Your best on this category is still 8/10, and your streak is safe: Day 12."

---

## 3. PARENT SCORE

**Design: separate a fixed-format weekly BENCHMARK from daily practice.** Daily rounds are adaptive and un-normable; the benchmark is a 60-second, single-operation, randomly sampled probe (fresh items each time, never reusing that day's practice items), one operation per week on rotation.

**Computation:**
- Metric = **correct facts per minute** (digits-correct for multi-digit answers).
- Monthly score per operation = **median of the last 3 probes** (single probes are too noisy — CBM methodology requires aggregation to reach reliability > 0.80; IRIS/Methe et al. 2015).
- **SS = 100 + 15 × (child's rate − age-norm mean) / age-norm SD**, the same construction as NI school-report standardised scores (GL Education documentation: mean 100, SD 15, ~68% in 85–115). Interpolate norms by age in months (store DOB in profile). Clamp 60–140.

**Norm anchors — Westwood One Minute Basic Number Facts Tests** (verified against the primary source; Australian, 1995, ages to 11.0 — the only free age-based norms for exactly this task):

| Operation | Age 10.0 mean (normal range) | Age 11.0 mean (normal range) |
|---|---|---|
| Addition | 20.5 (16–24) | 23.5 (20–27) |
| Subtraction | 16.5 (12–21) | 21.0 (17–25) |
| Multiplication | 13.0 (9–17) | 17.0 (13–21) |
| Division | 9.0 (5–13) | 13.0 (8–18) |

**Important correction from verification:** Westwood's "normal range" is ±0.68 SD (middle ~50%), not ±1 SD. So SD ≈ (range half-width)/0.68 ≈ **5.9 facts/min** for multiplication at ages 10–11, not ~4. Worked examples with the corrected SD: Tom (10.0) at 18 correct/min → z = (18−13)/5.9 = +0.85 → **SS ≈ 113** ("above average"). Eliza (11.0) at 14 → z = −0.51 → **SS ≈ 92** ("slightly below average" — sanity-consistent with her school profile).

**Supplementary anchors:**
- **CBM mastery criterion:** ≥40 digits-correct/min = mastered (Deno & Mirkin 1977, widely cited though practitioner-derived); instructional range 24–49 DCPM for grades 4–5 (Burns et al. 2006, empirically derived, n=434); ~60 DCPM predicts durable retention.
- **MTC mastery gate (tables only):** add an MTC-style round — 25 questions, hard 6-second timeout, weighted to 6/7/8/9/12s. England 2025 national mean 21.0/25 at age 8–9, 37% full marks (DfE official statistics). For a 10- and 11-year-old the target is **consistent 25/25** — use as a pass/fail mastery gate, not a scale (it ceilings).

**Honest caveats (display these to the parent):**
- Label it **"fluency index (estimated, home proxy)"** and display as a **band** (e.g. "96–108"), suppressed until 3 probes exist. A one-off ~10-point difference between the kids is noise.
- Norms are 30-year-old Australian written-test data; the kids type on a device (mode effects are real — Rich et al. 2012 found imperfect paper↔computer transfer). Run a quarterly "copy the number you see" typing-speed calibration so fluency gains aren't just keypad gains.
- Practising the same domain daily inflates scores vs. unpractised norm samples; the score is internally comparable month-to-month, not school-comparable.
- It measures fact fluency only — it **cannot predict the school PTM/transfer-test SAS** (different construct).
- Eliza is at the table ceiling (11.0): extrapolate ~+2 facts/min per half-year with a widening band and a visible "extrapolated" flag.
- **The more defensible "is it working" metric is the within-child trend line** (weekly rate per operation, fitted slope): "growing" / "plateaued below mastery after 4+ weeks → change the intervention" / "plateaued at mastery → rotate to maintenance." A plateau at a high level is success, not failure.

---

## 4. WHAT TO AVOID

| Pitfall | Evidence | Mitigation |
|---|---|---|
| **Hard-reset streaks** | Broken streaks measurably demotivate; worst when child feels at fault (Silverman & Barasch 2023, JCR, 7 studies) | Shields + next-day repair + external framing + instant fresh-start |
| **Streak anxiety / doom salience** | Observational (Duolingo quitter studies) but credible | Friendly counter, no countdown notifications, no "you'll lose everything tonight!"; parent quietly deploys a shield if a child shows distress |
| **Converting medals to money/toys** | Expected tangible rewards undermine intrinsic motivation, worst for children (Deci et al. 1999: engagement-contingent d = −0.40) | Medals stay symbolic and informational; spontaneous unexpected treats are fine |
| **Accuracy-gated medals / sibling leaderboard** | Performance-contingent rewards d = −0.28 + highest anxiety; peak social-comparison sensitivity at 10–11 (Butler 1998; Hanus & Fox 2015) | Medals stay effort-gated; all normative data parent-only, never percentiles or sibling comparisons to the kids |
| **Hiding errors ("positive-only" misread)** | Verification-only feedback d = 0.05 vs 0.32–0.49 with correction (Van der Kleij 2015) | Always show the correct fact, neutrally, and requeue it |
| **Gushing effort praise, esp. for Eliza** | From ~age 11 effort praise can signal low expectations (Amemiya & Wang 2018); inflated praise backfires for low-confidence children (Brummelman 2014/2017) | Matter-of-fact quantitative copy; enthusiasm reserved for verified improvement |
| **Relying on mindset/praise wording as the engine** | Growth-mindset interventions average d ≈ 0.08 (Sisk et al. 2018); Mueller & Dweck largely failed replication (Li & Bates 2019) | Practice volume + forced coverage + retrieval do the work; praise wording is a cheap guardrail only |
| **Timing low-accuracy material** | McNeil et al. 2025 PSPI consensus: time pressure only after accuracy; no benefit timing new/complex material | Per-table accuracy gate (~90%) before normal timer; count-up display for shaky tables |
| **Score-out-of-10 as the parent metric** | Ceilings immediately; rate is more reliable (Burns et al. 2006) | Rate-based benchmark probes, median-of-3, band display |
| **Judging too early / expecting miracles** | Habit automaticity ≈ 59–66 days median (Lally 2010; Singh et al. 2024); gamification novelty fades in weeks 1–2; interleaving will DROP scores initially (desirable difficulty) | Warn the parent dashboard, not the kids; judge on weeks 4–10 usage and the trend line; plan for 8–10 weeks and 30+ sessions before verdict |

---

## 5. KEY NUMBERS

| Anchor | Value | Source |
|---|---|---|
| Daily dose | ~3–5 min/day (2 × 10-question rounds), split beats massed | Schutte 2015; IES guidance (~10 min max) |
| Sessions before judging | 30+ total sessions; habit ≈ 2 months | Douglas 2026 (β=1.83, p=.046); Lally 2010 |
| Fluency-intervention effect | g = 0.76 (students with math difficulties; heterogeneous) | Douglas et al. 2026 meta |
| Interleaved vs blocked | d = 0.83 (one RCT); math meta g ≈ 0.34 | Rohrer 2020; Brunmair & Richter 2019 |
| Learner control over content | g = 0.05 (no benefit) | Karich et al. 2014 |
| Corrective vs right/wrong-only feedback | d = 0.32–0.49 vs 0.05 | Van der Kleij 2015 |
| Known:new fact ratio in rounds | ~85–90% known / 10–30% weak | Burns 2012 (incremental rehearsal) |
| Expected gain (targeted skill, intervention) | ~1.6 DCPM/session; vs ~0.3 DCPM/week from schooling alone | Codding et al. 2020 review; Fuchs 1993 |
| Realistic term-length success | +0.2–0.4 SD in facts/min vs own baseline | replication-adjusted estimate |
| Mastery threshold | ≥40 DCPM (≈30–40 facts/min); instructional band 24–49 DCPM | Deno & Mirkin 1977; Burns et al. 2006 |
| Multiplication norm, age 10 / 11 | 13 / 17 correct per min (SD ≈ 5.9) | Westwood One Minute Tests |
| MTC national anchor (age 8–9) | mean 21.0/25, 37% full marks (2025); target for Tom & Eliza: consistent 25/25 | DfE official statistics |
| Streak effect on practice | causal increase in use; learning +0.13–0.17 SD (suggestive only) | Aulagnon et al. NBER Peru RCT |
| Streak repair | recovers ~2/3 of broken-streak demotivation | Silverman & Barasch 2023 |

**Bottom line for implementation:** build the parent's five features as specified, plus four additions — (a) immediate correct-answer feedback with end-of-round redo, (b) per-fact accuracy/latency tracking driving an incremental-rehearsal picker with mixed-round default, (c) streak shields + repair, (d) a weekly 60-second benchmark probe feeding a median-of-3, Westwood-normed, band-displayed parent score with a trend line as the primary "is it working" signal.