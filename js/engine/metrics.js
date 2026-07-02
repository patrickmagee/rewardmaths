/**
 * Parent metrics (docs/DESIGN.md §3): Westwood-normed fluency index,
 * growth slope, MTC band. Pure functions; honest caveats are part of the API.
 */
import { METRICS } from '../config.js';

/**
 * Fluency index SS = 100 + 15z from a sprint probe.
 * @param {number} correctPerMin  typed correct facts/min from the 60s sprint
 * @param {string} op             'add'|'sub'|'mul'|'div'
 * @param {number} ageMonths
 * @returns {{ ss: number, band: [number, number], extrapolated: boolean,
 *             label: string }}
 */
export function fluencyIndex(correctPerMin, op, ageMonths) {
    const norms = METRICS.WESTWOOD[op];
    const ageY = ageMonths / 12;
    const lo = norms[10], hi = norms[11];
    let mean, sd, extrapolated = false;
    if (ageY <= 10) { mean = lo.mean; sd = lo.sd; }
    else if (ageY <= 11) {
        const t = ageY - 10;
        mean = lo.mean + t * (hi.mean - lo.mean);
        sd = lo.sd + t * (hi.sd - lo.sd);
    } else {
        // Extrapolate past the norm ceiling: ~+2 facts/min per half-year,
        // widening uncertainty.
        extrapolated = true;
        const over = ageY - 11;
        mean = hi.mean + over * 4;
        sd = hi.sd * (1 + over * 0.5);
    }
    // Norms are written-test; typed runs ~30% lower → adjust the norm down.
    const typedMean = mean * METRICS.TYPED_ADJUST;
    const typedSd = sd * METRICS.TYPED_ADJUST;
    const z = (correctPerMin - typedMean) / typedSd;
    const ss = clamp(Math.round(100 + 15 * z), ...METRICS.SS_CLAMP);
    const half = extrapolated ? 10 : 6;
    return {
        ss,
        band: [clamp(ss - half, ...METRICS.SS_CLAMP), clamp(ss + half, ...METRICS.SS_CLAMP)],
        extrapolated,
        label: 'fluency index (home proxy — not a school standardised score)',
    };
}

/**
 * Weekly growth slope from sprint history.
 * @param {Array<{week: number, correctPerMin: number}>} weekly  medians per week
 * @returns {{ slope: number|null, status: 'provisional'|'green'|'amber'|'flat-at-mastery',
 *             points: number }}
 */
export function growthSlope(weekly, { mastered = false } = {}) {
    const pts = weekly.filter(w => Number.isFinite(w.correctPerMin));
    if (pts.length < METRICS.SLOPE_MIN_POINTS) {
        return { slope: leastSquares(pts), status: 'provisional', points: pts.length };
    }
    const slope = leastSquares(pts);
    if (slope >= METRICS.SLOPE_GREEN) return { slope, status: 'green', points: pts.length };
    const recent = pts.slice(-METRICS.SLOPE_FLAT_WEEKS);
    const flat = Math.abs(leastSquares(recent)) < METRICS.SLOPE_GREEN / 2;
    if (flat) {
        return { slope, status: mastered ? 'flat-at-mastery' : 'amber', points: pts.length };
    }
    return { slope, status: 'green', points: pts.length };
}

/**
 * MTC probe interpretation (band descriptors from published anchors; the
 * distribution ceilings, so no percentile pretence).
 * @param {number[]} scores  2-3 administrations out of 25
 */
export function mtcBand(scores) {
    if (!scores.length) return null;
    const med = medianOf(scores);
    const M = METRICS.MTC;
    let band;
    if (med >= 25) band = 'at ceiling — at least typical Y4 mastery (a floor, not a level)';
    else if (med >= M.median) band = 'above the England Y4 median (norm group is 1-2 years younger)';
    else if (med >= Math.round(M.mean)) band = 'around the England Y4 mean — for this age, a genuine gap signal';
    else band = 'below the England Y4 mean — worth targeted work on tables';
    return { median: med, outOf: M.questions, band,
        caveat: 'England MTC norms are for Year 4 (ages 8-9); for Tom/Eliza treat 25/25 as the target.' };
}

function leastSquares(pts) {
    if (pts.length < 2) return null;
    const n = pts.length;
    const sx = pts.reduce((s, p) => s + p.week, 0);
    const sy = pts.reduce((s, p) => s + p.correctPerMin, 0);
    const sxx = pts.reduce((s, p) => s + p.week * p.week, 0);
    const sxy = pts.reduce((s, p) => s + p.week * p.correctPerMin, 0);
    const denom = n * sxx - sx * sx;
    return denom ? (n * sxy - sx * sy) / denom : null;
}

function medianOf(xs) {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
