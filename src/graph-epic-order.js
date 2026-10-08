/** Order epic columns so cross-epic deps stay short (parent left of child). */
(function (root) {
  function crossEpicGraph(epics, tickets) {
    const ids = epics.map(e => e.id);
    const known = {};
    for (let i = 0; i < ids.length; i++) known[ids[i]] = true;
    const ticketEpic = {};
    for (let i = 0; i < tickets.length; i++) ticketEpic[tickets[i].id] = tickets[i].epic;

    const parents = {};
    for (let i = 0; i < ids.length; i++) parents[ids[i]] = {};
    const edges = [];
    const weight = {};
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      if (!known[t.epic]) continue;
      const deps = t.deps || [];
      for (let j = 0; j < deps.length; j++) {
        const pe = ticketEpic[deps[j]];
        if (!pe || pe === t.epic || !known[pe]) continue;
        parents[t.epic][pe] = true;
        const k = pe + '\0' + t.epic;
        weight[k] = (weight[k] || 0) + 1;
      }
    }
    const keys = Object.keys(weight);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const sep = k.indexOf('\0');
      edges.push({ from: k.slice(0, sep), to: k.slice(sep + 1), w: weight[k] });
    }
    return { ids, parents, edges };
  }

  function spanOf(order, edges) {
    const pos = {};
    for (let i = 0; i < order.length; i++) pos[order[i]] = i;
    let s = 0;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      s += e.w * Math.abs(pos[e.to] - pos[e.from]);
    }
    return s;
  }

  /**
   * Adjacent-swap until total weighted |childCol - parentCol| stops shrinking.
   * Never places a child epic left of a parent epic (cycles: span only).
   * @param {{id:string}[]} epics
   * @param {{id:string, epic:string, deps?:string[]}[]} tickets
   * @returns {{id:string}[]}
   */
  function orderEpicColumns(epics, tickets) {
    if (!epics || epics.length < 2) return (epics || []).slice();
    const { parents, edges } = crossEpicGraph(epics, tickets || []);
    if (!edges.length) return epics.slice();

    const order = epics.map(e => e.id);
    const byId = {};
    for (let i = 0; i < epics.length; i++) byId[epics[i].id] = epics[i];

    let moved = true;
    let guard = order.length * order.length + 1;
    while (moved && guard-- > 0) {
      moved = false;
      for (let i = 0; i < order.length - 1; i++) {
        const left = order[i];
        const right = order[i + 1];
        if (parents[right][left] && !parents[left][right]) continue;
        const before = spanOf(order, edges);
        order[i] = right;
        order[i + 1] = left;
        const after = spanOf(order, edges);
        // Keep equal-span swaps that put a parent left of its child.
        if (after < before || (after === before && parents[left][right] && !parents[right][left])) {
          moved = true;
        } else {
          order[i] = left;
          order[i + 1] = right;
        }
      }
    }
    return order.map(id => byId[id]);
  }

  const api = { orderEpicColumns };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GraphEpicOrder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
