/** Filled arrowhead at the child end of a dependency edge. */
(function (root) {
  function arrowHead(ctrl, tip, size) {
    const len = size || 8;
    const half = len * 0.32;
    let dx = tip.x - ctrl.x;
    let dy = tip.y - ctrl.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 1e-6) { dx = 0; dy = 1; }
    else { dx /= mag; dy /= mag; }
    const px = -dy;
    const py = dx;
    const inset = Math.min(3, len * 0.25);
    const ox = tip.x - dx * inset;
    const oy = tip.y - dy * inset;
    const bx = ox - dx * len;
    const by = oy - dy * len;
    const pts = [
      [ox, oy],
      [bx + px * half, by + py * half],
      [bx - px * half, by - py * half]
    ];
    return {
      points: pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')
    };
  }

  function cubicAt(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    };
  }

  function arrowHeadOnCubic(p0, p1, p2, p3, size) {
    return arrowHead(cubicAt(p0, p1, p2, p3, 0.5), cubicAt(p0, p1, p2, p3, 0.66), size);
  }

  const api = { arrowHead, arrowHeadOnCubic };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GraphEdgeArrow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
