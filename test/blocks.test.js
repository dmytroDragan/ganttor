const assert = require('assert');
const H = require('../src/sprint-horizon.js');

// Mon 2026-08-10 .. 10 working days (weekends omitted from list)
const dates = [
  '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14',
  '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'
];

const set = H.blockDaySet([{ start: '2026-08-13', end: '2026-08-13' }], dates);
assert.ok(set.has(3) && set.size === 1, 'single-day block');

assert.strictEqual(
  H.blockDaySet([{ start: '2026-08-15', end: '2026-08-16' }], dates).size,
  0,
  'weekend-only no-op'
);

assert.strictEqual(H.effectiveCap(20, 10, 2), 16);
assert.strictEqual(H.effectiveCap(21, 10, 2), 16, 'floor');
assert.strictEqual(H.effectiveCap(20, 10, 10), 0);

assert.strictEqual(H.spanEnd(2, 2, new Set([3])), 5, '2 work days straddling index 3');

const tickets = [{ id: 'T', pts: 2, deps: [] }];
const people = [{ id: 'p1', name: 'Maya', cap: 20, blocks: [{ start: '2026-08-13', end: '2026-08-13' }] }];
const daysOf = (pts) => pts;
const opts = {
  sprintDays: 10, maxSprints: 1, daysOf, strict: true, dates
};

{
  const r = H.planAssignment({ id: 'T', pts: 2, deps: [] }, 'p1', {}, people, tickets, opts);
  assert.ok(!r.error);
  assert.strictEqual(r.start, 0);
  assert.strictEqual(r.days, 2, 'work days stored');
  assert.strictEqual(H.spanEnd(r.start, r.days, set), 2, 'no straddle when start 0, block at 3');
}

{
  const r2 = H.planAssignment({ id: 'T', pts: 2, deps: [] }, 'p1', {
    X: { personId: 'p1', start: 0, days: 2 }
  }, people, tickets.concat([{ id: 'X', pts: 2, deps: [] }]), opts);
  assert.ok(!r2.error);
  assert.strictEqual(r2.start, 2);
  assert.strictEqual(H.spanEnd(r2.start, r2.days, set), 5, 'straddle block at 3');
}

{
  const other = [{ id: 'p2', name: 'Liam', cap: 20, blocks: [] }];
  const r3 = H.planAssignment({ id: 'T', pts: 2, deps: [] }, 'p2', {}, other, tickets, opts);
  assert.strictEqual(r3.start, 0);
  assert.strictEqual(H.spanEnd(r3.start, r3.days, H.blockDaySet([], dates)), 2, 'other person unaffected');
}

{
  const low = [{ id: 'p1', name: 'Maya', cap: 10, blocks: [
    { start: '2026-08-10', end: '2026-08-14' },
    { start: '2026-08-17', end: '2026-08-21' }
  ]}];
  const allBlocked = H.blockDaySet(low[0].blocks, dates);
  assert.strictEqual(allBlocked.size, 10);
  const r4 = H.planAssignment({ id: 'T', pts: 2, deps: [] }, 'p1', {}, low, tickets, opts);
  assert.ok(r4.error);
  assert.strictEqual(r4.hint, 'Over capacity');
}

console.log('blocks tests ok');
