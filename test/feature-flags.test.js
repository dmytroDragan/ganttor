const assert = require('assert');
const F = require('../src/feature-flags.js');

assert.strictEqual(F.isVisible({ id: 'A', deps: [] }, {}), true, 'untagged');
assert.strictEqual(F.isVisible({ id: 'A', features: [], deps: [] }, {}), true, 'empty features');
assert.strictEqual(
  F.isVisible({ id: 'A', features: ['payments', '3ds'], deps: [] }, { payments: false, '3ds': true }),
  true,
  'any on keeps'
);
assert.strictEqual(
  F.isVisible({ id: 'A', features: ['payments', '3ds'], deps: [] }, { payments: false, '3ds': false }),
  false,
  'all off hides'
);
assert.strictEqual(
  F.isVisible({ id: 'A', features: ['payments'], deps: [] }, {}),
  true,
  'missing flag defaults on'
);

assert.deepStrictEqual(
  F.listFeatures([
    { id: 'A', features: ['3ds', 'payments'] },
    { id: 'B', features: ['payments'] },
    { id: 'C' }
  ]),
  ['3ds', 'payments']
);

const src = [
  { id: 'A', pts: 1, deps: [], features: ['core'] },
  { id: 'B', pts: 1, deps: ['A'], features: ['payments'] },
  { id: 'C', pts: 1, deps: ['B'], features: ['core'] }
];
const out = F.projectTickets(src, { payments: false, core: true });
assert.deepStrictEqual(out.map(t => t.id), ['A', 'C']);
assert.deepStrictEqual(out.find(t => t.id === 'C').deps, ['A'], 'bridge A→B→C');
assert.notStrictEqual(out[0], src[0], 'new objects');
src[2].deps.push('X');
assert.deepStrictEqual(out.find(t => t.id === 'C').deps, ['A'], 'no mutate source deps');

const chain = [
  { id: 'A', deps: [] },
  { id: 'B', deps: ['A'], features: ['x'] },
  { id: 'C', deps: ['B'], features: ['x'] },
  { id: 'D', deps: ['C'] }
];
assert.deepStrictEqual(
  F.projectTickets(chain, { x: false }).find(t => t.id === 'D').deps,
  ['A'],
  'collapse hidden chain'
);

const multi = [
  { id: 'A', deps: [] },
  { id: 'B', deps: [] },
  { id: 'H', deps: ['A', 'B'], features: ['x'] },
  { id: 'C', deps: ['H'] }
];
assert.deepStrictEqual(
  F.projectTickets(multi, { x: false }).find(t => t.id === 'C').deps.sort(),
  ['A', 'B'],
  'multi parent bridge'
);

console.log('feature-flags.test.js: ok');
