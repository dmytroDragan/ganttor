const assert = require('assert');
const G = require('../src/graph-edit.js');

const SIZES = { 1: { t: 'XS', d: 1 }, 2: { t: 'S', d: 2 }, 3: { t: 'M', d: 3 }, 5: { t: 'M', d: 5 }, 8: { t: 'L', d: 8 } };

assert.strictEqual(G.stepPts(1, SIZES, 1), 2);
assert.strictEqual(G.stepPts(2, SIZES, 1), 3);
assert.strictEqual(G.stepPts(3, SIZES, 1), 5);
assert.strictEqual(G.stepPts(5, SIZES, 1), 8);
assert.strictEqual(G.stepPts(8, SIZES, 1), 8, 'clamp at max');
assert.strictEqual(G.stepPts(1, SIZES, -1), 1, 'clamp at min');
assert.strictEqual(G.stepPts(5, SIZES, -1), 3);
assert.strictEqual(G.stepPts(4, SIZES, 1), 5, 'off-scale steps up to next key');
assert.strictEqual(G.stepPts(4, SIZES, -1), 3, 'off-scale steps down to previous key');
assert.strictEqual(G.stepPts(13, SIZES, 1), 8, 'above max clamps to max');
assert.strictEqual(G.stepPts(0, SIZES, -1), 1, 'below min clamps to min');

const tickets = () => ([
  { id: 'A', epic: 'E', title: 'a', pts: 2, deps: [] },
  { id: 'B', epic: 'E', title: 'b', pts: 2, deps: ['A'] },
  { id: 'C', epic: 'E', title: 'c', pts: 2, deps: ['B'] },
  { id: 'D', epic: 'E', title: 'd', pts: 2, deps: [] }
]);

assert.strictEqual(G.wouldCycle(tickets(), 'A', 'A'), true, 'self');
assert.strictEqual(G.wouldCycle(tickets(), 'B', 'A'), true, 'B already needs A');
assert.strictEqual(G.wouldCycle(tickets(), 'C', 'A'), true, 'C needs B needs A');
assert.strictEqual(G.wouldCycle(tickets(), 'A', 'D'), false);
assert.strictEqual(G.wouldCycle(tickets(), 'D', 'C'), false);

{
  const src = tickets();
  const { tickets: next, error } = G.addDep(src, 'A', 'D');
  assert.strictEqual(error, null);
  assert.deepStrictEqual(next.find(t => t.id === 'D').deps, ['A']);
  assert.deepStrictEqual(src.find(t => t.id === 'D').deps, [], 'input not mutated');
}

{
  const { error } = G.addDep(tickets(), 'A', 'A');
  assert.strictEqual(error, 'self');
}

{
  const { error, tickets: next } = G.addDep(tickets(), 'B', 'A');
  assert.strictEqual(error, 'cycle');
  assert.deepStrictEqual(next.find(t => t.id === 'A').deps, []);
}

{
  const { error } = G.addDep(tickets(), 'A', 'B');
  assert.strictEqual(error, 'duplicate');
}

{
  const src = tickets();
  const next = G.removeDep(src, 'A', 'B');
  assert.deepStrictEqual(next.find(t => t.id === 'B').deps, []);
  assert.deepStrictEqual(src.find(t => t.id === 'B').deps, ['A']);
  assert.deepStrictEqual(G.removeDep(src, 'Z', 'B').find(t => t.id === 'B').deps, ['A'], 'missing dep no-op');
}

{
  const src = tickets();
  const next = G.setPts(src, 'A', 8);
  assert.strictEqual(next.find(t => t.id === 'A').pts, 8);
  assert.strictEqual(src.find(t => t.id === 'A').pts, 2);
}

{
  const src = tickets();
  const copy = G.cloneTickets(src);
  copy[0].deps.push('X');
  copy[0].pts = 99;
  assert.deepStrictEqual(src[0].deps, []);
  assert.strictEqual(src[0].pts, 2);
}

function depthOf(list, id) {
  const byId = {};
  list.forEach(t => { byId[t.id] = t; });
  const depth = {};
  const go = (tid) => {
    if (depth[tid] != null) return depth[tid];
    const t = byId[tid];
    const parents = (t && t.deps) || [];
    depth[tid] = parents.length ? 1 + Math.max(0, ...parents.map(go)) : 0;
    return depth[tid];
  };
  return go(id);
}

{
  const src = tickets();
  assert.strictEqual(depthOf(src, 'D'), 0);
  const { tickets: next } = G.addDep(src, 'C', 'D');
  assert.ok(depthOf(next, 'D') > depthOf(next, 'C') || depthOf(next, 'D') === depthOf(src, 'C') + 1);
  assert.ok(depthOf(next, 'D') > depthOf(next, 'C'));
}

