/**
 * RewardMaths v5 — ALL tunable engine constants.
 *
 * Every threshold in the engine lives here, fixed a priori per docs/DESIGN.md.
 * Do not re-tune after seeing a child's data (researcher-degrees-of-freedom
 * problem); revisit only from a child's own logged distributions ~4-6 weeks in,
 * and record any change in docs/DESIGN.md.
 */

export const RT = {
    /** Question auto-advances (timeout) at this many ms. Default per DESIGN §2;
     *  parent-tunable per child via settings.ceilingMs, clamped to the bounds
     *  below. The value in force is stamped on each answer as ceiling_ms, so
     *  changing it never reclassifies already-logged attempts.
     *  40s (2026-07-20): 12s was cutting off genuine work — Eliza timed out on
     *  24 of 42 questions with zero fast answers. The ceiling exists to catch
     *  a walked-away tablet, not to hurry a thinking child. */
    HARD_CEILING_MS: 40000,
    HARD_CEILING_MIN_MS: 6000,
    HARD_CEILING_MAX_MS: 60000,
    /** initiation_ms below this = anticipation → full discard. */
    ANTICIPATION_FLOOR_MS: 300,
    /** wrong AND initiation_ms below this = rapid guess → non-evidence. */
    RAPID_GUESS_MS: 500,
    /** correct AND RT > this × fact median = lapse-suspect (accuracy-only). */
    LAPSE_MEDIAN_MULT: 3,
    /** Valid-band ceiling = min(HARD_CEILING_MS, this × fact median). */
    VALID_MEDIAN_MULT: 4,
    /** Minimum valid attempts on a fact before median-relative bands apply.
     *  5 (2026-07-20): a per-fact median on 3 attempts is close to noise given
     *  the right-skew of single-trial RT (Geary 2012: M=2789ms, SD=1892). */
    MIN_ATTEMPTS_FOR_BANDS: 5,
    /** First-ever correct faster than this (net of typing) needs a second
     *  fast-correct before crediting fluency. */
    SUSPICIOUS_FAST_NET_MS: 700,
    /** Session voided for state updates: ≥ this many exclusions in one round… */
    VOID_EXCLUSIONS_PER_ROUND: 3,
    /** …or > this fraction excluded across the session. */
    VOID_EXCLUSION_RATE: 0.20,
    /** Admin alarm if weekly exclusion rate exceeds this. */
    ALARM_EXCLUSION_RATE: 0.12,
};

