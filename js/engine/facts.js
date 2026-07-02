/**
 * Fact universe: times tables 2-12 plus the addition/subtraction fact-family
 * ladder (docs/DESIGN.md §2, docs/research/05). Pure data + pure functions.
 *
 * A fact is identified by its directed id ("7x8", "8+5", "13-9").
 * Commuted multiplication/addition pairs are distinct facts for presentation
 * but share a canonical key for flagging/state pooling.
 */

/** Addition/subtraction ladder families, in unlock order. */
export const ADD_FAMILIES = [
    'add-0-1',        // 1  +0 / +1
    'add-2',          // 2  +2
    'doubles-small',  // 3  doubles to 5+5
    'near-doubles',   // 4  doubles ±1
    'make-10',        // 5  pairs summing to 10
    'doubles-big',    // 6  6+6 … 9+9
    'bridge-10',      // 7  sums 11-18 crossing 10
    'add-rest',       // 8  leftover single-digit facts
    'td-ones',        // 9  two-digit + ones, no crossing
    'td-tens',        // 10 two-digit ± tens
    'td-ones-cross',  // 11 two-digit ± ones crossing the decade
    'td-td',          // 12 two-digit ± two-digit, no carry
    'td-td-carry',    // 13 with carry/borrow
];

/** Subtraction family partner of each addition family (unlocks after it). */
export const SUB_PARTNER = {
    'add-0-1': 'sub-0-1', 'add-2': 'sub-2', 'doubles-small': 'sub-doubles-small',
    'near-doubles': 'sub-near-doubles', 'make-10': 'sub-make-10',
    'doubles-big': 'sub-doubles-big', 'bridge-10': 'sub-bridge-10',
    'add-rest': 'sub-rest',
    // two-digit families mix ± within the family; no separate partner
};

/** @returns {string} directed fact id */
export function factId(a, op, b) {
    const sym = { mul: 'x', add: '+', sub: '-' }[op];
    return `${a}${sym}${b}`;
}

/** Parse a fact id back to {a, op, b, answer}. */
export function parseFact(id) {
    const m = id.match(/^(\d+)([x+-])(\d+)$/);
    if (!m) throw new Error(`bad fact id: ${id}`);
    const a = +m[1], b = +m[3];
    const op = { x: 'mul', '+': 'add', '-': 'sub' }[m[2]];
    const answer = op === 'mul' ? a * b : op === 'add' ? a + b : a - b;
    return { a, op, b, answer };
}

/** Canonical pooling key: commuted mul/add pairs share one key. */
export function canonicalKey(id) {
    const { a, op, b } = parseFact(id);
    if (op === 'mul' || op === 'add') {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        return factId(lo, op, hi);
    }
    return id; // subtraction is directed
}

/** Features used by the scheduler, flags, and difficulty scoring. */
export function factFeatures(id) {
    const { a, op, b, answer } = parseFact(id);
    const f = { a, op, b, answer, tie: a === b, minOperand: Math.min(a, b) };
    if (op === 'add') {
        f.crosses10 = (a % 10) + (b % 10) >= 10 && (a < 10 || b < 10);
        f.crossesDecade = a >= 10 && (a % 10) + b >= 10 && b < 10;
        f.carry = (a % 10) + (b % 10) >= 10;
    } else if (op === 'sub') {
        f.crosses10 = a > 10 && a <= 18 && b < 10 && a - b < 10;
        f.borrow = (a % 10) < (b % 10);
    } else {
        f.table = Math.max(a, b) <= 12 ? null : undefined;
    }
    return f;
}

/** All multiplication facts for one table (directed both ways, 2..12). */
export function tableFacts(table) {
    const out = [];
    for (let n = 2; n <= 12; n++) {
        out.push(factId(table, 'mul', n));
        if (n !== table) out.push(factId(n, 'mul', table));
    }
    return out;
}

/** Enumerable single-digit add/sub family members. Two-digit families are
 *  generated parametrically via sampleFamily(). */
