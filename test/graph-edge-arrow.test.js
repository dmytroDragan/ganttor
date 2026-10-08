const assert = require('assert');
const { arrowHead, arrowHeadOnCubic } = require('../src/graph-edge-arrow.js');

function parse(points) {
  return points.split(' ').map(p => {
    const [x, y] = p.split(',').map(Number);
    return { x, y };
  });
}

{
  const { points } = arrowHead({ x: 0, y: 0 }, { x: 20, y: 0 }, 8);
  const [tip, a, b] = parse(points);
  assert.ok(tip.x < 20, 'tip is pulled back so it sits on the line, not under the node');
  assert.strictEqual(tip.y, 0);
  assert.ok(a.x < tip.x && b.x < tip.x, 'base sits behind a right-pointing tip');
  assert.ok(a.y * b.y < 0, 'base spans above and below the axis');
}

{
  const { points } = arrowHead({ x: 20, y: 0 }, { x: 0, y: 0 }, 8);
  const [tip, a, b] = parse(points);
  assert.ok(tip.x > 0, 'tip is pulled back from the node edge');
  assert.ok(a.x > tip.x && b.x > tip.x, 'base sits behind a left-pointing tip');
}

{
  const { points } = arrowHead({ x: 5, y: 0 }, { x: 5, y: 30 }, 8);
  const [tip, a, b] = parse(points);
  assert.ok(tip.y < 30, 'tip is pulled back from the node edge');
  assert.ok(a.y < tip.y && b.y < tip.y, 'base sits behind a down-pointing tip');
}

{
  const small = parse(arrowHead({ x: 0, y: 0 }, { x: 10, y: 0 }, 8).points);
  const large = parse(arrowHead({ x: 0, y: 0 }, { x: 10, y: 0 }, 11).points);
  const span = (pts) => Math.hypot(pts[1].x - pts[2].x, pts[1].y - pts[2].y);
  assert.ok(span(large) > span(small), 'larger size widens the arrow');
}

{
  const { points } = arrowHead({ x: 4, y: 7 }, { x: 4, y: 7 }, 8);
  assert.strictEqual(parse(points).length, 3, 'zero-length tangent still draws a triangle');
}

{
  // Production edges leave/enter on a node side, so the last handle is axis-aligned.
  // The visible curve is still diagonal — the arrow must follow that, not the handle.
  const f = { x: 100, y: 100 };
  const c1 = { x: 158, y: 100 };
  const c2 = { x: 242, y: 200 };
  const tt = { x: 300, y: 200 };
  const [tip, a, b] = parse(arrowHeadOnCubic(f, c1, c2, tt, 13).points);
  const hx = tip.x - (a.x + b.x) / 2;
  const hy = tip.y - (a.y + b.y) / 2;
  assert.ok(Math.abs(hx) > 1 && Math.abs(hy) > 1, 'diagonal cubic gets a diagonal arrow');
}

{
  const [tip, a, b] = parse(arrowHeadOnCubic(
    { x: 299.6, y: 210.8 }, { x: 241.6, y: 210.8 },
    { x: 159.5, y: 355.1 }, { x: 101.5, y: 355.1 }, 13
  ).points);
  const ang = Math.atan2(tip.y - (a.y + b.y) / 2, tip.x - (a.x + b.x) / 2) * 180 / Math.PI;
  assert.ok(Math.abs(ang - 135) < 12, 'follows the steep part of the S-curve, got ' + ang.toFixed(1));
}

{
  const c2 = { x: 160, y: 355 };
  const tt = { x: 102, y: 355 };
  const t1 = parse(arrowHeadOnCubic({ x: 300, y: 210 }, { x: 242, y: 210 }, c2, tt, 13).points)[0];
  const t2 = parse(arrowHeadOnCubic({ x: 550, y: 210 }, { x: 492, y: 210 }, c2, tt, 13).points)[0];
  assert.ok(Math.hypot(t1.x - t2.x, t1.y - t2.y) > 8, 'arrows sit on their own curve, not stacked on the node');
}

{
  // Short vertical gap (GAP_Y=28) with unclamped 46px handles reverses the arrow.
  // Production clamps handle length to 45% of the gap; arrow must point down.
  function cubicAt(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    };
  }
  const f = { x: 100, y: 50 };
  const tt = { x: 100, y: 78 };
  const h = Math.min(46, Math.abs(tt.y - f.y) * 0.45);
  const c1 = { x: f.x, y: f.y + h };
  const c2 = { x: tt.x, y: tt.y - h };
  const a = cubicAt(f, c1, c2, tt, 0.5);
  const b = cubicAt(f, c1, c2, tt, 0.66);
  assert.ok(b.y > a.y, 'clamped short vertical cubic points down');
  const [tip, pA, pB] = parse(arrowHeadOnCubic(f, c1, c2, tt, 13).points);
  const hy = tip.y - (pA.y + pB.y) / 2;
  assert.ok(hy > 0, 'arrow head points down on short vertical edge');
}

console.log('graph-edge-arrow.test.js ok');