export const STATES = {
    /** FLUENT: this many of the last 10 valid attempts correct… */
    FLUENT_CORRECT_OF_10: 9,
    /**
     * …AND median INITIATION time under a personal cutoff = this × the child's
     * own fluent-median (floored at FLUENT_CUTOFF_FLOOR_NET_MS).
     *
     * 1.5, and it must stay 1.5, because it is the SAME multiplier the floor
     * is derived with: DESIGN §2 sets the floor at published fluent medians
     * (Van Beek 1707ms, Dickson 1438ms) × ~1.5. The floor is therefore
     * "1.5 × a typical fluent median" and the personal term is "1.5 × THIS
     * child's fluent median". One multiplier, one meaning — a cutoff is 1.5×
     * a fluent median, and only the median changes.
     *
     * 2.0 was tried on 2026-07-20 and reverted the same day. Because the
     * cutoff is self-referential (the fluent set is defined by the cutoff),
     * its fixed point is ≈MULT × the child's own median, so the multiplier
     * decides how much of a child's own distribution passes. Measured on the
     * fixed point:
     *
     *   child median init | 2.0 → cutoff (% passing) | 1.5 → cutoff (% passing)
     *   1100ms            | 2500ms (96%)             | 2500ms (96%)
     *   1800ms            | 3433ms (92%)             | 2500ms (77%)
     *   2900ms            | 5531ms (92%)             | 3316ms (61%)
     *   4200ms            | 8011ms (92%)             | 4803ms (61%)
     *
     * At 2.0 the pass rate is ~92% for EVERY child however slow — the
     * criterion stops discriminating and simply ratifies whatever the child
     * already does. At 1.5 it degrades with slowness, which is the point of
     * having it. 2.0 also pushed the effective cutoff for a mid-range child
     * past Wu et al. 2008's 3662ms ROC optimum, which DESIGN §2 explicitly
     * argues we must stay BELOW (Wu's sample was age 8.05 and timed by
     * experimenter keypress) — an internal contradiction, not a trade-off.
     */
    FLUENT_CUTOFF_MULT: 1.5,
    /**
     * Personal cutoff floor, applied to initiation_ms ONLY (question shown →
     * first keypress). Typing is excluded from classification entirely: we are
     * not measuring keyboard speed, and typing time scales with answer digit
     * count (measured on Tom's log: 1-digit 130ms, 2-digit 652ms, 3-digit
     * 1113ms), which is confounded with problem size — a total-RT threshold
     * penalises hard facts twice and paints the top-right of every grid amber.
     *
     * 2500ms (2026-07-20, was 2000ms net + typing baseline ≈ 2750ms total):
     * anchored on the upper fluent latency for this age measured with minimal
     * motor output — Van Beek et al. (2014, voice key, mean age 11.9) large
     * additions 1707ms (±415); Dickson et al. (2022, gamepad, grades 3-5)
     * large multiplications 1438ms (SE 62) — times 1.5. Lands inside the
     * age-matched commercial band (Prodigy Grade 6+ 3s, TTRS Rock Star 3s)
     * and below Wu et al. (2008) ROC optimum 3662.5ms, correctly, since Wu's
     * sample was mean age 8.05 and timed by experimenter keypress.
     * Measuring on first-press is what the one age-matched tablet study does
     * (npj Science of Learning 2025, n=824). See docs/DESIGN.md §2.
     */
    FLUENT_CUTOFF_FLOOR_NET_MS: 2500,
    /** Problem-size allowance added to the cutoff where both operands ≥ 6.
     *  Large facts are genuinely slower even when retrieved (Dickson et al.
     *  2022 measured a 317ms problem-size effect in grades 3-5). */
    LARGE_FACT_ALLOWANCE_MS: 300,
    /** Both operands ≥ this counts as a large fact. */
    LARGE_FACT_MIN_OPERAND: 6,
    /** Assumed typing baseline before one is measured. Dashboard/diagnostics
     *  only — it no longer feeds the classifier. */
    DEFAULT_TYPING_MS: 750,
    /** FLUENT→SLOW demotion needs ≥ this many of last 5 valid over cutoff.
     *  3 (2026-07-20): promotion tests a median of 10, so demoting on 2 raw
     *  attempts out of 5 was a much weaker standard than promotion — on a
     *  right-skewed RT distribution a genuinely fluent fact tripped it on
     *  roughly a coin flip per window. */
    DEMOTE_SLOW_OF_5: 3,
    /** UNKNOWN: recent accuracy below this (rolling last 5 valid).
     *  At or above it, a fact with too little history is UNSETTLED, not SLOW. */
    UNKNOWN_ACCURACY: 0.80,
    /** STUCK: ≥ this many attempts without 3-in-a-row correct… */
    STUCK_MIN_ATTEMPTS: 10,
    /** …or accuracy below this over last 10. */
    STUCK_ACCURACY_OF_10: 0.60,
    /** Rolling window sizes. */
    WINDOW_SHORT: 5,
    WINDOW_LONG: 10,
    /** A state assignment needs attempts spanning ≥ this many distinct days. */
    MIN_DISTINCT_DAYS: 2,
};

