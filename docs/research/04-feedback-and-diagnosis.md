# Feedback Depth, Struggle Detection, and Parent Handoff — Design Decisions from the Verified Evidence

---

## 1. THE LINE (Question A)

**Decision: the app stays a lean retrieval engine. Depth lives in exactly two places — a mastery-gated one-line cue, and a 15-second end-of-round recap. Everything richer is excluded and routed to the parent.**

### IN-ROUND (during the 10 questions)

| Content | Rule |
|---|---|
| Correct-fact display ("7 × 8 = 56", neutral, ~2s, requeue) | **Keep as decided — for all facts.** This is KCR feedback, the strongest drill-context component ("modeling" in Codding et al. 2011). |
| One derived-fact cue, ≤8 words (e.g. "7×8: think 7×7+7") | **Only** on error, **only** for facts still below the ~90% accuracy threshold (i.e. still in the untimed count-up phase). Never on facts in the fluent/timed phase. |
| Anything else | Nothing. No second line, no animation, no sound on errors, no elaboration on *correct* answers. Error screen visually identical to question screen + one line. |

**Why.** Three converging arguments:

1. **Effect-size argument (with an honest caveat).** Within Van der Kleij 2015, elaborated feedback beat correct-answer feedback only for higher-order outcomes (lower-order: EF 0.37 vs KCR 0.31 — a wash). The newer, larger Mertens et al. 2022 network meta-analysis complicates this — EF won even for recall outcomes (g≈0.71) *except* for high-prior-knowledge learners, where KCR matched it. The mastery-gate resolves the tension exactly: a fact below 90% accuracy = low prior knowledge for *that fact* → gets the one-line cue (cheap EF); a fluent fact = high prior knowledge → bare KCR is equivalent per both meta-analyses, so pay nothing extra. This per-fact conditioning is also directly supported by Fyfe & Rittle-Johnson: feedback elaboration helps low-knowledge children and is neutral-to-harmful for those who already know the material.
2. **Attention argument.** Maier & Klotz 2025 (2,826 secondary students, 20k+ logged assessments): children — low achievers most of all — simply don't read elaborated error feedback in digital systems. Anything not readable in ~1 second buys the time cost without the learning benefit. Eight words is the ceiling.
3. **Opportunity-cost argument.** Practice volume is causal (Fuchs 2010: strategy + 4–6 min deliberate practice beat strategy alone on fluency *and* transfer). At 1–2 min/round, trials-per-minute is the app's primary learning lever. Budget rule: **total feedback overhead ≤ ~15% of round time.** The 2s display × ~1–3 errors fits; a 5s explanation per error eats 15–25% of the round and fails the budget.

### END-OF-ROUND (~15 seconds, outside the timed flow)

A **"2 facts to watch" recap**: for each of the 1–2 worst-missed facts, show the full fact, one strategy line (the same canonical line the parent email will use — one consistent story), and **one tap-to-answer retrieval attempt**. This exploits the spacing mechanism behind the lab "delayed feedback" advantage (Metcalfe et al. 2009: the effect is lag-to-test, not delay per se) while keeping immediate correction, which wins in applied settings (2026 Ed Psych Review timing meta-analysis: no average timing effect; immediate best for classroom retention). Cost: ~15s, zero trials lost.

### EXPLICITLY EXCLUDED FROM THE APP — reserved for in-person

- **Multi-step explanations / "why" text.** No study licenses them for timed fact drill; kids skip them.
- **Arrays / number lines / visual models on error screens.** The positive evidence for visuals (Woodward 2006, WWC guide, Satsangi) comes exclusively from *untimed instruction delivered before or outside drill* — in Woodward's design the visuals lived in the ~25-min lesson block, the 2-min drill's only feedback was post-drill answer correction. Zero studies test visuals as in-drill corrective feedback for typical 9–12-year-olds.
- **Mid-round strategy lessons.** McNeil et al. 2025 (PSPI consensus review): strategy work and retrieval co-occur across a program, but the one hard rule is *accuracy before timed practice* — and in every positive study, strategy instruction was a separate explicit episode, never mid-drill feedback.
- **Per-question reward animations / decorative content.** Seductive-details literature: raises in-game engagement, learning flat or lower; harm larger for weaker learners — i.e., worst for Eliza.

