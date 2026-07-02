# Verdict: ADOPT-MODIFIED — the skateboard bar is permitted by the evidence, but only as a time-boxed, effort-priced, per-child campaign layered over the existing medal loop, never as the app's new economy

## 1. Verdict and the honest Deci reconciliation

**Decision: adopt-modified.** The parent's idea survives the science, but the version that survives is materially different from "a big 1000-point bar with a skateboard at the end."

**Does Deci 1999 forbid this?** No — and saying so requires reading the meta-analysis precisely, not just its headline. The reconciliation, using only verdicts that survived adversarial checking:

- **The undermining effect is real and the numbers stand** (verdict: supported). Expected tangible rewards undermine free-choice intrinsic motivation on *interesting* tasks: engagement-contingent d = −0.40 (worst), completion-contingent −0.36, performance-contingent −0.28; verbal praise *helps* (+0.31 to +0.33); unexpected rewards ≈ 0. Tangible rewards are *more* damaging for children than college students. A points-per-round scheme is nominally engagement/completion-contingent — the riskiest tangible category — for the most vulnerable age group. That is the case against.
- **But the boundary condition is common ground between both warring camps** (verdict: supported). Deci/Koestner/Ryan and Cameron/Banko/Pierce *agree* that undermining requires substantial initial intrinsic interest; on low-interest tasks rewards show no undermining and sometimes small positive free-choice effects. DKR themselves excluded boring tasks on the ground that there is little intrinsic motivation to undermine.
- **Which side of the boundary is timed arithmetic drill for a 10–11-year-old?** Plausibly the safe side (verdict: supported, with the hedge intact): maths intrinsic motivation shows the steepest decline of any CAIMI subject across ages 9–17 (Fullerton Longitudinal Study), so drill is low-to-moderate interest at this age. **But the risk is not zero** — Tom and Eliza demonstrably engage with the streaks and medals, and a skateboard is a tangible, expected, loosely performance-tied reward, exactly the class that undermines *when* interest is high. So the design must protect the residual game-enjoyment, not assume there is none.
- **Field evidence for children corroborates the low-risk reading** — with corrections applied. Fryer 2011's only significant positive achievement arm was input-based (Dallas, $2/book: ~+0.18 SD for English speakers — a subgroup result; city average ≈ 0), and *no study in this literature measured a loss of intrinsic motivation* (Fryer's surveys, Bettinger, NORC meta δ = −0.015 null; List et al. 2018's temporary crowd-out reversed within a year). But "inputs beat outputs" was never randomized head-to-head, and other input-incentive RCTs (Fryer's DC arm, the 10,000-pupil UK EEF trial) found no attainment effect. So expect **modest behavioural effects and no motivational damage**, not a transformation.
- **The honest weakness of the harm literature** (medium confidence): the −0.3/−0.4 ds come almost entirely from minutes of free-choice play after single lab sessions on interesting tasks; self-report interest effects are ~−0.15; there is no large preregistered multisite replication. The quantitative case that "a bounded goal will damage Tom and Eliza's maths motivation" is weaker than the citation count suggests.

**Which reading is better supported for THIS age and task?** The conditional one. For a low-to-moderate-interest drill task, with effort-contingent points carrying an accuracy floor, in a home token-economy setting, the totality of evidence says a *one-off, bounded* tangible goal is permissible and will not poison motivation — **provided** the exit is planned, because the one unambiguous finding in the token-economy literature (verdict: supported after correction) is that behaviour drops toward baseline when the programme is withdrawn without deliberate fading. The prior CLAUDE.md rule stands unchanged for the **core loop**: medals stay symbolic, never convertible. The skateboard is a separate, temporary overlay, not a repricing of the medals.

**The two real scientific objections — and they reshape the design, not veto it:**

