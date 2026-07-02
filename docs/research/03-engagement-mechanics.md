# Evidence Synthesis: Five Proposed Features — Verdicts & Implementation Spec

Scope note: verdicts below use only "supported" claims at face value, corrected claims where the adversarial review found overstatement, and explicitly flag anything resting on unverified or analogical evidence.

---

## 1. VERDICT TABLE

| Idea | Verdict | Evidence basis (one line) |
|---|---|---|
| **A. Warmup round** | **REJECT as designed; adopt cheap substitute** | Easy-first ordering shows no accuracy/time benefit in the one direct math test (Jaspers 2007) and dedicated easy rounds are near-zero-gradient overlearning (Rohrer & Taylor 2006); the only proven "easy first" mechanism operates at a <10-second timescale (behavioral momentum, SUPPORTED). |
| **B. Calibration series** | **ADOPT-MODIFIED** | One-time disguised placement phase + continuous per-fact assessment from ordinary play is what all mature products converge on and what CBM reliability research requires (median-of-3-probes, rolling windows — SUPPORTED); recurring dedicated calibration weeks are unjustified. |
| **C. Goal reveal** | **ADOPT** | Specific proximal goals beat vague/hidden ones (Locke & Latham d≈.42–.80; Bandura & Schunk 1981 in children's arithmetic); works ONLY with an attainability check — rejected goals reverse the benefit (Erez & Zidon 1984). |
| **D. Easy-bronze days** | **ADOPT-MODIFIED, as a per-child experiment** | Surprise/unexpected rewards don't undermine intrinsic motivation (Deci et al. 1999, robust across rival meta-analyses) and unpredictability defeats strategic waiting by construction — but **no direct study of this mechanic exists**; all support is analogical. |
| **E. Volume / stop cap** | **ADOPT: cap after gold, "lock" framing** | Dose-response is unusually consistent: tiny daily doses work, returns flatten fast (~3 correct retrievals/fact, ~10–15 min/day), spacing beats massing; the stop-cap is theoretically right, but the "reverse psychology" message itself has **no causal evidence** — wording matters (lock, not completion). |

---

## 2. PER-IDEA DETAIL

### A. Warmup round — REJECT the standalone round, keep the feeling

**What the evidence says.** Three independent lines kill the proposed form:
- Easy-first *ordering* produced no accuracy or completion-time benefit in the one direct math-assignment test (Jaspers et al. 2007, N=142), and easy-first was rated the *most* difficult/effortful arrangement. (Large-scale exam data show easy-first reduces test *abandonment* — but that's a persistence effect in long low-stakes tests, not a learning effect in 10-question rounds.)
- A dedicated 2×/5×/10× round is massed overlearning of owned facts: Rohrer & Taylor (2006, n=216) found tripling same-session practice past mastery added **nothing** at 1 or 4 weeks, while spacing the same items roughly **doubled** 4-week retention. At the 2-round bronze floor, a warmup consumes **50% of the day's dose** for ~zero learning.
- The genuinely powerful "easy first" effect — behavioral momentum / high-p sequences (SUPPORTED verdict) — requires **2–5 near-automatic responses within ~10 seconds** of the hard item. A separate round + summary screen + new round-start is outside the demonstrated window.
- The interspersal benefit the parent is intuiting is real but is a **mixing** effect, not a **blocking** effect — and the app's 80/20 focus round already implements it correctly.

**Implement instead (total cost: ~10 seconds + a reorder):**
1. **Reorder the daily loop: review round first** (rotating mastered table), then focus, then mixed. The review round *is* the easy start — subjectively easy, objectively useful spaced retrieval. Zero opportunity cost.
2. **Open the focus round with 2–3 known facts** (e.g., the child's fastest 2×/5×/10× facts), then hit the first weak fact within seconds. This is the actual momentum mechanism.
3. Never label any of this "warmup" or count it as an achievement.

**Avoid:** a dedicated easy round; daily drilling of mastered tables; any warmup that counts toward medals on its own (otherwise the rational tired-day strategy becomes "do the two easiest rounds and stop").

**Judgement-call flag:** if Eliza shows timer anxiety, an easy opener as an *anxiety buffer for her specifically* is defensible (anxiety-moderation evidence is real but thin). Make it a per-child toggle, default off.

---

### B. Calibration — ADOPT-MODIFIED: one-time placement, then every round is measurement

**What the evidence says.**
- Single observations can't classify a fact: CBM practice uses the **median of 3 probes** (SUPPORTED); BKT mastery estimates for the ambiguous boundary facts — exactly the ones calibration must resolve — need up to **~15 observations** (corrected claim), so exhaustive placement of ~121 multiplication facts + add/sub from a few 10-question rounds (~30–50 answers) is arithmetically impossible. A calibration series yields a **usable prior, not a verdict**.
- Most mature products (FASTT Math, TTRS, Math Facts Pro, Reflex) use initial placement + continuous embedded diagnosis; note the corrected claim — this is common but not universal (XtraMath uses recurring quizzes) — still, the continuous model is the better fit here because it costs zero extra child time and every answer is also retrieval practice (testing effect).
- Latency separates retrieval from counting **on average** (corrected claim: not perfectly per-trial): net-of-typing ~**0.8–1.25 s** = near-certain retrieval (FASTT convention); **3 s** = fluency convention that admits fast counting; MTC's 6 s includes typing and is deliberately permissive.

**Implement:**
1. **One-time placement phase per child per operation**, disguised as normal play ("explorer rounds" that count toward medals), spread over **1–2 weeks** (~2–3 exposures per fact, stratified rotation so every fact family appears a controlled number of times). Output: coarse triage — fluent / uncertain / unknown. Exploit structure to cut item count: commutativity (7×8 updates 8×7), table-level priors, known difficulty ordering.
2. **Typing baseline first**: a 30-second "type the number you see" game; re-measure every ~3 months or bands drift as typing improves.
3. **Per-fact rolling window thereafter**: classify from the **last 5 attempts across ≥2 days**. Bands (typed-adjusted): ≤1.25 s correct = FLUENT; 1.25–3 s correct = SLOW (focus-round target); >3 s / wrong / timeout = UNKNOWN. Discount fast-wrong answers as mistypes.
4. **Recalibration is event-driven, not scheduled**: fact unseen ~21–28 days → silently injected into next mixed round; 2 misses/slow in last 5 → demote a band immediately; after any >2-week break → short disguised re-triage before resuming.
5. Only the **parent-facing MTC-format probe** is an explicit periodic assessment: ~once per half-term, **median of 2–3 administrations**, interpreted against the 2024 national mean 20.6/25 (with the caveat displayed: both kids are older than the Year 4 norm group, so it's a floor, not a peer comparison).
6. **Engineering prerequisite (blocking):** KV currently stores only round-level `score`/`time_ms`. Idea B requires per-item logging — `{fact, correct, latency_ms, round_type, timestamp}` per answer — added to the score records and the `/api/scores` payload. Without this, none of the above is buildable.

**Avoid:** the word "test" anywhere child-facing; recurring "calibration weeks"; classifying any fact from one answer; showing provisional growth slopes as settled (mark the parent's weekly slope provisional until ~6+ weekly data points exist). For Eliza, seed calibration rounds with a higher proportion of likely-known facts so placement never feels like a wall of failure.

---

### C. Goal reveal — ADOPT, with an attainability gate and a one-line "why"

**What the evidence says.** This is the best-evidenced of the five ideas.
- Specific goals beat vague/hidden ones: d ≈ .42–.80 across ~400 studies, strongest on simple well-practised tasks — exactly math facts (corrected figures: ~90% of studies positive, median ~16% field gain; still one of I-O psychology's most replicated findings).
- In children's arithmetic specifically, **proximal (today-sized) goals** beat distal goals on skill, self-efficacy, and free-choice interest; distal ≈ no goal (Bandura & Schunk 1981 — small N=40, but reinforced by Schunk's programme).
- Goal setting on multiplication facts in 8–10-year-olds improved fluency over 8 weeks but **not** motivation/self-efficacy scales (Sides & Cuevas 2020, SUPPORTED) — so justify the feature on fluency, not attitude change.
- The boundary condition is hard: once a revealed goal is **rejected as unattainable**, harder goals produce progressively *worse* performance (Erez & Zidon 1984 — one lab study, but the commitment-expectancy link is meta-analytic, Klein et al. 1999).

**Implement:**
1. **Reveal = today's bronze only**, concrete and numeric: "Bronze today = 2 rounds, at least 5/10 in each." Never weekly framing child-side; the 5-of-7 streak math stays in the parent/summary layer.
2. **Attainability gate (algorithmic, mandatory):** only reveal a bronze the child's recent history says they hit on ≥70–80% of recent days. After a missed day, the bounce-back bronze is conspicuously modest.
3. **One-line rationale on every reveal** ("tell and sell" — unverified but consistent with the verified commitment findings): "Today is 7s practice because you almost had them yesterday." One template string per round type from the picker's own logic.
4. **Micro-proof of attainability from the child's own data**: "You did 3 rounds on Tuesday." Trivial query against existing KV history; the cheapest anti-disengagement lever available.
5. **Frame by fact status**: performance framing ("get 8/10") for known material; learning/mission framing ("crack the 7×8 family") when the focus round contains genuinely unknown facts. For Eliza after a losing streak, degrade to pure process ("do 2 rounds").
6. **Never let the reveal disclose easy-day status** (see D — it must stay a surprise).
7. Optional bounded choice (round order, or 7s-vs-8s focus) — self-set elements gave the highest self-efficacy in Schunk's data without letting the child dodge weak facts.

**Avoid:** motivational sparkle-copy (evidence says attitude won't move; the app's no-fake-praise tone is correct); revealing goals the system predicts will be failed — a visible-but-rejected goal is worse than no reveal; copying Duolingo quest mechanics on the strength of app folklore (no peer-reviewed A/B data exists — the academic literature is the justification).

---

### D. Easy-bronze days — ADOPT-MODIFIED, shipped as an explicit n=2 experiment

**Honest flag up front: there is no direct study of this mechanic.** Every supporting claim transfers from adjacent literatures. It's a defensible bet, not settled science — instrument it and be ready to kill it per child.

**What the evidence says.**
- **Surprise is the load-bearing design choice** (corrected but robust): expected tangible rewards undermine children's intrinsic motivation (d = −0.43 in children vs −0.21 in students); unexpected/task-noncontingent rewards show no undermining — a conclusion even the rival Cameron & Pierce meta-analysis shares. Caveat from the correction: a *recurring* surprise migrates toward "expected" over time; the one-shot lab evidence doesn't cover repeated schedules.
- **Unpredictability defeats waiting-for-the-easy-day by construction** (SUPPORTED) — if the child can't identify the day, there's nothing to hold back for. Residual risk it doesn't cover: uniform daily low effort, which the ≥50% accuracy floor mitigates.
- Reward-prediction-error logic and one small quasi-experimental pilot (N=77 third-graders: completed exercises 44→54, correct 40→52 under variable-ratio) point the same direction (SUPPORTED as reported, but a single un-randomized pilot).
- **Risks are also evidenced:** a diet of easy wins predicts fragility to later difficulty (Bandura — SUPPORTED); easy goals under-motivate (goal-setting theory); licensing/"I've done enough" may cancel the hoped-for push to silver (child evidence genuinely mixed — unproven either way).
- **Ethics:** not a loot box — no money, no randomized prize, no near-miss cues; randomizing effort-cost downward in a parent-run app fails every Drummond & Sauer gambling-adjacency criterion.

**Implement:**
1. **Frequency:** exactly **1 easy day per rolling 7-day window, position drawn randomly**. Never a fixed weekday. Hard cap — if it drifts more frequent, it becomes the new expectation and the boost dies.
2. **Mechanics:** drop **only the bronze threshold** (e.g., bronze = 1 round instead of 2); **silver (4) and gold (6–8) unchanged and fully visible** — the difficult goals that drive effort stay the salient target.
3. **Keep the ≥50% per-round accuracy floor active** even on easy days — bronze must still require real answers.
4. **Anti-licensing summary copy:** after an easy bronze, never show "day complete" framing. Show the open ladder: "Bronze done early — silver is only 2 more rounds."
5. **No slot-machine styling** around the discovery moment; medal stays symbolic/non-tradeable; parent dashboard shows when easy days occurred and has a per-child off toggle.
6. **Instrument it:** log rounds-completed and next-day return on easy vs normal days, per child. Keep the feature only where it raises (or doesn't lower) total effort. Expect divergent answers: Eliza may benefit from the confidence win; Tom may be the coasting risk.

**Avoid:** pre-announcing or letting Idea C's reveal leak easy-day status; predictable "Fun Friday"; compressing the whole medal ladder; using easy days as a routine confidence crutch for Eliza.

---

### E. Volume, dose, and the stop message — ADOPT the cap; the "reverse psychology" needs careful wording

See Section 3 for the direct answer. Implementation summary:

1. **Bronze (2 rounds ≈ 3–4 min) is a genuine effective dose** — message honestly that bronze-every-day beats gold-twice-a-week. Treat 2 rounds/day as the real "dose delivered"; the 1-round streak floor is the bottom edge of the evidence.
2. **Scheduler hard rule:** cap each weak fact at **~3 correct retrievals per day**; after that, stop serving it today regardless of how many rounds are played (Rohrer & Taylor; Rawson & Dunlosky — SUPPORTED). Extra rounds rotate to review/other categories, never re-drill today's cleared facts.
3. **Cap new material:** **3–6 genuinely unknown facts in circulation per child per day** (Eliza ~3, Tom ~5–6). Extra rounds widen review, never the unknown set. *(Unverified but from the well-regarded Burns acquisition-rate line — judgement call.)*
4. **Encourage splitting:** after 3–4 consecutive rounds, prompt a break and surface morning-2/evening-2 as the recommended silver path. (Corrected claim: the within-day spacing benefit is real but modest, g ≈ 0.15–0.36, and needs gaps of **hours** — 10-minute gaps behave like massing. So the prompt is "come back after school," not "wait 10 minutes.")
5. **After gold: full stop state.** Weak-fact scheduler paused, no further medal progress, optional free-play only.
6. **Exact break/stop copy** (lock framing, never completion — see §3):
   - Mid-session break prompt (after 3–4 consecutive rounds): *"Nice run. Rounds count more with a gap — come back after school/tea and they'll be waiting."*
   - Post-gold stop message: *"Gold! Today's medals are full — tomorrow's rounds unlock in the morning."* + greyed-out preview of tomorrow's focus table and the partially-filled weekly bar. **Never** "You're all done!"
   - Parent dashboard line: *"Minutes beyond ~15/day add almost nothing — days matter, not minutes."*
7. **Fatigue detector from existing telemetry:** if median RT in round N is >20–25% slower than round 1 at equal difficulty, or accuracy dips below the 50% floor, fire the break prompt early. *(Threshold is inference — no study fixes "N sprints before decline"; flag as judgement call.)*
8. **Peak-end sequencing** *(plausible extrapolation, no child RCT)*: hard focus round early; if the day ends after a failed round, offer one short easy "victory lap" round so the stop message fires after a success.

---

## 3. VOLUME ANSWER (direct)

**Minimum effective dose:** ~**2–4 minutes/day of actual timed retrieval (≈ 2 rounds), delivered (near-)daily.** Very small daily doses reliably work (explicit-timing literature since 1976; Schutte 2015 got significant growth from four 1-minute timings/day). The "less-than-daily = nothing" threshold is one lab's partly-unpublished finding (corrected claim) — treat near-daily as strongly advisable, not a cliff. **Frequency matters as much as duration**: at equal total minutes, 4–5×/week beats 1–2×/week.

**Sweet spot:** ~**5–12 minutes/day (3–6 rounds)**, ideally split into two blocks hours apart for simple facts.

**Where diminishing returns start:** brutally early, at two levels. **Per fact: after ~3 correct retrievals in a session** — further same-day reps of that fact are near-worthless for retention, while the same trials tomorrow are worth roughly 2–3× more (Rohrer & Taylor 2006: 3 vs 9 problems, identical scores at 1 and 4 weeks; distributed practice doubled 4-week retention — SUPPORTED). **Per day: ~10–15 minutes** — converging norms across every evidence-based program (Poncy 1–4 min, XtraMath ~10, Reflex Green Light ~12–13), and no study shows lasting benefit past ~15 min/day on the same fact domain (SUPPORTED).

**Defensible daily max:** **gold at 6–8 rounds (~12–16 min answering) is already the ceiling — do not add a higher tier.** ~20 min is the absolute line the parent dashboard should actively discourage.

**Is "more always better"? No — but the right unit is days, not minutes.** The spacing effect is one of learning science's most robust findings; the app's single highest-leverage metric is **distinct days with ≥2 completed rounds**, not total minutes. Surplus enthusiasm should be banked into tomorrow, not spent on more of today.

**Should the app tell kids to stop?** **Yes — the cap is evidence-backed; the message's motivational magic is not.** Three separate things here:
- *Stopping/capping*: directly supported by overlearning + spacing evidence. The cap is not merely harmless, it's theoretically the correct move.
- *Industry precedent*: Reflex Math does exactly this ("return the next day") with strong correlational outcomes — but that validates the dose target, not the message mechanic. **No published causal evidence shows a stop-message increases next-day return in children.**
- *"Reverse psychology"*: two opposing mechanisms, both real. Scarcity/restriction increases desire in children (reactance — classic, replicated), but declaring a task **finished** discharges the urge to resume (Ovsiankina resumption effect — survives a 2025 meta-analysis even though the Zeigarnik memory effect doesn't). **So it's half-gimmick: the lock framing plausibly helps, the "all done!" framing plausibly backfires, and the difference is just wording.** Use "Today's medals are full — tomorrow unlocks in the morning" with a visible incomplete hook (greyed tomorrow-preview, 3/4-filled weekly bar). With n=2 kids, A/B the framings across weeks if you want real evidence — next-day return time is measurable.

---

## 4. KEY NUMBERS

| Number | What it is | Source | Verdict status |
|---|---|---|---|
| **~3 correct retrievals/fact/session** | Within-session learning plateau; cap point | Rawson & Dunlosky 2011; Rohrer & Taylor 2006 | Supported |
| **~2× 4-week retention** | Spaced vs massed, same total problems | Rohrer & Taylor 2006 (64% vs 32%) | Supported |
| **1–4 min/day** | Minimum effective daily dose, timed retrieval | Poncy; Van Houten & Thompson 1976; Schutte 2015 | Supported (daily-threshold part overstated) |
| **~10–15 min/day** | Point of flat returns; sensible max | Converging program norms (Reflex, XtraMath, Poncy) | Supported |
| **g = 0.15–0.36** | Within-day spacing benefit for simple facts, 4-wk follow-up (needs hours-long gaps) | DeFouw/Klingbeil/Codding 2026 RCT | Corrected (the "~25% more learning" gloss is inflated) |
| **80–90% success / ~85% accuracy** | Practice-difficulty sweet spot — the existing 80/20 mix already sits here | Wilson et al. 2019; Burns 2004 drill-ratio meta | Unverified (heuristic, converging) |
| **d = .42–.80; median ~16% gain** | Specific vs vague goals (simple tasks strongest) | Locke & Latham 2002 | Corrected (96%/17% figures inflated to 90%/16%) |
| **Proximal ≫ distal ≈ no goal** | Children's arithmetic goal framing | Bandura & Schunk 1981 (N=40) | Corrected (real but small single study) |
| **Reversal on goal rejection** | Why the attainability gate is mandatory | Erez & Zidon 1984; Klein et al. 1999 (83 samples) | Corrected (relative decline, not below baseline) |
| **d = −0.43 (children)** | Undermining by *expected* tangible rewards; unexpected ≈ 0 | Deci, Koestner & Ryan 1999 (128 studies) | Corrected (moderator solid; small k for unexpected) |
| **1 easy day / rolling 7, random** | Easy-day frequency ceiling | Design inference from RPE/SDT | **Thin — analogical, no direct study** |
| **0.8 / 1.25 / 3 s (net of typing)** | Fluent / instructed / convention latency bands | FASTT Math (Hasselbring); Kling & Bay-Williams | Corrected (conventions, not empirical boundaries) |
| **Last 5 attempts, ≥2 days; median of 3 probes** | Minimum evidence to classify a fact / probe | CBM protocol (IRIS); Solomon et al. 2020; TTRS last-10 | Supported |
| **~15 obs/skill (boundary facts)** | BKT worst-case stabilization → calibration = prior, not verdict | pyBKT, Badrinath et al. 2021 | Corrected (worst-case, not universal) |
| **20.6/25, ~33% full marks** | 2024 MTC national mean @ 6 s/item (parent percentile anchor; age caveat) | GOV.UK MTC attainment 2024 | Unverified (official statistic) |
| **3–6 new facts/day** | Acquisition-rate cap per child | Burns incremental-rehearsal line | Unverified |
| **>80% resume interrupted tasks; drops if told "complete"** | Why cap = lock, never completion | Ovsiankina; 2025 HSSC meta-analysis | Unverified (low confidence, wording lever only) |
| **6+ weekly data points** | Before the parent growth slope is dependable | Christ et al.; Thornblad & Christ 2014 | Supported |

**Genuinely thin spots (judgement calls, be honest with yourself):** everything in Idea D (analogical only — hence the per-child experiment framing); the stop-message's motivational effect (mechanism plausible, zero causal child data); peak-end "end on a success" sequencing (adult exercise studies only); the fatigue-detector RT threshold (pure inference); licensing effects in 10–11-year-olds (contradictory literature); Eliza-specific anxiety-buffer warmup toggle (moderation evidence real but sparse).