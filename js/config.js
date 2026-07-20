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
    /** Minimum valid attempts on a fact before median-relative bands apply. */
    MIN_ATTEMPTS_FOR_BANDS: 3,
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
    /** …AND median RT under personal cutoff = this × child's fluent-median. */
    FLUENT_CUTOFF_MULT: 1.5,
    /** Personal cutoff floor = this net thinking time + the child's measured
     *  typing baseline (per input method) — a slow typer isn't blocked. */
    FLUENT_CUTOFF_FLOOR_NET_MS: 2000,
    /** Assumed typing baseline before one is measured. */
    DEFAULT_TYPING_MS: 750,
    /** FLUENT→SLOW demotion needs ≥ this many of last 5 valid over cutoff. */
    DEMOTE_SLOW_OF_5: 2,
    /** UNKNOWN: recent accuracy below this (rolling last 5 valid). */
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
    /** Off-day: FLUENT-fact median RT > this × trailing 14-day FLUENT median… */
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
    /** Mixed-round weighting boost for SLOW facts. */
    SLOW_WEIGHT: 2.5,
    /** Times-table introduction order (convention, config-tunable). */
    TABLE_ORDER: [2, 10, 5, 3, 4, 6, 8, 7, 9, 11, 12],
    /** Add/sub ladder starting frontier (changed 2026-07-12, parent decision —
     *  see DESIGN §2): families below this start pre-unlocked (with their sub
     *  partners) as assumed prior knowledge for ages 10-11; placement + per-fact
     *  states catch any gaps below, warm-up/demotion handles struggle. */
    ADD_START_FAMILY: 'bridge-10',
    /** Placement sweep: exposures per fact needed before trusting the prior. */
    PLACEMENT_EXPOSURES: 2,
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
    /** Theme flag needs ≥ this many logged attempts. */
    MIN_ATTEMPTS: 24,
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