export function familyFacts(family) {
    const out = [];
    const push = (a, op, b) => out.push(factId(a, op, b));
    switch (family) {
        case 'add-0-1':
            for (let n = 0; n <= 10; n++) { push(n, 'add', 0); push(n, 'add', 1); }
            break;
        case 'sub-0-1':
            for (let n = 1; n <= 10; n++) { push(n, 'sub', 0); push(n, 'sub', 1); }
            break;
        case 'add-2': for (let n = 2; n <= 10; n++) push(n, 'add', 2); break;
        case 'sub-2': for (let n = 3; n <= 12; n++) push(n, 'sub', 2); break;
        case 'doubles-small': for (let n = 1; n <= 5; n++) push(n, 'add', n); break;
        case 'sub-doubles-small': for (let n = 1; n <= 5; n++) push(n + n, 'sub', n); break;
        case 'near-doubles':
            for (let n = 1; n <= 8; n++) { push(n, 'add', n + 1); push(n + 1, 'add', n); }
            break;
        case 'sub-near-doubles':
            for (let n = 1; n <= 8; n++) { push(n + n + 1, 'sub', n); push(n + n + 1, 'sub', n + 1); }
            break;
        case 'make-10':
            for (let n = 1; n <= 9; n++) push(n, 'add', 10 - n);
            break;
        case 'sub-make-10':
            for (let n = 1; n <= 9; n++) push(10, 'sub', n);
            break;
        case 'doubles-big': for (let n = 6; n <= 9; n++) push(n, 'add', n); break;
        case 'sub-doubles-big': for (let n = 6; n <= 9; n++) push(n + n, 'sub', n); break;
        case 'bridge-10':
            for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++)
                if (a + b >= 11 && a + b <= 18 && a !== b && Math.abs(a - b) !== 1) push(a, 'add', b);
            break;
        case 'sub-bridge-10':
            for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++)
                if (a + b >= 11 && a + b <= 18) { push(a + b, 'sub', a); }
            break;
        case 'add-rest':
            for (let a = 3; a <= 9; a++) for (let b = 3; b <= 9; b++) {
                const covered = a === b || Math.abs(a - b) === 1 || a + b === 10 || a + b >= 11;
                if (!covered) push(a, 'add', b);
            }
            break;
        case 'sub-rest':
            for (let a = 5; a <= 10; a++) for (let b = 3; b <= 9; b++)
                if (a - b >= 1 && a <= 10 && !(a === 10)) push(a, 'sub', b);
            break;
        default:
            return null; // parametric two-digit family — use sampleFamily
    }
    return [...new Set(out)];
}

/** Sample one fact from a parametric two-digit family. rng: () => [0,1). */
export function sampleFamily(family, rng) {
    const ri = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    switch (family) {
        case 'td-ones': { // no crossing
            const a = ri(2, 8) * 10 + ri(1, 4);
            return factId(a, 'add', ri(1, 9 - (a % 10)));
        }
        case 'td-tens': {
            const a = ri(2, 7) * 10 + ri(0, 9);
            return rng() < 0.5 ? factId(a, 'add', ri(1, 9 - Math.floor(a / 10)) * 10)
                : factId(a, 'sub', ri(1, Math.floor(a / 10) - 1) * 10);
        }
        case 'td-ones-cross': {
            const a = ri(2, 8) * 10 + ri(5, 9);
            return factId(a, 'add', ri(10 - (a % 10), 9));
        }
        case 'td-td': { // no carry/borrow
            const a = ri(2, 6) * 10 + ri(1, 4), b = ri(1, 3) * 10 + ri(1, 4);
            return rng() < 0.5 ? factId(a, 'add', b) : factId(a + b, 'sub', b);
        }
        case 'td-td-carry': {
            const a = ri(2, 6) * 10 + ri(5, 9), b = ri(1, 3) * 10 + ri(5, 9);
            return rng() < 0.5 ? factId(a, 'add', b) : factId(a + b, 'sub', b);
        }
        default: {
            const members = familyFacts(family);
            return members[Math.floor(rng() * members.length)];
        }
    }
}

