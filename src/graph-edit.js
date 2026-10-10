/** Ticket graph edits + plan refresh after pts/deps changes. */
(function (root) {
  function unassignApi() {
    if (typeof UnassignRecalc !== 'undefined') return UnassignRecalc;
    if (typeof require !== 'undefined') return require('./unassign-recalc.js');
    return {};
  }

  function sizeKeys(sizes) {
    return Object.keys(sizes || {})
      .map(k => +k)
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);
  }

  function stepPts(pts, sizes, dir) {
    const keys = sizeKeys(sizes);
    if (!keys.length) return pts;
    const i = keys.indexOf(+pts);
    if (i < 0) {
      const n = +pts;
      if (dir > 0) {
        for (let k = 0; k < keys.length; k++) if (keys[k] > n) return keys[k];
        return keys[keys.length - 1];
      }
      for (let k = keys.length - 1; k >= 0; k--) if (keys[k] < n) return keys[k];
      return keys[0];
    }
    const j = i + (dir > 0 ? 1 : -1);
    if (j < 0 || j >= keys.length) return keys[i];
    return keys[j];
  }

  function cloneTickets(tickets) {
    return (tickets || []).map(t => Object.assign({}, t, { deps: ((t && t.deps) || []).slice() }));
  }

  function wouldCycle(tickets, parentId, childId) {
    if (parentId === childId) return true;
    const byId = {};
    (tickets || []).forEach(t => { byId[t.id] = t; });
    const seen = {};
    const stack = [parentId];
    while (stack.length) {
      const id = stack.pop();
      if (id === childId) return true;
      if (seen[id]) continue;
      seen[id] = true;
      const t = byId[id];
      ((t && t.deps) || []).forEach(d => stack.push(d));
    }
    return false;
  }

  function cycleKey(path) {
    const n = path.length - 1;
    let best = null;
    for (let i = 0; i < n; i++) {
      const parts = [];
      for (let j = 0; j < n; j++) parts.push(path[(i + j) % n]);
      const k = parts.join('\0');
      if (best == null || k < best) best = k;
    }
    return best;
  }

  function rotateCycle(path) {
    const n = path.length - 1;
    let bestI = 0;
    let bestK = null;
    for (let i = 0; i < n; i++) {
      const parts = [];
      for (let j = 0; j < n; j++) parts.push(path[(i + j) % n]);
      const k = parts.join('\0');
      if (bestK == null || k < bestK) {
        bestK = k;
        bestI = i;
      }
    }
    const body = [];
    for (let j = 0; j < n; j++) body.push(path[(bestI + j) % n]);
    return body.concat([body[0]]);
  }

  /** Directed simple cycles following deps (ticket → prerequisite). */
  function findCycles(tickets) {
    const byId = {};
    (tickets || []).forEach(t => { byId[t.id] = t; });
    const ids = (tickets || []).map(t => t.id).filter(id => byId[id]);
    const index = {};
    ids.forEach((id, i) => { index[id] = i; });
    const cycles = [];
    const seen = {};

    function dfs(start, u, path, inPath) {
      const deps = (byId[u] && byId[u].deps) || [];
      for (let i = 0; i < deps.length; i++) {
        const v = deps[i];
        if (!byId[v]) continue;
        if (v === start) {
          const cyc = path.concat([v]);
          const k = cycleKey(cyc);
          if (!seen[k]) {
            seen[k] = true;
            cycles.push(rotateCycle(cyc));
          }
          continue;
        }
        if (inPath[v]) continue;
        if (index[v] < index[start]) continue;
        inPath[v] = true;
        path.push(v);
        dfs(start, v, path, inPath);
        path.pop();
        inPath[v] = false;
      }
    }

    for (let s = 0; s < ids.length; s++) {
      const start = ids[s];
      const inPath = {};
      inPath[start] = true;
      dfs(start, start, [start], inPath);
    }
    return cycles;
  }

  function formatCycles(cycles) {
    if (!cycles || !cycles.length) return '';
    return cycles.map(c => 'Cycle: ' + c.join(' → ')).join(' · ');
  }

  function addDep(tickets, parentId, childId) {
    const copy = cloneTickets(tickets);
    if (parentId === childId) return { tickets: copy, error: 'self' };
    if (wouldCycle(copy, parentId, childId)) return { tickets: copy, error: 'cycle' };
    const child = copy.find(t => t.id === childId);
    if (!child) return { tickets: copy, error: 'missing' };
    if ((child.deps || []).indexOf(parentId) >= 0) return { tickets: copy, error: 'duplicate' };
    child.deps = (child.deps || []).concat([parentId]);
    return { tickets: copy, error: null };
  }

  function removeDep(tickets, parentId, childId) {
    return cloneTickets(tickets).map(t => {
      if (t.id !== childId) return t;
      return Object.assign({}, t, { deps: (t.deps || []).filter(d => d !== parentId) });
    });
  }

  function setPts(tickets, id, pts) {
    return cloneTickets(tickets).map(t => (t.id === id ? Object.assign({}, t, { pts: pts }) : t));
  }

  function refreshAssign(assign, people, tickets, planFn, addedDep) {
    const UR = unassignApi();
    const prev = assign || {};
    let kept = {};
    Object.keys(prev).forEach(k => { kept[k] = prev[k]; });

    if (addedDep && addedDep.parentId && addedDep.childId && !prev[addedDep.parentId] && prev[addedDep.childId]) {
      const remove = UR.idsToReturn(addedDep.childId, tickets, prev);
      const nextKept = {};
      Object.keys(kept).forEach(k => { if (!remove.has(k)) nextKept[k] = kept[k]; });
      kept = nextKept;
    }

    const ids = UR.orderForRepack(Object.keys(kept), tickets, kept);
    const next = {};
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const t = tickets.find(x => x.id === id);
      const pid = kept[id].personId;
      const r = planFn(t, pid, next, people);
      if (r && !r.error) next[id] = { personId: pid, start: r.start, days: r.days };
    }

    const returned = Object.keys(prev).filter(id => !next[id]);
    return { assign: next, returned: returned };
  }

  function sizeEntry(v) {
    if (!v || typeof v !== 'object') return { tshirt: 'M', days: 1 };
    return {
      tshirt: v.tshirt || v.t || 'M',
      days: v.days != null ? v.days : (v.d != null ? v.d : 1)
    };
  }

  function exportTickets(sprint, sizes, epics, tickets) {
    const sizesOut = {};
    Object.keys(sizes || {}).forEach(k => { sizesOut[k] = sizeEntry(sizes[k]); });
    const sp = sprint || {};
    return {
      sprint: { name: sp.name, start: sp.start, days: sp.days },
      sizes: sizesOut,
      epics: epics || [],
      tickets: (tickets || []).map(t => ({
        id: t.id,
        epic: t.epic,
        title: t.title,
        pts: t.pts,
        deps: ((t.deps) || []).slice()
      }))
    };
  }

  const api = {
    stepPts, wouldCycle, findCycles, formatCycles, addDep, removeDep, setPts, cloneTickets, refreshAssign, exportTickets
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GraphEdit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
