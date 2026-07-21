/**
 * familyFacts() / familyOf() must agree.
 *
 * These two are the serve-side and credit-side of the same question: the
 * scheduler picks practice from familyFacts(fam) (placement strata,
 * blockedRound warm-up), and adapt.js scores the day by grouping answers
 * through familyOf(). When they disagreed, practice served AS one family was
 * credited TO another — 44 of 213 enumerated facts (21%) — which starved the
 * ladder's promotion gate: a frontier family could be served all day and still
 * miss ADAPT.MIN_ITEMS_PER_DAY, so it scored nothing and never accrued the
 * promotion evidence it had actually earned.
 */
import { familyFacts, familyOf, ADD_FAMILIES, SUB_PARTNER } from '../js/engine/facts.js';

const ENUMERABLE = [...ADD_FAMILIES, ...Object.values(SUB_PARTNER)]
    .filter(Boolean)
    .filter(f => familyFacts(f) !== null);

export async function run({ eq, ok }) {
    // --- Round-trip: every enumerated member resolves back to its own family.
    const mismatches = [];
    for (const fam of ENUMERABLE) {
        for (const id of familyFacts(fam)) {
            if (familyOf(id) !== fam) mismatches.push(`${id} in ${fam} -> ${familyOf(id)}`);
        }
    }
    eq(mismatches, [], 'familyFacts() members all round-trip through familyOf()');

    // --- No fact is stranded: if familyOf() names an enumerable family, that
    // family must list it. Otherwise the fact can be classified but never
    // deliberately served (the 2+9 -> add-2 case, where add-2 enumerated 9+2).
    const orphans = [];
    for (const fam of ENUMERABLE) {
        for (const id of familyFacts(fam)) {
            const home = familyOf(id);
            const list = familyFacts(home);
            if (list && !list.includes(id)) orphans.push(`${id} -> ${home}`);
        }
    }
    eq(orphans, [], 'no fact is classified into a family that omits it');

    // --- Partition, not just consistency: families must not share members, or
    // a day's practice splits its credit across two EMAs.
    const owner = new Map();
    const shared = [];
    for (const fam of ENUMERABLE) {
        for (const id of familyFacts(fam)) {
            if (owner.has(id)) shared.push(`${id}: ${owner.get(id)} + ${fam}`);
            else owner.set(id, fam);
        }
    }
    eq(shared, [], 'each fact belongs to exactly one enumerable family');

    // --- Every family keeps real content. An empty family would silently
    // freeze the ladder at that rung: nothing to serve, so nothing to score.
    const empty = ENUMERABLE.filter(f => familyFacts(f).length === 0);
    eq(empty, [], 'no enumerable family is empty');

    // --- The partition must not have invented facts. Every member is a plain
    // single-digit add/sub id — the parametric two-digit families stay null.
    const bad = [...owner.keys()].filter(id => !/^\d+[+-]\d+$/.test(id));
    eq(bad, [], 'every enumerated fact is a well-formed single-digit id');
    ok(familyFacts('td-ones') === null, 'parametric families still return null');
    ok(familyFacts('table-7') === null, 'multiplication families are not enumerable here');

    // --- Regression anchors for the specific facts that were misfiled.
    ok(familyFacts('bridge-10').includes('9+4'), 'bridge-10 keeps its own facts');
    ok(!familyFacts('bridge-10').includes('2+9'), '2+9 no longer served as bridge-10');
    ok(familyFacts(familyOf('2+9')).includes('2+9'), '2+9 is served by whichever family owns it');
    ok(familyFacts('doubles-small').includes('3+3'), 'doubles-small keeps a true double');
    ok(!familyFacts('make-10').includes('5+5'), '5+5 is a double first, not a make-10');
}
