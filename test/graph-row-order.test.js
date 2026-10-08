const assert = require('assert');
const { orderDepthRowsByBarycenter } = require('../src/graph-row-order.js');

// Crossing fixture: A—Y and B—X cross when row1 is [X,Y]
{
  const byDepth = { 0: ['A', 'B'], 1: ['X', 'Y'] };
  const parents = { A: [], B: [], X: ['B'], Y: ['A'] };
  const children = { A: ['Y'], B: ['X'], X: [], Y: [] };
  orderDepthRowsByBarycenter(byDepth, parents, children, 4);
  assert.deepStrictEqual(byDepth[0], ['A', 'B']);
  assert.deepStrictEqual(byDepth[1], ['Y', 'X'], 'down sweep should uncross');
}

// No adjacent neighbors → keep prior order
{
  const byDepth = { 0: ['A', 'B'], 1: ['C', 'D'] };
  const parents = { A: [], B: [], C: [], D: [] };
  const children = { A: [], B: [], C: [], D: [] };
  orderDepthRowsByBarycenter(byDepth, parents, children, 4);
  assert.deepStrictEqual(byDepth[1], ['C', 'D']);
}

// Skip-depth edge ignored: C→A spans over row 1, so down-sweep on row 2 sees no parents in row 1
{
  const byDepth = { 0: ['A', 'B'], 1: ['M', 'N'], 2: ['D', 'C'] };
  const parents = {
    A: [], B: [], M: [], N: [],
    C: ['A'], D: ['B']
  };
  const children = {
    A: ['C'], B: ['D'], M: [], N: [], C: [], D: []
  };
  orderDepthRowsByBarycenter(byDepth, parents, children, 4);
  assert.deepStrictEqual(byDepth[2], ['D', 'C'], 'no adjacent-layer parents → keep prior order');
}

// Single-node rows unchanged
{
  const byDepth = { 0: ['A'], 1: ['B'] };
  const parents = { A: [], B: ['A'] };
  const children = { A: ['B'], B: [] };
  orderDepthRowsByBarycenter(byDepth, parents, children, 4);
  assert.deepStrictEqual(byDepth[0], ['A']);
  assert.deepStrictEqual(byDepth[1], ['B']);
}

// Unequal row lengths: scale neighbor index into this row's range
{
  const byDepth = { 0: ['L', 'R'], 1: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] };
  const parents = { A: [], B: [], C: [], D: [], E: [], F: [], G: [], H: ['R'] };
  const children = { L: [], R: ['H'], A: [], B: [], C: [], D: [], E: [], F: [], G: [], H: [] };
  orderDepthRowsByBarycenter(byDepth, parents, children, 4);
  assert.ok(byDepth[1].indexOf('H') >= 5, 'H (child of rightmost parent) stays on the right, got ' + byDepth[1].join(','));
}

console.log('graph-row-order.test.js: ok');
