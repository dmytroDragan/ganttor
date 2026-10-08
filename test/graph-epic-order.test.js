const assert = require('assert');
const { orderEpicColumns } = require('../src/graph-epic-order.js');

function idsOf(epics, tickets) {
  return orderEpicColumns(epics, tickets).map(e => e.id);
}

// Child listed last, parents are the left prefix — sit next to those parents
{
  const epics = ['A', 'B', 'C', 'X', 'Z'].map(id => ({ id }));
  const tickets = [
    { id: 'a', epic: 'A', deps: [] },
    { id: 'b1', epic: 'B', deps: ['a'] },
    { id: 'b2', epic: 'B', deps: ['a'] },
    { id: 'c', epic: 'C', deps: ['b1'] },
    { id: 'x', epic: 'X', deps: ['c'] },
    { id: 'z1', epic: 'Z', deps: ['a', 'b1'] },
    { id: 'z2', epic: 'Z', deps: ['b1', 'b2', 'c'] },
    { id: 'z3', epic: 'Z', deps: ['a'] }
  ];
  const ids = idsOf(epics, tickets);
  assert.notStrictEqual(ids[ids.length - 1], 'Z', 'dependent epic must not sit rightmost past unrelated columns');
  assert.strictEqual(ids.indexOf('Z'), ids.indexOf('C') + 1, 'Z sits immediately after its latest parent C');
}

// Dependent epic sits after its parents, not past unrelated columns
{
  const epics = ['P0F', 'CAL', 'DAT', 'MOD', 'XAI', 'SRV', 'ANV'].map(id => ({ id }));
  const tickets = [
    { id: 'p0', epic: 'P0F', deps: [] },
    { id: 'c1', epic: 'CAL', deps: ['p0'] },
    { id: 'd1', epic: 'DAT', deps: ['p0'] },
    { id: 'm1', epic: 'MOD', deps: ['p0'] },
    { id: 'x1', epic: 'XAI', deps: ['m1'] },
    { id: 's1', epic: 'SRV', deps: ['m1'] },
    { id: 'a1', epic: 'ANV', deps: ['p0', 'c1', 'd1'] }
  ];
  const ids = idsOf(epics, tickets);
  assert.notStrictEqual(ids[ids.length - 1], 'ANV');
  assert.deepStrictEqual(ids, ['P0F', 'CAL', 'DAT', 'ANV', 'MOD', 'XAI', 'SRV']);
}

// No cross-epic deps → keep declared order
{
  const epics = ['X', 'Y', 'Z'].map(id => ({ id }));
  const tickets = [
    { id: 'x', epic: 'X', deps: [] },
    { id: 'y', epic: 'Y', deps: [] },
    { id: 'z', epic: 'Z', deps: ['z0'] }
  ];
  assert.deepStrictEqual(idsOf(epics, tickets), ['X', 'Y', 'Z']);
}

// Equal span: parent epic must still move left of its child (shipped CHK←PAY case)
{
  const epics = ['CHK', 'PAY', 'ORD'].map(id => ({ id }));
  const tickets = require('../data/tickets.json').tickets;
  const ids = idsOf(epics, tickets);
  assert.ok(ids.indexOf('PAY') < ids.indexOf('CHK'), 'PAY (parent of CHK-104) left of CHK, got ' + ids.join(','));
}

console.log('graph-epic-order.test.js: ok');
