import { describe, it, expect, beforeEach } from 'vitest';
import {
    generateQuestion,
    resetLastQuestion,
    getCategoryDisplayName
} from '../../js/mathLevels.js';
import { DIFFICULTY_SETTINGS } from '../../js/config.js';

const ADD_CATEGORIES = ['add_easy', 'add_medium', 'add_hard'];
const SUB_CATEGORIES = ['sub_easy', 'sub_medium', 'sub_hard'];
const MUL_CATEGORIES = Array.from({ length: 11 }, (_, i) => `multiply_${i + 2}`); // 2..12
const ALL_CATEGORIES = [...ADD_CATEGORIES, ...SUB_CATEGORIES, ...MUL_CATEGORIES];

const ITERATIONS = 2000;

beforeEach(() => {
    resetLastQuestion();
});

describe('generateQuestion - structural validity (all categories)', () => {
    for (const category of ALL_CATEGORIES) {
        it(`${category}: produces well-formed question objects`, () => {
            for (let i = 0; i < ITERATIONS; i++) {
                const q = generateQuestion(category);
                expect(typeof q.text).toBe('string');
                expect(q.text.length).toBeGreaterThan(0);
                expect(typeof q.key).toBe('string');
                expect(Number.isFinite(q.answer)).toBe(true);
                expect(Number.isInteger(q.answer)).toBe(true);
            }
        });
    }
});

describe('addition - arithmetic correctness and operand ranges', () => {
    for (const category of ADD_CATEGORIES) {
        it(`${category}: answer = a + b with operands in range`, () => {
            const s = DIFFICULTY_SETTINGS[category];
            for (let i = 0; i < ITERATIONS; i++) {
                const q = generateQuestion(category);
                const m = q.text.match(/^(\d+)\s*\+\s*(\d+)$/);
                expect(m, `text not parseable: "${q.text}"`).not.toBeNull();
                const a = Number(m[1]);
                const b = Number(m[2]);

                // arithmetic
                expect(q.answer).toBe(a + b);

                // operand ranges
                expect(a).toBeGreaterThanOrEqual(s.min1);
                expect(a).toBeLessThanOrEqual(s.max1);
                expect(b).toBeGreaterThanOrEqual(s.min2);
                expect(b).toBeLessThanOrEqual(s.max2);
            }
        });
    }
});

describe('subtraction - arithmetic correctness, non-negative, operand ranges', () => {
    for (const category of SUB_CATEGORIES) {
        it(`${category}: answer = a - b, always >= 0, operands sane`, () => {
            const s = DIFFICULTY_SETTINGS[category];
            for (let i = 0; i < ITERATIONS; i++) {
                const q = generateQuestion(category);
                const m = q.text.match(/^(\d+)\s*-\s*(\d+)$/);
                expect(m, `text not parseable: "${q.text}"`).not.toBeNull();
                const a = Number(m[1]);
                const b = Number(m[2]);

                // arithmetic
                expect(q.answer).toBe(a - b);

                // always non-negative result
                expect(q.answer).toBeGreaterThanOrEqual(0);

                // minuend (num1) honours configured range
                expect(a).toBeGreaterThanOrEqual(s.min1);
                expect(a).toBeLessThanOrEqual(s.max1);

                // subtrahend (num2) stays positive, never above max2,
                // and never larger than the minuend (keeps result >= 0)
                expect(b).toBeGreaterThanOrEqual(1);
                expect(b).toBeLessThanOrEqual(s.max2);
                expect(b).toBeLessThanOrEqual(a);

                // When the configured range allows it (minuend large enough),
                // num2 honours the configured min2 lower bound. Guards against a
                // regression that always clamped the subtrahend down to 1.
                if (a - 1 >= s.min2) {
                    expect(b).toBeGreaterThanOrEqual(s.min2);
                }
            }
        });
    }
});

describe('multiplication - arithmetic correctness and operand constraints', () => {
    for (const category of MUL_CATEGORIES) {
        const table = Number(category.split('_')[1]);
        it(`${category}: answer = ${table} * multiplier (multiplier 1..12)`, () => {
            for (let i = 0; i < ITERATIONS; i++) {
                const q = generateQuestion(category);
                const m = q.text.match(/^(\d+)\s*×\s*(\d+)$/);
                expect(m, `text not parseable: "${q.text}"`).not.toBeNull();
                const x = Number(m[1]);
                const y = Number(m[2]);

                // arithmetic
                expect(q.answer).toBe(x * y);

                // the table number must be one of the displayed operands
                const operands = [x, y];
                expect(operands).toContain(table);

                // the multiplier is the other operand, within 1..12
                const multiplier = operands[0] === table ? operands[1] : operands[0];
                expect(multiplier).toBeGreaterThanOrEqual(1);
                expect(multiplier).toBeLessThanOrEqual(12);

                // answer = table * multiplier
                expect(q.answer).toBe(table * multiplier);
            }
        });
    }
});

