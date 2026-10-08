const assert = require('assert');
const H = require('../src/sprint-horizon.js');

const tickets = [
  { id: 'A', pts: 5, deps: [] },
  { id: 'B', pts: 5, deps: ['A'] },
  { id: 'C', pts: 3, deps: [] },
  { id: 'LONG', pts: 8, deps: [] },
  { id: 'XS', pts: 1, deps: [] }
];
const people = [{ id: 'p1', name: 'Maya Okonkwo', cap: 20 }];
const tight = [{ id: 'p1', name: 'Maya Okonkwo', cap: 8 }];
const daysOf = (pts) => ({ 1: 1, 2: 2, 3: 3, 5: 5, 8: 8 }[pts]);
const opts = (over) => Object.assign({
  sprintDays: 10,
  maxSprints: 1,
  daysOf,
  strict: true
}, over);

function plan(t, pid, assign, maxSprints) {
  return H.planAssignment(t, pid, assign, people, tickets, opts({ maxSprints: maxSprints == null ? 1 : maxSprints }));
}

assert.strictEqual(H.MAX_SPRINTS, 7);
assert.deepStrictEqual(H.GANTT_DAY_PX, [28, 40, 58, 76, 96]);
assert.strictEqual(H.sprintIndex(0, 10), 0);
assert.strictEqual(H.sprintIndex(9.9, 10), 0);
assert.strictEqual(H.sprintIndex(10, 10), 1);

assert.strictEqual(H.visibleSprintCount({}, 10, 7), 1);
assert.strictEqual(H.visibleSprintCount({ A: { start: 0, days: 10 } }, 10, 7), 1, 'exact sprint end stays at 1');
assert.strictEqual(H.visibleSprintCount({ A: { start: 10, days: 3 } }, 10, 7), 2);
assert.strictEqual(H.visibleSprintCount({ A: { start: 60, days: 5 } }, 10, 7), 7, 'cap at maxSprints');

assert.strictEqual(H.stepDayPx(58, 1), 76);
assert.strictEqual(H.stepDayPx(58, -1), 40);
assert.strictEqual(H.stepDayPx(28, -1), 28);
assert.strictEqual(H.stepDayPx(96, 1), 96);

const stripped = H.stripLaterSprints({
  A: { personId: 'p1', start: 0, days: 5 },
  B: { personId: 'p1', start: 10, days: 5 }
}, 10);
assert.ok(stripped.A);
assert.strictEqual(stripped.B, undefined);

{
  const r = plan(tickets[0], 'p1', {}, 1);
  assert.strictEqual(r.start, 0);
  assert.strictEqual(r.days, 5);
}

{
  const assign = { A: { personId: 'p1', start: 0, days: 5 } };
  const r = plan(tickets[1], 'p1', assign, 1);
  assert.strictEqual(r.start, 5, 'after predecessor + busy');
}

{
  const assign = { A: { personId: 'p1', start: 0, days: 5 } };
  const r = H.planAssignment({ id: 'C', pts: 5, deps: [] }, 'p1', assign, tight, tickets, opts({ maxSprints: 1 }));
  assert.ok(r.error, '5+5 pts on cap 8 in one sprint');
  assert.strictEqual(r.hint, 'Over capacity');
}

{
  const r = plan(tickets[1], 'p1', {}, 1);
  assert.ok(r.error, 'strict missing dep');
  assert.strictEqual(r.hint, 'Blocked');
}

{
  // 3pt bar occupies days 3–6; 5-day ticket cannot use the opening gap and cannot finish by day 10
  const assign = { C: { personId: 'p1', start: 3, days: 3 } };
  const r = plan(tickets[0], 'p1', assign, 1);
  assert.ok(r.error, 'would finish past sprint 1');
  assert.strictEqual(r.hint, 'Past sprint');
}

{
  const assign = { C: { personId: 'p1', start: 3, days: 3 } };
  const r = plan(tickets[0], 'p1', assign, 7);
  assert.ok(!r.error, 'shifts to next sprint instead of splitting');
  assert.strictEqual(r.start, 10);
  assert.ok(r.start + r.days <= 20);
}

{
  const assign = { A: { personId: 'p1', start: 0, days: 5 }, C: { personId: 'p1', start: 5, days: 3 } };
  const r = H.planAssignment({ id: 'B', pts: 5, deps: ['A'] }, 'p1', assign, tight, tickets, opts({ maxSprints: 7 }));
  assert.ok(!r.error, 'capacity reset next sprint');
  assert.strictEqual(r.start, 10);
}

{
  const r = plan(tickets.find(t => t.id === 'LONG'), 'p1', {}, 1);
  // 8 days fits in 10-day sprint
  assert.ok(!r.error);
  const shortSprint = H.planAssignment(
    tickets.find(t => t.id === 'LONG'), 'p1', {}, people, tickets,
    opts({ sprintDays: 5, maxSprints: 7 })
  );
  assert.ok(shortSprint.error);
  assert.strictEqual(shortSprint.hint, 'Too long');
}

{
  const assign = {};
  // fill 7 sprints with 5pt+3pt? cap 8, one 8pt? Use 5-day blocks filling each sprint start
  const packed = {};
  for (let i = 0; i < 7; i++) {
    packed['S' + i] = { personId: 'p1', start: i * 10, days: 8 };
  }
  const extraTickets = tickets.concat(
    Object.keys(packed).map(id => ({ id, pts: 8, deps: [] }))
  );
  const r = H.planAssignment(
    { id: 'XS', pts: 1, deps: [] }, 'p1', packed, tight, extraTickets,
    opts({ maxSprints: 7 })
  );
  assert.ok(r.error, 'no room in 7 sprints');
  assert.strictEqual(r.hint, 'Over capacity');
}

{
  const assign = { A: { personId: 'p1', start: 10, days: 5 } };
  const r = plan({ id: 'B', pts: 5, deps: ['A'] }, 'p1', assign, 7);
  assert.strictEqual(r.start, 15, 'depsEnd in sprint 2');
}

console.log('sprint-horizon.test.js: ok');