1. **A distal reward alone is motivationally inert for this age group.** Bandura & Schunk 1981 (verdict: supported; the single most on-point RCT — children ~7–10, self-paced arithmetic): a distal goal was statistically indistinguishable from *no goal at all* on skill, self-efficacy AND intrinsic interest, while proximal per-session goals produced mastery and 90% free-choice arithmetic engagement vs ~40% in every other group. Children this age also discount delayed rewards steeply (robust vs adults; the vs-adolescents gradient is contested — corrected claim). Levitt et al. 2016: incentive power vanished with even a month's delivery delay. **A bare "Skateboard = 1000 points" bar is, per the best evidence, equivalent to nothing.** The daily bar movement, milestones, and instant point-posting must carry all the motivation; the skateboard is backdrop.
2. **The danger zone is the aftermath, not the pursuit.** Overjustification drops are measured *after* the rewarded period (Lepper 1973); token-economy withdrawal reliably decays behaviour without fading; post-reward reset slows effort toward any next goal. Plan the week after the skateboard before shipping the bar.

**One precondition (judgement call, flagged as such):** if a child is *already* playing daily and happily, the honest advice is to hold the bar in reserve as a rescue tool for a motivation slump rather than spend it on an already-healthy loop. Run it for the child whose play frequency is below their own norm.

---

## 2. Calibration formula

The parent asked how to set the target. Answer: **the parent should not set a points number at all — the parent sets the reward and a target date; the app computes the points from the child's own KV score history.** This is directly supported by the adaptive-goal RCT literature (adaptive, baseline-anchored goals beat static prescribed goals; adult samples, direction likely generalises) and answers "the right edge of motivation" with data instead of a guess.

### Horizon
- **3–4 weeks of expected play for a first goal; hard cap 6 weeks (~42 days).** Basis: steep delay discounting at 9–11; child reward-delivery paradigms tested only to ~1 month; token-economy exchange guidance (daily–weekly, lengthening gradually); token programmes' effective window ~2–8 weeks. Toward 3 weeks for Eliza (lower expectancy reserve).
- A bigger reward = a **chain** of 3–4-week goals (deck → trucks → wheels), never one 3-month bar.

### Point pricing (effort-with-accuracy-floor, never raw score)
- **10 pts per round completed with ≥50% accuracy** (the existing medal floor blocks clock-punching)
- **+3 silver day, +5 gold day** — modest medal weighting so accuracy matters at the margin but a diligent low scorer still moves every day
- **Small mastery bonuses** (new personal best, first perfect 10 in a category) — these inject competence information, shifting the reward from pure attendance wage toward the performance-with-competence-feedback cell that shows the least undermining
- **No speed or high-score bonuses.** That converts the bar into an output incentive (weak evidence of effect for children) and loads performance pressure onto Eliza.
- **Points never decrease.** Loss framing is statistically the stronger motivator (Levitt; EEF) — do not use it in a family app; it is controlling-salient and corrosive at home.