describe('dedup - consecutive questions effectively never share a canonical key', () => {
    for (const category of ALL_CATEGORIES) {
        it(`${category}: consecutive-repeat rate stays far below 1%`, () => {
            resetLastQuestion();
            let prev = generateQuestion(category);
            let repeats = 0;
            for (let i = 0; i < ITERATIONS; i++) {
                const next = generateQuestion(category);
                if (next.key === prev.key) repeats++;
                prev = next;
            }
            // generateQuestion only retries up to maxAttempts (10) before
            // returning a possibly-repeating key, so it is a best-effort guard,
            // not an absolute invariant. Asserting an exact zero would be a
            // latent randomness-driven flake (smallest key space ~12 keys), so
            // assert the practical repeat rate is negligible instead.
            expect(repeats / ITERATIONS).toBeLessThan(0.01);
        });
    }
});

describe('multiplication commutative dedup (a×b and b×a share one key)', () => {
    it('canonical key is order-independent so swapped operands dedupe', () => {
        // Across many generations the display order varies (a×b vs b×a),
        // yet the canonical key is built from sorted operands. Verify that
        // every key for a given table uses sorted (lo x hi) form, which is
        // what makes the consecutive-repeat guard treat 5×3 and 3×5 as equal.
        for (const category of MUL_CATEGORIES) {
            resetLastQuestion();
            for (let i = 0; i < 1000; i++) {
                const q = generateQuestion(category);
                const km = q.key.match(/^mul:(\d+)x(\d+)$/);
                expect(km, `key not in canonical form: "${q.key}"`).not.toBeNull();
                const lo = Number(km[1]);
                const hi = Number(km[2]);
                expect(lo).toBeLessThanOrEqual(hi);

                // the canonical key's operands are exactly the displayed operands (sorted)
                const tm = q.text.match(/^(\d+)\s*×\s*(\d+)$/);
                const displayed = [Number(tm[1]), Number(tm[2])].sort((a, b) => a - b);
                expect([lo, hi]).toEqual(displayed);
            }
        }
    });

    it('5×3 and 3×5 map to the same canonical key (mul:3x5)', () => {
        // Drive the generator until we observe both display orders for the 3↔5
        // pairing within the multiply_5 table, and confirm identical keys.
        resetLastQuestion();
        const keysFor35 = new Set();
        let sawThreeFive = false;
        let sawFiveThree = false;
        for (let i = 0; i < 20000 && !(sawThreeFive && sawFiveThree); i++) {
            const q = generateQuestion('multiply_5');
            if (q.text === '3 × 5') { sawThreeFive = true; keysFor35.add(q.key); }
            if (q.text === '5 × 3') { sawFiveThree = true; keysFor35.add(q.key); }
        }
        expect(sawThreeFive).toBe(true);
        expect(sawFiveThree).toBe(true);
        // Both orders collapsed to exactly one canonical key
        expect(keysFor35.size).toBe(1);
        expect([...keysFor35][0]).toBe('mul:3x5');
    });
});

describe('getCategoryDisplayName', () => {
    it('addition labels', () => {
        expect(getCategoryDisplayName('add_easy')).toBe('Addition (Easy)');
        expect(getCategoryDisplayName('add_medium')).toBe('Addition (Medium)');
        expect(getCategoryDisplayName('add_hard')).toBe('Addition (Hard)');
    });

    it('subtraction labels', () => {
        expect(getCategoryDisplayName('sub_easy')).toBe('Subtraction (Easy)');
        expect(getCategoryDisplayName('sub_hard')).toBe('Subtraction (Hard)');
    });

    it('multiplication labels contain the table number', () => {
        expect(getCategoryDisplayName('multiply_7')).toContain('7');
        expect(getCategoryDisplayName('multiply_7')).toBe('7 Times Table');
        expect(getCategoryDisplayName('multiply_12')).toContain('12');
    });

    it('unknown category falls through to the raw id', () => {
        expect(getCategoryDisplayName('weird_thing')).toBe('weird_thing');
    });
});
