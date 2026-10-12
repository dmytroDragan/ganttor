const assert = require('assert');
const H = require('../src/sprint-horizon.js');

const daysOf = (pts) => pts;
const people = [
  { id: 'fe', name: 'Maya Okonkwo', cap: 20, roles: ['frontend'] },
  { id: 'be', name: 'Liam Petrov', cap: 20, roles: ['backend'] },
  { id: 'fs', name: 'Sofia Reyes', cap: 20, roles: ['frontend', 'backend'] },
  { id: 'none', name: 'No Roles', cap: 20, roles: [] }
];
const tickets = [
  { id: 'OPEN', pts: 2, deps: [], roles: [] },
  { id: 'FE', pts: 2, deps: [], roles: ['frontend'] },
  { id: 'BE', pts: 2, deps: [], roles: ['backend'] }
];
const opts = { sprintDays: 10, maxSprints: 1, daysOf, strict: true };

function plan(t, pid) {
  return H.planAssignment(t, pid, {}, people, tickets, opts);
}

{
  const r = plan(tickets[0], 'be');
  assert.ok(!r.error, 'unconstrained ticket → any person');
  assert.strictEqual(r.start, 0);
}

{
  const r = plan(tickets[1], 'fe');
  assert.ok(!r.error, 'matching role ok');
}

{
  const r = plan(tickets[1], 'fs');
  assert.ok(!r.error, 'overlap with multi-role person ok');
}

{
  const r = plan(tickets[1], 'be');
  assert.ok(r.error, 'mismatch rejected');
  assert.strictEqual(r.hint, 'Wrong role');
}

{
  const r = plan(tickets[2], 'none');
  assert.ok(r.error, 'empty person roles + constrained ticket → reject');
  assert.strictEqual(r.hint, 'Wrong role');
}

console.log('ok — roles match');