**The line, in one sentence:** *if it can't be read in one second, it doesn't belong inside a round; if it needs a conversation, it doesn't belong in the app.*

---

## 2. STRUGGLE-DETECTION SPEC (Question B)

### 2.1 Per-response logging (extend the existing per-fact log)

- **Two latencies per response:** question-render → first keypress (`initiation_ms`) and first keypress → submit (`typing_ms`). Typing a 2-digit answer on a tablet is 1–2s by itself; only initiation latency is diagnostic.
- **RT classification (per response, internal only — never shown to child or stated as fact to parent):**
  - *Fluent:* initiation ≤ ~2s (total ≤ 3–4s with typing). Basis: adult retrieval ~400–900ms (production studies ~700–1100ms); fluent children ~1–2s; the classroom "3 seconds" is a convention padded for writing mechanics, not a cognitive constant.
  - *Slow-correct:* 4–10s — very likely counting/derivation (child strategy-RT data: counting/decomposition means ~4–6.7s vs ~1.6–2.8s retrieval).
  - *Discard* RT > ~12s as off-task. Use **median** RT per fact, never mean.
- **Automatic error tagging** (multiplication — supported taxonomy, ~76% of child errors are table-related, Butterworth 2003):
  - (a) answer in either operand's table → **table confusion** (log *which* neighbour: 7×8=63 = interference from 7×9). Meaning: fact IS encoded, suffering normal associative interference — fixable in-app with interleaved discrimination of the confusable pair.
  - (b) off by ±1/±2 → counting slip.
  - (c) equals a+b or a−b → **operation confusion**.
  - (d) none of the above → **weak/absent fact** — the strongest parent-handoff signal.
- Addition/subtraction: tag off-by-1/2 (counting) vs decade-wrong (procedure bug) vs other. **Consistency discriminates:** same wrong answer to same fact on 2+ occasions = bug → strong parent flag; scattered near-misses + long RT = still counting → more in-app reps, *not* tutoring; scattered near-misses + fast RT = impulsive slips → don't flag. (Caveat per VanLehn's bug-migration work: bug-vs-slip coding is a heuristic, not a diagnosis — hence "observation not diagnosis" phrasing below.)

### 2.2 What "theme" means

- **Multiplication:** the times table (2s…12s) is the parent-facing theme, but flags are computed **bottom-up from per-fact stats** — "struggling with 7s" is really "struggling with 7×6, 7×8, 7×9". Store both directed orders (7×8, 8×7) separately but **pool commuted pairs for flagging** (reaches minimum observations twice as fast); flag copy names table + specific facts.
- **Addition/subtraction:** themes = **strategy families** in config (doubles, near-doubles, +9/bridge-10, subtraction-crossing-10), not "all addition" — errors cluster by strategy, not operand.

### 2.3 Fact states and thresholds

