const assert = require('assert');
const RoleLoad = require('../src/role-load.js');

const eff = (p) => p.cap;

{
  const people = [{ id: 'fe', roles: ['frontend'], cap: 20 }];
  const tickets = [
    { id: 'FE1', pts: 3, roles: ['frontend'] },
    { id: 'FE2', pts: 5, roles: ['frontend'] }
  ];
  const assign = { FE1: { personId: 'fe', start: 0, days: 3 } };
  const [row] = RoleLoad.summarize(['frontend'], people, tickets, assign, eff);
  assert.strictEqual(row.planned, 3);
  assert.strictEqual(row.demand, 8);
  assert.strictEqual(row.capacity, 20);
  assert.strictEqual(row.fillPct, 15);
}

{
  const people = [{ id: 'fs', roles: ['frontend', 'backend'], cap: 18 }];
  const tickets = [{ id: 'T', pts: 2, roles: ['frontend'] }];
  const assign = { T: { personId: 'fs', start: 0, days: 2 } };
  const rows = RoleLoad.summarize(['frontend', 'backend'], people, tickets, assign, eff);
  assert.strictEqual(rows[0].planned, 2);
  assert.strictEqual(rows[0].capacity, 18);
  assert.strictEqual(rows[1].planned, 2, 'multi-role: planned in both');
  assert.strictEqual(rows[1].capacity, 18, 'multi-role: capacity in both');
  assert.strictEqual(rows[1].demand, 0, 'backend demand empty');
}

{
  const people = [{ id: 'fe', roles: ['frontend'], cap: 10 }];
  const tickets = [
    { id: 'OPEN', pts: 8, roles: [] },
    { id: 'FE', pts: 2, roles: ['frontend'] }
  ];
  const [row] = RoleLoad.summarize(['frontend'], people, tickets, {}, eff);
  assert.strictEqual(row.demand, 2, 'unconstrained omitted from demand');
  assert.strictEqual(row.planned, 0);
}

{
  const people = [{ id: 'fe', roles: ['frontend'], cap: 10 }];
  const tickets = [{ id: 'FE', pts: 5, roles: ['frontend'] }];
  const [row] = RoleLoad.summarize(['frontend'], people, tickets, {}, eff);
  assert.strictEqual(row.demand, 5, 'unassigned still in demand');
  assert.strictEqual(row.planned, 0);
}

{
  const people = [{ id: 'fe', roles: ['frontend'], cap: 10 }];
  const visible = [{ id: 'FE', pts: 2, roles: ['frontend'] }];
  const assign = {
    FE: { personId: 'fe', start: 0, days: 2 },
    HIDDEN: { personId: 'fe', start: 2, days: 3 }
  };
  const [row] = RoleLoad.summarize(['frontend'], people, visible, assign, eff);
  assert.strictEqual(row.planned, 2, 'hidden ticket id skipped when not in visible list');
  assert.strictEqual(row.demand, 2);
}

{
  assert.deepStrictEqual(RoleLoad.summarize([], [], [], {}, eff), []);
  const over = RoleLoad.summarize(
    ['qa'],
    [{ id: 'q', roles: ['qa'], cap: 4 }],
    [{ id: 'T', pts: 8, roles: ['qa'] }],
    { T: { personId: 'q', start: 0, days: 8 } },
    eff
  )[0];
  assert.strictEqual(over.fillPct, 100, 'fill capped at 100');
}

console.log('role-load.test.js: ok');
