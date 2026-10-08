/** Iterative barycenter ordering for depth rows (intra-epic edges). */
(function (root) {
  function indexMap(row) {
    const m = {};
    for (let i = 0; i < row.length; i++) m[row[i]] = i;
    return m;
  }

  function sortByBarycenter(row, neighborIdsFn, neighborRow) {
    const prev = indexMap(row);
    const nIdx = indexMap(neighborRow);
    return row.slice().sort((a, b) => {
      const na = neighborIdsFn(a).filter(n => nIdx[n] != null);
      const nb = neighborIdsFn(b).filter(n => nIdx[n] != null);
      const scale = (row.length - 1) / Math.max(1, neighborRow.length - 1);
      const ka = na.length ? (na.reduce((s, n) => s + nIdx[n], 0) / na.length) * scale : prev[a];
      const kb = nb.length ? (nb.reduce((s, n) => s + nIdx[n], 0) / nb.length) * scale : prev[b];
      return ka - kb || (a < b ? -1 : a > b ? 1 : 0);
    });
  }

  /**
   * @param {Record<number, string[]>} byDepth
   * @param {Record<string, string[]>} parents
   * @param {Record<string, string[]>} children
   * @param {number} [sweeps=4]
   * @returns {Record<number, string[]>}
   */
  function orderDepthRowsByBarycenter(byDepth, parents, children, sweeps) {
    const n = sweeps == null ? 4 : sweeps;
    const depths = Object.keys(byDepth).map(Number).sort((a, b) => a - b);
    if (depths.length < 2) return byDepth;

    for (let s = 0; s < n; s++) {
      for (let di = 1; di < depths.length; di++) {
        const d = depths[di];
        const prevD = depths[di - 1];
        const prevRow = byDepth[prevD];
        byDepth[d] = sortByBarycenter(
          byDepth[d],
          id => (parents[id] || []).filter(p => prevRow.indexOf(p) >= 0),
          prevRow
        );
      }
      for (let di = depths.length - 2; di >= 0; di--) {
        const d = depths[di];
        const nextD = depths[di + 1];
        const nextRow = byDepth[nextD];
        byDepth[d] = sortByBarycenter(
          byDepth[d],
          id => (children[id] || []).filter(c => nextRow.indexOf(c) >= 0),
          nextRow
        );
      }
    }
    return byDepth;
  }

  const api = { orderDepthRowsByBarycenter };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GraphRowOrder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