/** Family of a single-digit add/sub fact (two-digit resolved by features). */
export function familyOf(id) {
    const { a, op, b } = parseFact(id);
    if (op === 'mul') return `table-${Math.max(a, b) <= 12 ? tableOf(id) : '??'}`;
    const twoDigit = a >= 10 || b >= 10 || (op === 'sub' && a > 18);
    if (op === 'add') {
        if (!twoDigit || a + b <= 18 && a <= 9 && b <= 9) {
            if (b <= 1 || a <= 1) return 'add-0-1';
            if (b === 2 || a === 2) return 'add-2';
            if (a === b) return a <= 5 ? 'doubles-small' : 'doubles-big';
            if (Math.abs(a - b) === 1) return 'near-doubles';
            if (a + b === 10) return 'make-10';
            if (a + b >= 11) return 'bridge-10';
            return 'add-rest';
        }
        const f = factFeatures(id);
        if (b < 10 || a < 10) return f.carry ? 'td-ones-cross' : 'td-ones';
        return f.carry ? 'td-td-carry' : (b % 10 === 0 || a % 10 === 0 ? 'td-tens' : 'td-td');
    }
    // sub
    if (a <= 18 && b <= 9) {
        if (b <= 1) return 'sub-0-1';
        if (b === 2) return 'sub-2';
        if (a === 10) return 'sub-make-10';
        if (a === b + b) return b <= 5 ? 'sub-doubles-small' : 'sub-doubles-big';
        if (a === b + b + 1 || a === b + b - 1) return 'sub-near-doubles';
        if (a >= 11) return 'sub-bridge-10';
        return 'sub-rest';
    }
    const f = factFeatures(id);
    if (b % 10 === 0) return 'td-tens';
    if (b < 10) return f.borrow ? 'td-ones-cross' : 'td-ones';
    return f.borrow ? 'td-td-carry' : 'td-td';
}

/** Table a multiplication fact belongs to (the larger operand's table by
 *  convention; the commuted twin belongs to the same table for flagging). */
export function tableOf(id) {
    const { a, op, b } = parseFact(id);
    if (op !== 'mul') return null;
    return Math.max(a, b);
}

/**
 * Hard-coded difficulty score (higher = harder) from Math Garden-validated
 * features. Used only to order facts WITHIN the frontier family.
 */
export function difficultyScore(id) {
    const f = factFeatures(id);
    let s = f.minOperand + (f.answer > 10 ? 2 : 0);
    if (f.tie) s -= 2;
    if (f.op !== 'mul' && (f.crosses10 || f.carry || f.borrow)) s += 3;
    if (f.op === 'sub') s += 2;
    if (f.op === 'mul') s += [7, 8, 9, 12].includes(Math.max(f.a, f.b)) ? 2 : 0;
    return s;
}

/** Canonical derived-fact strategy lines (shared by in-app cue + parent email). */
export const STRATEGY_LINES = {
    'table-9': '9s: 10 times it, minus one of it',
    'table-8': '8s: double, double, double',
    'table-7': '7s: 5s fact + 2s fact',
    'table-6': '6s: 5s fact + one more',
    'table-12': '12s: 10s fact + 2s fact',
    'table-11': '11s: 10s fact + one more',
    'near-doubles': 'double the small one, add 1',
    'bridge-10': 'make 10 first, add the rest',
    'sub-bridge-10': 'think addition: what + it = the big number?',
};

/** ≤8-word in-round cue for a specific fact, or null. */
export function factCue(id) {
    const { a, op, b } = parseFact(id);
    if (op === 'mul') {
        const t = Math.max(a, b), n = Math.min(a, b);
        if (t === 9) return `${n}×9: ${n}×10 − ${n}`;
        if (t === 8) return `${n}×8: double ${n}, double, double`;
        if (t === 7) return `${n}×7: ${n}×5 + ${n}×2`;
        if (t === 6) return `${n}×6: ${n}×5 + ${n}`;
        if (t === 12) return `${n}×12: ${n}×10 + ${n}×2`;
        if (t === 11) return `${n}×11: ${n}×10 + ${n}`;
        return null;
    }
    const fam = familyOf(id);
    if (fam === 'near-doubles') return `double ${Math.min(a, b)}, then +1`;
    if (fam === 'bridge-10') return `${a}+${b}: make 10 first`;
    if (fam === 'sub-bridge-10') return `${b} + what = ${a}?`;
    return null;
}