export const ADAPT = {
    /** EMA smoothing: M ← (1-ALPHA)·M + ALPHA·P_day, applied once per day. */
    EMA_ALPHA: 0.25,
    /** Minimum classified items from a family in a day to compute P_day. */
    MIN_ITEMS_PER_DAY: 6,
    /** Promote family when EMA ≥ this (plus mastery-gate conditions). */
    PROMOTE_EMA: 0.85,
    /** …AND ≥ this fraction of circulating facts FLUENT/SLOW… */
    PROMOTE_FACTS_OK: 0.80,
    /** …sustained across ≥ this many sessions on ≥ as many distinct days. */
    PROMOTE_MIN_DAYS: 2,
    /** Demote only when EMA < this AND raw P_day < this… */
    DEMOTE_FLOOR: 0.70,
    /** …on ≥ this many sessions over ≥ as many distinct days (≥1 not off-day). */
    DEMOTE_MIN_DAYS: 3,
    /** Off-day: FLUENT-fact median INITIATION > this × trailing 14-day FLUENT
     *  median initiation… (initiation-only since 2026-07-21, matching the state
     *  machine — a keyboard→tablet typing jump must not fake an off-day). */
    OFFDAY_RT_MULT: 1.5,
    /** …or FLUENT-fact accuracy below this. */
    OFFDAY_FLUENT_ACCURACY: 0.70,
    /** Trailing window for the off-day RT baseline, days. */
    OFFDAY_BASELINE_DAYS: 14,
    /** Within-session controller: after this many consecutive misses
     *  (or CONTROLLER_OF_5 in last 5), known share → CONTROLLER_KNOWN_SHARE. */
    CONTROLLER_CONSECUTIVE: 2,
    CONTROLLER_OF_5: 3,
    CONTROLLER_KNOWN_SHARE: 0.95,
};

export const SCHEDULER = {
    QUESTIONS_PER_ROUND: 10,
    /** Max correct retrievals per weak fact per day; then stop serving it. */
    MAX_RETRIEVALS_PER_FACT_PER_DAY: 3,
    /** Unknown facts in circulation per child (parent-tunable per child). */
    UNKNOWN_CIRCULATION_DEFAULT: 4,
    UNKNOWN_CIRCULATION_MIN: 3,
    UNKNOWN_CIRCULATION_MAX: 6,
    /** Focus round: share of known facts (incremental-rehearsal shape). */
    FOCUS_KNOWN_SHARE: 0.8,
    /** Focus round opens with this many of the child's fastest facts. */
    MOMENTUM_OPENERS: 2,
    /** Distinct weak facts targeted per focus round. */
    FOCUS_WEAK_FACTS: 3,
    /** Total weak-fact question slots per round (~20-30% of 10; the rest of
     *  the within-round repetition comes from requeue-on-miss). */
    FOCUS_WEAK_SLOTS: 3,
    /** Blocked warm-up on a new family/table until accuracy ≥ this. */
    BLOCKED_UNTIL_ACCURACY: 0.85,
    /** Timer stays count-up until table/family accuracy ≥ this. */
    UNTIMED_UNTIL_ACCURACY: 0.90,
    /** Mastered table resurfaces in review at least every N days. */
    REVIEW_MAX_GAP_DAYS: 14,
    /** Individual fact unseen this long → silently reinjected into mixed. */
    FACT_STALE_DAYS: 24,
    /** Break > this long → short disguised re-triage before resuming. */
    RETRIAGE_AFTER_BREAK_DAYS: 14,
    /**
     * Mixed-round weighting boost for facts unseen for FACT_STALE_DAYS.
     * Was SLOW_WEIGHT, and also boosted facts the child answered correctly but
     * slowly. Speed no longer influences what a child is served at all (parent
     * decision 2026-07-20 — "it's training, not a test"): a fact answered
     * correctly is known, whether recalled or worked out, and being slow must
     * not earn a child extra drilling. SLOW is still derived and still shown on
     * the parent's fact map; it just has no say in scheduling.
     */
    STALE_WEIGHT: 2.5,
    /** Mixed-round weight for UNSETTLED facts. NOT a speed judgement — these
     *  facts simply need more attempts before any verdict is possible, and this
     *  is the nudge that gets them there. */
    UNSETTLED_WEIGHT: 1.5,
    /** Times-table introduction order (convention, config-tunable). */
    TABLE_ORDER: [2, 10, 5, 3, 4, 6, 8, 7, 9, 11, 12],
    /** Add/sub ladder starting frontier (changed 2026-07-12, parent decision —
     *  see DESIGN §2): families below this start pre-unlocked (with their sub
     *  partners) as assumed prior knowledge for ages 10-11; placement + per-fact
     *  states catch any gaps below, warm-up/demotion handles struggle. */
    ADD_START_FAMILY: 'bridge-10',
    /** Placement sweep: exposures per fact needed before trusting the prior. */
    PLACEMENT_EXPOSURES: 2,
    /** Retirement (docs/DESIGN.md §2 "Retirement"): a single-digit add/sub
     *  family this many rungs below the child's frontier drops to maintenance —
     *  it stops being everyday practice and only resurfaces occasionally. Keeps
     *  a child who has moved on to two-digit work from being fed +0/+1 forever.
     *  Two-digit families and times tables are never retired. */
    RETIRE_DISTANCE: 2,
    /** Retired facts injected into a mixed round as light maintenance
     *  ("occasional single-digit"), stalest first. */
    MAINTENANCE_SLOTS: 2,
    MAINTENANCE_WEIGHT: 0.5,
};

