import { fluencyIndex, growthSlope, mtcBand } from '../js/engine/metrics.js';

export async function run({ eq, ok }) {
    // Worked examples from docs/research/01 (typed-adjusted norms):
    // Tom, age 10.0, multiplication. Written norm mean 13/min, SD 5.9 →
    // typed mean ≈ 9.1, SD ≈ 4.13. 13 typed facts/min → z ≈ +0.95 → SS ≈ 114.
    const tom = fluencyIndex(13, 'mul', 120);
    ok(tom.ss >= 110 && tom.ss <= 118, `Tom-like profile lands above average (${tom.ss})`);
    ok(!tom.extrapolated, 'age 10 is within norms');

    // Eliza, 11.0, slightly below the typed mean.
    const eliza = fluencyIndex(10, 'mul', 132);
    ok(eliza.ss >= 85 && eliza.ss <= 100, `Eliza-like profile slightly below average (${eliza.ss})`);

    // Past norm ceiling → extrapolated flag + wider band.
    const older = fluencyIndex(14, 'mul', 140);
    ok(older.extrapolated, 'age 11.7 is extrapolated');
    ok(older.band[1] - older.band[0] > tom.band[1] - tom.band[0], 'extrapolated band wider');

    // Clamping.
    eq(fluencyIndex(0, 'mul', 120).ss >= 60, true, 'SS clamped at 60');

    // Growth slope.
    const rising = Array.from({ length: 8 }, (_, w) => ({ week: w, correctPerMin: 8 + w * 0.4 }));
    eq(growthSlope(rising).status, 'green', 'rising slope green');
    const flat = Array.from({ length: 8 }, (_, w) => ({ week: w, correctPerMin: 9 }));
    eq(growthSlope(flat).status, 'amber', 'flat slope amber');
    eq(growthSlope(flat, { mastered: true }).status, 'flat-at-mastery', 'plateau at mastery is success');
    eq(growthSlope(rising.slice(0, 3)).status, 'provisional', 'few points = provisional');

    // MTC bands.
    ok(mtcBand([25, 25, 24]).band.includes('ceiling'), '25/25 = ceiling');
    ok(mtcBand([18, 19, 17]).band.includes('below'), 'sub-mean flagged');
}
