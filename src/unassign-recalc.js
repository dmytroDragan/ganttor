/** Cascade unassign + earliest-position repack for sprint planner. */
(function (root) {
  function idsToReturn(rootId, tickets, assign) {
    const remove = new Set([rootId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < tickets.length; i++) {
        const t = tickets[i];
        if (!assign[t.id] || remove.has(t.id)) continue;
        const deps = t.deps || [];
        for (let j = 0; j < deps.length; j++) {
          if (remove.has(deps[j])) {
            remove.add(t.id);
            grew = true;
            break;
          }
        }
      }
    }
    return remove;
  }

  function orderForRepack(ids, tickets, assign) {
    const set = new Set(ids);
    const byId = {};
    for (let i = 0; i < tickets.length; i++) byId[tickets[i].id] = tickets[i];
    const depth = {};
    const visiting = {};
    const visit = (id) => {
      if (depth[id] != null) return depth[id];
      if (visiting[id]) { depth[id] = 0; return 0; }
      const t = byId[id];
      const parents = ((t && t.deps) || []).filter(d => set.has(d));
      visiting[id] = true;
      depth[id] = parents.length ? 1 + Math.max.apply(null, parents.map(visit)) : 0;
      delete visiting[id];
      return depth[id];
    };
    ids.forEach(visit);
    return ids.slice().sort((a, b) => depth[a] - depth[b] || assign[a].start - assign[b].start || (a < b ? -1 : a > b ? 1 : 0));
  }

  function repackAssign(assign, people, tickets, planFn) {
    const ids = orderForRepack(Object.keys(assign), tickets, assign);
    const next = {};
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const t = tickets.find(x => x.id === id);
      const pid = assign[id].personId;
      const r = planFn(t, pid, next, people);
      if (r && !r.error) {
        next[id] = { personId: pid, start: r.start, days: r.days };
      }
    }
    return next;
  }

  function applyUnassign(rootId, assign, people, tickets, planFn) {
    const remove = idsToReturn(rootId, tickets, assign);
    const kept = {};
    Object.keys(assign).forEach(k => {
      if (!remove.has(k)) kept[k] = assign[k];
    });
    return { assign: repackAssign(kept, people, tickets, planFn), removed: remove };
  }

  const api = { idsToReturn, orderForRepack, repackAssign, applyUnassign };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UnassignRecalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