const people = [{ id: 'p1', name: 'Maya', cap: 40 }];
const daysOf = (pts) => ({ 1: 1, 2: 2, 3: 3, 5: 5, 8: 8 }[pts] || pts);

function makePlan(ticketList, sprintDays, maxSprints, strict) {
  const H = require('../src/sprint-horizon.js');
  return (t, pid, assign, ppl) => H.planAssignment(t, pid, assign, ppl, ticketList, {
    sprintDays: sprintDays || 10,
    maxSprints: maxSprints == null ? 1 : maxSprints,
    daysOf,
    strict: strict !== false
  });
}

{
  const list = tickets();
  const assign = {
    A: { personId: 'p1', start: 0, days: 2 },
    B: { personId: 'p1', start: 2, days: 2 },
    C: { personId: 'p1', start: 4, days: 2 }
  };
  const added = G.addDep(list, 'D', 'B');
  assert.strictEqual(added.error, null);
  const { assign: next, returned } = G.refreshAssign(
    assign, people, added.tickets, makePlan(added.tickets), { parentId: 'D', childId: 'B' }
  );
  assert.ok(!next.B, 'child with unmet dep returns');
  assert.ok(!next.C, 'dependent of child returns');
  assert.ok(next.A, 'upstream stays');
  assert.ok(returned.indexOf('B') >= 0 && returned.indexOf('C') >= 0);
}

{
  const list = tickets();
  const assign = { A: { personId: 'p1', start: 0, days: 2 } };
  const grown = G.setPts(list, 'A', 5);
  const { assign: next, returned } = G.refreshAssign(
    assign, people, grown, makePlan(grown), null
  );
  assert.ok(next.A, 'still assigned');
  assert.strictEqual(next.A.personId, 'p1');
  assert.strictEqual(next.A.days, 5);
  assert.deepStrictEqual(returned, []);
}

{
  const list = tickets();
  const assign = { A: { personId: 'p1', start: 0, days: 2 } };
  const grown = G.setPts(list, 'A', 8);
  const { assign: next, returned } = G.refreshAssign(
    assign, people, grown, makePlan(grown, 5, 1), null
  );
  assert.strictEqual(next.A, undefined, 'too long for sprint → unassigned');
  assert.ok(returned.indexOf('A') >= 0);
}

{
  const list = tickets();
  const out = G.exportTickets(
    { name: 'Sprint', start: '2026-08-10', days: 10 },
    SIZES,
    [{ id: 'E', name: 'Epic', hue: 210 }],
    list
  );
  assert.deepStrictEqual(out.sprint, { name: 'Sprint', start: '2026-08-10', days: 10 });
  assert.deepStrictEqual(out.sizes['5'], { tshirt: 'M', days: 5 });
  assert.deepStrictEqual(out.epics[0], { id: 'E', name: 'Epic', hue: 210 });
  assert.strictEqual(out.tickets[1].id, 'B');
  assert.deepStrictEqual(out.tickets[1].deps, ['A']);
}

{
  assert.deepStrictEqual(G.findCycles(tickets()), [], 'acyclic');
}

{
  const cyclic = [
    { id: 'A', deps: ['B'] },
    { id: 'B', deps: ['A'] }
  ];
  assert.deepStrictEqual(G.findCycles(cyclic), [['A', 'B', 'A']]);
}

{
  const self = [{ id: 'A', deps: ['A'] }];
  assert.deepStrictEqual(G.findCycles(self), [['A', 'A']]);
}

{
  const two = [
    { id: 'A', deps: ['B'] },
    { id: 'B', deps: ['A'] },
    { id: 'C', deps: ['D'] },
    { id: 'D', deps: ['C'] }
  ];
  assert.deepStrictEqual(G.findCycles(two), [
    ['A', 'B', 'A'],
    ['C', 'D', 'C']
  ]);
}

{
  const long = [
    { id: 'A', deps: ['B'] },
    { id: 'B', deps: ['C'] },
    { id: 'C', deps: ['A'] }
  ];
  assert.deepStrictEqual(G.findCycles(long), [['A', 'B', 'C', 'A']]);
}

{
  assert.strictEqual(
    G.formatCycles([['A', 'B', 'A'], ['C', 'D', 'C']]),
    'Cycle: A → B → A · Cycle: C → D → C'
  );
  assert.strictEqual(G.formatCycles([]), '');
}

console.log('graph-edit.test.js: ok');
