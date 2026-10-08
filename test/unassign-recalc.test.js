const assert = require('assert');
const { idsToReturn, applyUnassign, repackAssign, orderForRepack } = require('../src/unassign-recalc.js');
const SprintHorizon = require('../src/sprint-horizon.js');

const tickets = [
  { id: 'A', pts: 2, deps: [] },
  { id: 'B', pts: 2, deps: ['A'] },
  { id: 'C', pts: 2, deps: ['B'] },
  { id: 'D', pts: 2, deps: [] }
];

const people = [{ id: 'p1', name: 'Maya', cap: 40 }];

// Minimal plan: earliest start after deps + same-person busy slots (matches Sprint Planner.plan)
function plan(t, pid, assign) {
  let depsEnd = 0;
  t.deps.forEach(d => {
    const a = assign[d];
    if (a) depsEnd = Math.max(depsEnd, a.start + a.days);
  });
  const dur = 1.5;
  const busy = Object.keys(assign).filter(k => assign[k].personId === pid)
    .map(k => [assign[k].start, assign[k].start + assign[k].days]).sort((a, b) => a[0] - b[0]);
  let start = depsEnd;
  for (const [s, e] of busy) {
    if (start + dur <= s + 1e-9) break;
    if (e > start) start = e;
  }
  return { start, days: dur };
}

// A(0) → B(1.5) → C(3); D after C on same person at 4.5
const assign = {
  A: { personId: 'p1', start: 0, days: 1.5 },
  B: { personId: 'p1', start: 1.5, days: 1.5 },
  C: { personId: 'p1', start: 3, days: 1.5 },
  D: { personId: 'p1', start: 4.5, days: 1.5 }
};

// Unassign A → B and C must leave too (depend on A transitively)
const cascade = idsToReturn('A', tickets, assign);
assert.ok(cascade.has('A'), 'root returns');
assert.ok(cascade.has('B'), 'direct dependent returns');
assert.ok(cascade.has('C'), 'transitive dependent returns');
assert.ok(!cascade.has('D'), 'unrelated ticket stays');

const { assign: next, removed } = applyUnassign('A', assign, people, tickets, plan);
assert.ok(removed.has('B') && removed.has('C'));
assert.strictEqual(next.B, undefined);
assert.strictEqual(next.C, undefined);
assert.ok(next.D, 'D remains scheduled');
assert.strictEqual(next.D.start, 0, 'D packs to earliest after gap closes');
assert.strictEqual(next.A, undefined);

// Failed placement drops the ticket (does not keep the old overlapping bar)
{
  const tickets2 = [
    { id: 'A', pts: 5, deps: [] },
    { id: 'B', pts: 8, deps: [] }
  ];
  const people2 = [{ id: 'p1', name: 'Maya', cap: 20 }];
  const assign2 = {
    A: { personId: 'p1', start: 0, days: 5 },
    B: { personId: 'p1', start: 2, days: 8 }
  };
  const planReal = (t, pid, a, p) => SprintHorizon.planAssignment(t, pid, a, p, tickets2, {
    sprintDays: 10,
    maxSprints: 1,
    daysOf: pts => ({ 1: 1, 2: 2, 3: 3, 5: 5, 8: 8 }[pts]),
    strict: true
  });
  const packed = repackAssign(assign2, people2, tickets2, planReal);
  assert.ok(packed.A, 'A still fits');
  assert.strictEqual(packed.B, undefined, 'B must drop when it no longer fits');
}

// Dependency cycle must not blow the stack
{
  const cycleT = [
    { id: 'A', pts: 1, deps: ['B'] },
    { id: 'B', pts: 1, deps: ['A'] }
  ];
  const cycleAssign = {
    A: { personId: 'p1', start: 0, days: 1 },
    B: { personId: 'p1', start: 1, days: 1 }
  };
  assert.doesNotThrow(() => orderForRepack(['A', 'B'], cycleT, cycleAssign));
  const ordered = orderForRepack(['A', 'B'], cycleT, cycleAssign);
  assert.strictEqual(ordered.length, 2);
}

console.log('ok — unassign cascade + repack');