export const DAY = {
    /** Rounds per medal tier. */
    BRONZE_ROUNDS: 2,
    SILVER_ROUNDS: 4,
    GOLD_ROUNDS: 6,
    /** Bronze on an easy day. */
    EASY_DAY_BRONZE_ROUNDS: 1,
    /** Exactly one easy day per rolling window of this many days, random slot. */
    EASY_DAY_WINDOW: 7,
    /** Streak survives on any 1 completed round. */
    STREAK_MIN_ROUNDS: 1,
    /** Auto streak-shields per week (5-of-7 model). */
    SHIELDS_PER_WEEK: 2,
    /** Repair window after a full break, hours; repair = this many rounds. */
    REPAIR_WINDOW_H: 48,
    REPAIR_ROUNDS: 2,
    /** Streak milestones (days). */
    MILESTONES: [3, 7, 30, 60],
    /** Break prompt after this many consecutive rounds. */
    BREAK_AFTER_ROUNDS: 3,
    /** Fatigue: round median RT this much slower than round 1 → early break. */
    FATIGUE_RT_MULT: 1.25,
    /** Goal reveal attainability gate: only reveal a bronze hit on ≥ this
     *  fraction of recent days. */
    REVEAL_ATTAINABILITY: 0.70,
    /** Sprint (weekly benchmark) round length, ms. */
    SPRINT_MS: 60000,
};

export const FLAGS = {
    /**
     * Minimum window sample for a theme to be judged at all: below this a
     * 'watching' note is the most the dashboard will say, and no flag can
     * escalate. A deficit still has to be measured on something.
     *
     * There is deliberately no HIGH attempt bar any more (MIN_ATTEMPTS = 24 was
     * removed 2026-07-20, see DESIGN §3). Recent exposure is chosen by the
     * scheduler, and the scheduler serves weak themes LESS (UNKNOWN facts are
     * excluded from mixed rounds and rationed to FOCUS_WEAK_FACTS per focus
     * round), so ANY volume gate — windowed or cumulative — is anti-correlated
     * with the weakness it gates on. Measured: a weak theme's facts carry 4.1
     * attempts each against a healthy theme's 10.0. Escalation is decided by
     * the per-fact state DISTRIBUTION instead, gated on calendar time.
     */
    MIN_ATTEMPTS_WATCHING: 5,
    /**
     * A fact counts as DURABLY weak only if the child has failed it on ≥ MIN_DAYS
     * distinct days spanning ≥ this many calendar days. Calendar span, never
     * attempt count: span is the one field the scheduler cannot allocate.
     *
     * 7 is inherited, not chosen — it is MIN_FLAG_DAYS, the minimum life of a
     * flag. A fact has to have been failing for at least as long as the flag it
     * would raise is required to last. This is the gate that separates "failing
     * for weeks" from "introduced on Tuesday": measured span for a genuinely
     * weak fact is 18-20 days, for a newly-introduced one 2-5.
     */
    DURABLE_MIN_SPAN_DAYS: 7,
    /** A theme needs at least this many durably-weak facts. Inherited from
     *  MIN_DAYS: the window criterion demands three independent days before it
     *  believes a deficit, so the structural criterion demands three independent
     *  FACTS. One or two failing facts is a fact problem, not a theme problem. */
    MIN_DURABLE_WEAK_FACTS: 3,
    /**
     * Escalation needs at least this share of the theme's facts durably weak.
     *
     * 0.80 = ADAPT.PROMOTE_FACTS_OK, the mastery gate, read backwards: the
     * ladder calls a family learned when ≥80% of its circulating facts are
     * accurate, so a theme is failing when ≥80% of its facts are durably not.
     * One criterion, one number, pointing in two directions.
     *
     * A simple majority (the 0.5 this replaced on 2026-07-20) does NOT work
     * here, and the reason is structural rather than empirical: every learner
     * has a frontier, and a not-yet-taught table is by definition mostly
     * unlearned. "More weak than not" therefore describes the curriculum edge
     * as accurately as it describes a broken theme. Only near-total failure
     * separates them.
     */
    WEAK_FACT_SHARE: 0.80,
    /** …AND that share must exceed the child's OWN durable-weak share across
     *  comparable themes (tables vs tables, ladder families vs families) by this
     *  margin. Without the relative term the structural test is an absolute
     *  difficulty threshold and flags every frontier table — "not taught yet"
     *  read as "failing". The margin is inherited from ACCURACY_DEFICIT: it is
     *  the same "this far below the child's own baseline" construct, applied to
     *  the fact-state distribution instead of to a fortnight's accuracy. */
    WEAK_SHARE_DEFICIT: 0.15,
    /** …AND theme accuracy this far below the child's same-week overall… */
    ACCURACY_DEFICIT: 0.15,
    /** …or theme median RT ≥ this × child's overall median. */
    RT_RATIO: 1.75,
    /** …persisting across ≥ this many sessions on ≥ as many distinct days. */
    MIN_DAYS: 3,
    /** Resolved when ≥ this fraction of theme facts FLUENT. */
    RESOLVED_FLUENT_SHARE: 0.65,
    /** Flag expires if not re-confirmed within this many days. */
    EXPIRE_DAYS: 14,
    /** A theme stays flagged at least this long (rate-limits emails). */
    MIN_FLAG_DAYS: 7,
    /** Stagnation: no median-RT improvement over this many days of play. */
    STAGNATION_DAYS: 14,
    /** Absolute backstop: on-track needs ≥ this digits-correct/min equiv… */
    BACKSTOP_DCPM: 30,
    /** …and ≥ this accuracy. */
    BACKSTOP_ACCURACY: 0.90,
};

