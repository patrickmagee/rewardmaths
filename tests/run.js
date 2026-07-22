/** Minimal test runner: node tests/run.js */
const suites = [
    './facts.test.js',
    './retirement.test.js',
    './classify.test.js',
    './states.test.js',
    './scheduler.test.js',
    './adapt.test.js',
    './flags.test.js',
    './metrics.test.js',
    './derive.test.js',
    './game.test.js',
];

let pass = 0, fail = 0;
export function eq(actual, expected, msg) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) { pass++; }
    else { fail++; console.error(`  FAIL ${msg}\n    expected ${e}\n    got      ${a}`); }
}
export function ok(cond, msg) {
    if (cond) { pass++; }
    else { fail++; console.error(`  FAIL ${msg}`); }
}
/** Deterministic rng for tests. */
export function seededRng(seed = 42) {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

for (const path of suites) {
    const mod = await import(path);
    console.log(path);
    await mod.run({ eq, ok, seededRng });
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
