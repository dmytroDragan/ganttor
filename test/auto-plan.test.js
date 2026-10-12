const assert = require('assert');
const H = require('../src/sprint-horizon.js');
const AP = require('../src/auto-plan.js');

const daysOf = (pts) => pts;
const people = [
  { id: 'p1', name: 'Ann A', roles: [], cap: 20 },
  { id: 'p2', name: 'Ben B', roles: [], cap: 20 }
];
const t = (id, epic, pts, deps = [], roles = []) => ({ id, epic, pts, deps, roles });

function run(tickets, pre, over, ppl) {
  const planFn = (tk, pid, a, p) => H.planAssignment(tk, pid, a, p, tickets, {
    sprintDays: 10, maxSprints: 1, daysOf, strict: true
  });
  return AP.autoPlan(pre, ppl || people, tickets, planFn, Object.assign({
    sprintDays: 10, daysOf, switchGainDays: 2, maxSkewPct: 25
  }, over));
}

function switches(assign, tickets) {
  const epic = {};
  tickets.forEach(x => { epic[x.id] = x.epic; });
  let n = 0;
  ['p1', 'p2'].forEach(pid => {
    const ids = Object.keys(assign).filter(k => assign[k].personId === pid)
      .sort((a, b) => assign[a].start - assign[b].start);
    for (let i = 1; i < ids.length; i++) if (epic[ids[i]] !== epic[ids[i - 1]]) n++;
  });
  return n;
}

{
  const tk = [t('A', 'X', 3), t('B', 'X', 2, ['A'])];
  const r = run(tk, {}, {});
  assert.ok(r.assign.A && r.assign.B, 'both tickets planned');
  assert.ok(r.assign.B.start >= r.assign.A.start + r.assign.A.days, 'child starts after parent ends');
}

{
  const tk = [t('T', 'X', 2, [], ['backend'])];
  const ppl = [
    { id: 'fe', name: 'Maya O', roles: ['frontend'], cap: 20 },
    { id: 'be', name: 'Liam P', roles: ['backend'], cap: 20 }
  ];
  const r = run(tk, {}, {}, ppl);
  assert.strictEqual(r.assign.T.personId, 'be', 'role-constrained ticket goes to matching role');
}

{
  const tk = [t('A1', 'A', 2), t('A2', 'A', 2), t('A3', 'A', 2), t('B1', 'B', 2), t('B2', 'B', 2), t('B3', 'B', 2)];
  const sticky = run(tk, {}, { switchGainDays: 99, maxSkewPct: 1000 });
  const eager = run(tk, {}, { switchGainDays: 0, maxSkewPct: 1000 });
  assert.ok(switches(sticky.assign, tk) < switches(eager.assign, tk),
    'high gain threshold keeps teammates on one epic longer than pure earliest-finish');
}

{
  const tk = [t('Y0', 'Y', 6), t('X0', 'X', 2), t('Y1', 'Y', 2)];
  const pre = { Y0: { personId: 'p1', start: 0, days: 6 }, X0: { personId: 'p2', start: 0, days: 2 } };
  const stays = run(tk, pre, { switchGainDays: 99, maxSkewPct: 1000 });
  const switches2 = run(tk, pre, { switchGainDays: 2, maxSkewPct: 1000 });
  assert.strictEqual(stays.assign.Y1.personId, 'p1', 'gain below threshold keeps sticky teammate');
  assert.strictEqual(switches2.assign.Y1.personId, 'p2', 'gain at/above threshold switches to earlier finish');
}

{
  const tk = [t('Y0', 'Y', 8), t('X0', 'X', 2), t('Y1', 'Y', 2)];
  const pre = { Y0: { personId: 'p1', start: 0, days: 8 }, X0: { personId: 'p2', start: 0, days: 2 } };
  const noSkew = run(tk, pre, { switchGainDays: 99, maxSkewPct: 1000 });
  const skewed = run(tk, pre, { switchGainDays: 99, maxSkewPct: 20 });
  assert.strictEqual(noSkew.assign.Y1.personId, 'p1', 'without skew override sticky teammate keeps the ticket');
  assert.strictEqual(skewed.assign.Y1.personId, 'p2', 'skew above threshold overrides stickiness');
}

{
  const tk = [t('X0', 'X', 2), t('X1', 'X', 2)];
  const pre = { X0: { personId: 'p1', start: 0, days: 2 } };
  const before = JSON.parse(JSON.stringify(pre));
  const r = run(tk, pre, {});
  assert.deepStrictEqual(r.assign.X0, before.X0, 'existing assignment untouched');
  assert.deepStrictEqual(pre, before, 'input assign not mutated');
  assert.deepStrictEqual(r.planned, ['X1'], 'only remaining tickets are planned');
}

{
  const small = [
    { id: 'p1', name: 'Ann A', roles: [], cap: 4 },
    { id: 'p2', name: 'Ben B', roles: [], cap: 4 }
  ];
  const tk = [t('BIG', 'X', 5), t('CHILD', 'X', 2, ['BIG']), t('OK', 'X', 2)];
  const r = run(tk, {}, {}, small);
  assert.deepStrictEqual(r.skipped, [
    { id: 'BIG', hint: 'Over capacity' },
    { id: 'CHILD', hint: 'Blocked' }
  ], 'unfit ticket and its dependents are skipped with hints');
  assert.ok(!r.assign.BIG && !r.assign.CHILD, 'skipped tickets absent from assign');
  assert.ok(r.assign.OK, 'fitting ticket still planned');
}

console.log('ok — auto-plan');