export const METRICS = {
    /**
     * Westwood One Minute Basic Number Facts Tests norms (1995, ages to 11.0).
     * mean facts/min at age (years); SD ≈ half-width of the published
     * "normal range" / 0.68 (the range is ±0.68 SD — middle ~50%).
     * Interpolate by age in months; extrapolate past 11.0 with widening band
     * and an "extrapolated" flag (~+2 facts/min per half-year).
     */
    WESTWOOD: {
        add: { 10: { mean: 20.5, sd: 5.9 }, 11: { mean: 23.5, sd: 5.1 } },
        sub: { 10: { mean: 16.5, sd: 6.6 }, 11: { mean: 21.0, sd: 5.9 } },
        mul: { 10: { mean: 13.0, sd: 5.9 }, 11: { mean: 17.0, sd: 5.9 } },
        div: { 10: { mean: 9.0, sd: 5.9 }, 11: { mean: 13.0, sd: 7.4 } },
    },
    /** Typed scores run ~30% below written norms (Hensley 2017). */
    TYPED_ADJUST: 0.70,
    SS_CLAMP: [60, 140],
    /** Suppress the index until this many sprint probes exist; show median. */
    MIN_PROBES: 3,
    /** Growth slope: green ≥ this (typed facts/min/week)… */
    SLOPE_GREEN: 0.25,
    /** …amber if flat this many weeks on a non-mastered theme. */
    SLOPE_FLAT_WEEKS: 4,
    /** Slope provisional until this many weekly points. */
    SLOPE_MIN_POINTS: 6,
    /** MTC probe: England 2024 anchors (Year 4): mean 20.6/25, median 23,
     *  34% full marks. Used for band descriptors, not a percentile table. */
    MTC: { questions: 25, windowMs: 6000, mean: 20.6, median: 23, fullMarksShare: 0.34 },
};

export const BIG_GOAL = {
    POINTS_PER_ROUND: 10,
    SILVER_BONUS: 3,
    GOLD_BONUS: 5,
    STRETCH: 1.15,
    HORIZON_DAYS_DEFAULT: 25,
    HORIZON_DAYS_MAX: 42,
    HEAD_START_SHARE: 0.12,
    MILESTONES: 4,
    COOLDOWN_DAYS: 21,
};