| State | Rule |
|---|---|
| **Fluent** (per fact) | 9 of last 10 attempts correct **AND** under the child's personal speed cutoff = 1.5 × that child's own median RT on already-fluent facts, floor ~2.5–3s including typing. (Math Facts Pro's deployed rule; per-child cutoffs are essential — **Eliza being globally slower than Tom must never itself generate a flag.**) |
| **Learning** | default state; ~85–90% known mix as already decided |
| **Stuck** (per fact) | ≥10 attempts without ever achieving 3-in-a-row correct, or <60% over last 10 attempts. (ASSISTments mastery = 3-in-a-row; wheel-spinning = unmastered after 10 opportunities, Beck & Gong, 100k+ assignments.) |

**Critical anti-false-positive rule — expected difficulty:** never one global threshold across facts. The problem-size effect is real, large, and does **not** fully disappear on retrieval trials (corrected finding): 6×7/7×8/8×9 will always be slower than 2s/5s/ties, and that alone is not struggling. Judge each fact/theme against the **child's own baseline on comparable material** (z-score vs same-size facts, or theme-vs-rest-of-child deltas).

### 2.4 Theme flag states

| State | Trigger | Visibility |
|---|---|---|
| **Watching** | early weak signal (first 3–5 attempts on a theme poor — wheel-spinning is partially predictable from first 3 opportunities, but with material false-positive rates) | dashboard only, **no email** |
| **Flagged** | ALL of: (1) ≥20–30 logged attempts on the theme (≈2–4 rounds touching it — never flag a new table in week one); (2) theme deficit vs the child's own same-week overall performance (theme accuracy − overall accuracy, theme median RT ÷ overall median RT — this differencing cancels global bad days, which shift everything, whereas real gaps are theme-specific); (3) deficit persists across **≥3 sessions on ≥3 different days** (CBM decision-rule research: NCII requires 3–4 consecutive points below aim line; never act on one bad session) | daily email |
| **Resolved / auto-expire** | ≥60–70% of theme facts fluent, or flag not re-confirmed within 2 weeks → expires. A theme stays flagged ≥1 week (rate-limits emails, naturally distributes parent sessions) | email notes clearance |

**Absolute calibration backstop** (judgement call anchored to practitioner research, not an RCT): convert correct responses to digits-correct-per-minute; theme "on track" needs ≥~30–40 dcpm equivalent **and** ≥90% accuracy. This stops the relative-baseline logic declaring a uniformly slow theme "fine" because everything else is slow too — the Eliza scenario.

**Stagnation trigger:** slow-but-correct derived answers are a *healthy* intermediate stage (overlapping waves) — never flag slowness itself during learning; flag **no median-RT improvement over 2 weeks of regular play** on a theme.

### 2.5 Email line format — observations with counts, never diagnoses

RT-based strategy inference is probabilistic (fast derived facts overlap slow retrievals), so hedge the mechanism, state the numbers:

```
Eliza — 7s table (7×6, 7×8, 7×9): 68% correct vs 91% on her other tables,
about 2× slower, over 42 attempts in 10 days. Most misses were answers
from the 8s/9s tables — mixing neighbours, worth 10 minutes tonight (script below).

Tom — subtraction crossing 10: accurate (94%) but averaging 4.8s and not
speeding up over 2 weeks — probably still counting, not recalling. Keep playing;
no session needed yet.
```

---

## 3. PARENT PLAYBOOK (Question C)

**Framing constraints from the evidence:** parent tutoring works when scripted (Erion 2006: mean ES 0.55 group-design), but parent/nonprofessional tutoring is the weak end of the tutoring hierarchy (Nickow et al.: parents 0.23 SD vs teachers 0.50, imprecise estimate), evidence for ages 9–12 is officially thin ("insufficient" for grades 4–12 in the 2023 review — **honest judgement-call territory**), and unstructured help from a math-anxious parent can actively backfire (Maloney 2015). Therefore: **the email is a literal script, ≤1 paragraph + fact list, imperative voice, 10-minute hard cap, explicit exit rule.** The parent session is targeted repair feeding back into app practice — the app keeps re-measuring the theme rather than trusting the session happened.

The core protocol is **incremental rehearsal (IR)** — best evidence-to-simplicity ratio (meta-analytic NAP 98.9%, median group d=1.67 — *with the honest caveat that this meta pooled mostly reading content; math-fact support is from single-case studies, and the active ingredient is high opportunities-to-respond + modeling + immediate correction, not the exact ordering*). So: ship the script, treat exact IR sequencing as optional detail.

### Flag type 1 — INACCURATE FACTS (weak/absent facts, low accuracy)

Email text the app sends (app auto-fills the deck from its own logs — parent never assesses):

> **Eliza — 7s table, ~10 minutes tonight (stop sooner if it stops being fun).**
> 1. Say once: *"Any 7s fact is the 5s fact plus the 2s fact. 7×8 is 40+16 = 56."* Have her do 7×6 and 7×9 that way, out loud. (~2 min)
> 2. Flashcards (~8 min). Cards, in order: **7×8** (new), then her solid facts: 6×5, 3×4, 2×9, 5×5, 4×6, 8×2, 3×9, 6×6, 5×8. Show 7×8 *with* its answer first — she repeats it. Then quiz: 7×8, +1 known, 7×8, +2 knowns, 7×8, +3 knowns… folding in one more known each pass.
> 3. Wrong or hesitates more than 2 seconds → say *"7 times 8 is 56 — you say it"*, she repeats, carry on. No explaining, no re-teaching.
> 4. Stop at 10 minutes, after 3 misses on the same new fact, or the moment it gets tense — finish on a fact she gets right. The app keeps checking 7s this week.

Structure per Burns 2005 / Intervention Central: 1 unknown folded into up to 9 knowns (90:10 ratio — the ratio keeps frustration low; the reps do the learning), 2-second hesitation rule, mastered fact becomes the first "known" for the next new one. Strategy demo first + drill after mirrors Woodward 2006 (strategy in the lesson, never in the drill), and matches the app's own model-then-quiz design — consistency across "agents" is itself a supported component (Codding 2011: multi-component, multi-agent interventions win).

**Canonical strategy lines** (hard-coded lookup, one per table, identical to the in-app end-of-round tip — judgement call: no RCT compares individual scripts, but strategy+drill > drill-only is solid):
- 9s: "10 times it, minus one of it" (9×7 = 70−7)
- 8s: "double, double, double" (8×6: 12→24→48)
- 7s: "5s fact + 2s fact"; anchor 7×7=49 → 7×8 is one more 7
- 6s: "5s fact + one more" (6×n = 5n+n)

### Flag type 2 — ACCURATE BUT SLOW (counting, not recalling)

**No strategy teaching — she knows the facts; she needs retrieval reps under gentle pace.** Email prescribes a short **paced flashcard race**: same IR-style deck but all facts ~known, parent flips at a steady ~2-second beat; any hesitation → model-and-repeat, card goes back in. 5 minutes max. Plus: "mostly, just keep the daily app rounds going — speed comes from volume" (Fuchs 2010: deliberate practice is the causal lever; taped-problems-style pacing is what the app already does, so the parent adds warmth and live correction, not a new method). Do **not** send this flag to a session at all unless stagnant ≥2 weeks.

### Flag type 3 — CONCEPTUAL ERROR PATTERN (operation confusion, consistent bugs, decade errors)

This is the one flag where **explanation belongs** — and it belongs to the parent, never the app. Email:

> **Tom keeps answering 7×8 as 15 (adding instead of multiplying) — 4 times this week.**
> Tonight, 5–10 min with counters or drawn dots: lay out 7 rows of 8. Ask *"how many rows? how many in each? how many altogether?"* Count a couple of rows, then ask what 7×8 must be. Have him build 7×2 and 7×5 the same way. That's it — one model, no worksheet. The app will drill the facts once the idea has landed.

Basis: visual/concrete representations have strong support in *untimed instruction* contexts (WWC guide; Woodward's arrays and number lines lived in lessons); a consistent bug or operation confusion signals a cue-binding/procedural gap that reps alone won't fix, and McNeil 2025's hard rule — accuracy before timed practice — means the app should also drop those facts back to the untimed count-up phase automatically.

**Dosage for all types:** 5–10 minutes, 2–3 evenings/week, repeat until the app's own data clears the flag (≥90% accuracy, in-game latency under cutoff) — never one long weekend catch-up. Distributed brief practice beats the same minutes massed (Schutte 2015), and total dosage (sessions × weeks) is what predicts IR effects (Burns 2012). CCC worksheets (look-cover-write-compare) are the auto-attached fallback for nights no parent is available — effective (PND ~88–97%) but ranked second: the parent's unique value is live modeling, correction, and warmth.

---

## 4. KEY NUMBERS

| Number | What it anchors | Source | Status |
|---|---|---|---|
| KR d=0.05 / KCR d=0.32 / EF d=0.49; lower-order EF 0.37 ≈ KCR 0.31 | bare right/wrong is near-useless; correct-answer display is the workhorse | Van der Kleij et al. 2015, RER | supported (within-2015-dataset) |
| EF g≈0.71 even for recall; KCR ≈ EF only at high prior knowledge | mastery-gated one-line cue (EF for weak facts, KCR for fluent) | Mertens et al. 2022, JEP network MA (77 studies) | supported |
| Kids frequently skip elaborated error text; low achievers most | ≤8-word cue, 1-second readability ceiling | Maier & Klotz 2025, Contemp. Ed. Psych (log data) | supported (no time-pressure test — extrapolation) |
| d=1.08 extended facts, d=1.68 approximation; facts maintenance d=0.27 | strategy taught *outside* drill beats drill-only; visuals live in lessons | Woodward 2006, LDQ (n=58) | supported w/ caveats (taught-content confound) |
| Adult retrieval ~400–900ms (production ~700–1100ms); child retrieval ~1.6–2.8s vs counting ~4–6.7s | RT bins: fluent ≤2s initiation; 4–10s = probably counting | Rocket Math research summary; Geary et al. 2012 | supported |
| ~76% of child multiplication errors are table-related (adults ~87.5%) | error-type tagger; table confusion ≠ weak fact | Butterworth 2003; Campbell 1997 (via PMC4512035) | supported |
| Fluent = 9 of last 10 correct + per-child speed cutoff | per-fact fluent state | Math Facts Pro (deployed system) | practitioner convention |
| Mastery = 3-in-a-row; wheel-spinning = unmastered after 10 opportunities | stuck-fact rule; minimum observations | Beck & Gong 2013, ASSISTments (100k+ assignments) | supported |
| 3–4 consecutive below-aim data points before acting | ≥3 sessions / ≥3 days before emailing a flag | NCII CBM decision rules | supported |
| ~30–40 digits correct/min | absolute "on track" backstop | Poncy M.I.N.D. project | practitioner-research; judgement call |
| IR: NAP 98.9%, median d=1.67 (mostly reading content); active ingredient = opportunities-to-respond (d=2.46) not ratio (d=−0.16) | IR as default script; ship simple version | Burns et al. 2012; Szadokierski & Burns 2008 | supported w/ scope caveat |
| Parent tutoring ES 0.55 when structured; parents 0.23 SD vs teachers 0.50 in broad tutoring MA (pooled 0.288 published) | scripted email, modest expectations, app re-verifies | Erion 2006; Nickow et al. 2020/2024 | supported / corrected |
| Math-anxious parents' *frequent* homework help → less learning + more anxiety | 10-min cap, exit rule, no improvised explaining | Maloney et al. 2015, Psych Science | supported |
| Distributed brief practice > massed (equal retention); sessions × weeks predicts IR effects (23% variance) | 5–10 min, 2–3×/week dosage | Schutte 2015; Burns 2012 | supported |
| Grades 4–12 parent-tutoring evidence: "insufficient" | ages 10–11 = thin end of the evidence; frame sessions as supplement | 2023 updated systematic review, ETC | honest limitation |

**Explicit judgement calls (thin evidence, flagged as such):** the 8-word/15-second recap numbers; the 1.5× personal-median speed cutoff; the 20–30-attempt theme minimum; the 30–40 dcpm backstop as applied per-theme; the specific strategy script per table (no head-to-head RCTs — conventional wisdom on top of solid strategy+drill evidence); and any parent-session efficacy expectation at ages 10–11.