### Target formula (implement in the admin dashboard)
```
recommended_target = mean(points/play-day, trailing 14–21 days from KV)
                   × planned play-days (20–25 under the 5-of-7 model)
                   × 1.1–1.2 stretch
```
The 1.1–1.3 stretch factor is an inference from moderate-difficulty goal-setting theory, **not a measured constant** — judgement call, flagged. Warn (don't block) if the parent's override implies >6 weeks at observed pace; if pace projection ever exceeds the cap mid-campaign, the app tells the *parent* to lower the target — never exhorts the child.

**Worked example (Eliza):** ~1.5 rounds/day ≈ 18 pts/day → 18 × 22 × 1.15 ≈ **450 points**, pre-filled to 60, milestones ~115/230/340, projected finish ~3.5 weeks. Tom gets his own separately computed target for his own reward item. Same effort ⇒ same fill rate; different totals are invisible because each child only ever sees their own bar.

### Bar mechanics (each element sourced)
| Mechanic | Spec | Basis |
|---|---|---|
| Daily visibility | Streak-floor round moves bar ≥2–3%; typical day 4–6% | Bandura & Schunk — a pixel-invisible increment reproduces the inert distal condition |
| Instant posting | Points animate onto the bar at round end, same screen as score ("+13 → 448/1000") | Levitt et al.: delay kills incentive power; token = immediate bridge to delayed backup |
| Milestones | Ticks every 20–25% (~weekly), each with symbolic celebration + verbal praise — never stuff | Converts one long middle into 4–5 short goal-gradients; bridges the mid-bar slump (lab finding, framing-dependent — corrected claim) |
| Endowed head start | Pre-fill 10–15%, framed as **credit for real prior play** from KV history ("Starter bonus: 60 pts for last week's practice") | Nunes & Drèze 19%→34% completion — direction solid, near-doubling magnitude is one field study and the effect shrinks without a stated reason, hence the honest framing |
| Dynamic caption | <50%: "You've earned 320 points!" (to-date); >50%: "Only 130 to the skateboard!" (to-go); sharpen skateboard image past 75% | Koo & Fishbach small-area hypothesis; Huang et al. — adult samples, medium confidence |
| Projected finish | "At this pace: ~12 days to go" | Expectancy-value: visible attainability is the lever, especially for Eliza |

### Parent UI flow
1. Parent picks a **reward menu** (no money, no screen time — pure exchange framing; kit/activity fine, maths-adjacent better) and a target date 3–6 weeks out.
2. **Child picks the prize from the menu** and agrees the target with the parent — participation raises commitment and moves the SDT framing from controlling toward autonomous at zero evidence cost.
3. App computes and displays the target + projected finish; parent confirms. No free-text points box.

---

## 3. Guardrails

**Post-skateboard cliff (the norm, not a failure).** Behaviour returns toward baseline after backup-reward withdrawal — the best-documented weakness of token systems. Build the exit before launch: completion → celebration state → **2–4 week mandatory no-goal cooldown** on plain medals/streaks → medals-only steady state. The award moment emphasises the *skill* ("you earned this by getting fast at your 7s and 8s"), delivered with praise — competence-informational, per Marinak & Gambrell's reward-proximity result (single study, medium). Do **not** chain into a bigger prize.

**Sibling comparison (worst-case configuration alert).** Eliza — older and weaker — watching younger Tom finish first is close to the documented worst case for academic self-concept (contrast effects; parental comparative framing predicts worse adjustment — correlational-longitudinal, but nothing countervails). Rules: one bar per child, visible **only on that child's logged-in screen**; no shared view, no leaderboard; different prizes; targets set so neither child structurally finishes first; effort-based earning means equal effort = equal fill rate. The admin dashboard must not surface the children's bars to each other.

**Reward inflation / "no prize, no practice."** Practitioner-documented, not quantified — but the anti-escalation rules are cheap: at most one active goal per child; mandatory cooldown; wizard warns if a new prize's implied target exceeds the last (inflation check); treat the whole thing as a **rare campaign, 1–2 per year**, never the steady state. Expect some "what do I get?" bargaining afterwards — that, plus baseline reversion, is the realistic downside; permanently poisoned maths motivation is not what the field data show.

**Expectancy collapse (Eliza-specific).** Maths expectancy beliefs are already in secular decline sharpest around grades 6–7 — exactly age 11. If her subjective probability of reaching the goal nears zero, effort collapses regardless of prize value (multiplicative expectancy × value). Mitigations: her target derives from *her* baseline; the daily floor (1 round, 5-of-7) must visibly move her bar; projected-finish cue keeps attainability salient; if projection blows the cap the app flags the parent.

**Gaming.** The ≥50% accuracy floor already blocks pure clock-punching. Keep system-picked rounds adapting so typical accuracy sits ~80–90% (heuristic band — the "85% optimal error rate" is a gradient-descent result, not a human RCT; don't treat it as law). Optionally cap points-earning rounds per day (e.g. first 3) to prevent binge-then-abandon.

**Framing rules (exact).** All bar copy is celebration-of-effort, never contract language: "Your practice is stacking up!" — never "do X to get your skateboard." No deductions, ever. Verbal praise remains the dominant feedback channel (the one reward type at +0.31/+0.33). Coach the parent in the goal-setup UI: present it as *"we noticed how hard you've been practising — let's celebrate it with something you want,"* not as payment terms. Informational vs controlling salience is what determines undermining with contingency held constant (Ryan, Mims & Koestner 1983; college samples, theory-driven extrapolation).

**Instrument it.** Treat Tom and Eliza as an n-of-2 pilot: rounds/day already flow to KV — compare before/after, watch for the 40–60% mid-bar slump and the post-redemption dip, and let the parent tune milestone spacing from the dashboard. Popular "streaks boost commitment 60%" numbers are vendor marketing; the family's own data is better evidence than any blog.

---

## 4. Key numbers

| Finding | Number | Source | Status |
|---|---|---|---|
| Expected tangible rewards, free-choice IM (interesting tasks) | d = −0.40 engagement / −0.36 completion / −0.28 performance; children > college students for harm | Deci, Koestner & Ryan 1999, *Psych Bulletin* 125(6) | Supported |
| Verbal praise on IM | +0.31 (interest) / +0.33 (free-choice) | DKR 1999 | Supported |
| Low-interest tasks: reward undermining | ≈ 0, sometimes positive — conceded by both camps | Cameron, Banko & Pierce 2001, *Behavior Analyst* 24 | Supported |
| Distal goal alone, children ~7–10, self-paced maths | = no goal at all on skill/self-efficacy/interest; proximal: 90% vs ~40% free-choice maths | Bandura & Schunk 1981, *JPSP* 41:586–598 | Supported (n=40) |
| Delay kills incentives | Immediate rewards +0.12–0.25 SD test effort; 1-month delay → zero; trophies > cash for grades 2–5 | Levitt et al. 2016, *AEJ: Policy* | Unverified-consistent |
| Input incentive, young children | Dallas $2/book: +0.17–0.22 SD reading, **English speakers only**; city averages ≈ 0; no IM loss anywhere (NORC δ = −0.015) | Fryer 2011, *QJE* 126(4) | Corrected/overstated |
| UK effort incentives, low prior-attainers, maths, non-cash | +0.13 SD (~2 months' progress) — Eliza's exact profile; overall GCSE null | EEF "Increasing Pupil Motivation" 2014 (63 schools, >10k pupils) | Unverified-consistent |
| Token economies while active (ages 6–15) | Weighted ES 0.82; post-withdrawal decay is the classic failure mode; fix = fading, not stop | Soares et al. 2016, *School Psych Review*; Kazdin & Bootzin 1972 | Supported (corrected) |
| Endowed progress | 19% → 34% completion with 2-pre-stamped card (identical effort) | Nunes & Drèze 2006, *JCR* 32 | Direction supported; magnitude = 1 study, adults |
| Adaptive vs static goals | Attainment 30–40% vs 15–25%; behaviour decay less than half the static rate | WalkIT RCTs 2017/2018 | Unverified; adults |
| Recommended horizon | 3–4 weeks expected play, cap 6 weeks; milestones every 20–25%; head start 10–15%; stretch ×1.1–1.2 | Synthesis | **Engineering from evidence, not RCT-tested — judgement call** |

**Bottom line for the parent:** yes — but you don't calibrate "1000 points" by feel. You pick the skateboard and a date ~4 weeks out; the app prices the points from the child's own last two weeks of play so the daily minimum visibly moves the bar every day; the bar is private, chunked weekly, pre-seeded with earned credit, effort-priced with the accuracy floor; and the plan for the week *after* the skateboard is written down before the bar ships. Done that way once or twice a year, the realistic outcome is 4–6 weeks of elevated daily practice that consolidates fact fluency — a skill that persists even when motivation reverts to baseline — with no credible evidence of lasting motivational harm.