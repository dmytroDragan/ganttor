/** Auto-plan: greedy earliest-finish scheduler with epic stickiness for sprint planner. */
(function (root) {
  const DEFAULTS = { switchGainDays: 2, maxSkewPct: 25 };

  function criticalPath(tickets, daysOf) {
    const byId = {};
    const children = {};
    tickets.forEach(t => { byId[t.id] = t; });
    tickets.forEach(t => (t.deps || []).forEach(d => { (children[d] = children[d] || []).push(t.id); }));
    const memo = {};
    const seen = {};
    const cp = (id) => {
      if (memo[id] != null) return memo[id];
      if (seen[id]) return 0;
      seen[id] = true;
      const tail = (children[id] || []).reduce((m, k) => Math.max(m, cp(k)), 0);
      memo[id] = daysOf(byId[id].pts) + tail;
      return memo[id];
    };
    tickets.forEach(t => cp(t.id));
    return memo;
  }

  function loadIn(pid, assign, ptsOf, si, sprintDays) {
    const lo = si * sprintDays;
    const hi = lo + sprintDays;
    return Object.keys(assign).reduce((s, k) => {
      const a = assign[k];
      return a.personId === pid && a.start >= lo && a.start < hi ? s + (ptsOf[k] || 0) : s;
    }, 0);
  }

  function lastEpic(pid, assign, epicOf) {
    let best = null;
    Object.keys(assign).forEach(k => {
      const a = assign[k];
      if (a.personId !== pid) return;
      const end = a.start + a.days;
      if (!best || end > best.end) best = { end, epic: epicOf[k] };
    });
    return best ? best.epic : null;
  }

  function pct(used, cap) {
    return cap > 0 ? (used / cap) * 100 : 0;
  }

  function autoPlan(assign, people, tickets, planFn, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const sprintDays = o.sprintDays;
    const daysOf = o.daysOf || (pts => pts);
    const next = Object.assign({}, assign);
    const epicOf = {};
    const ptsOf = {};
    const tickById = {};
    tickets.forEach(t => {
      epicOf[t.id] = t.epic;
      ptsOf[t.id] = t.pts;
      tickById[t.id] = t;
    });
    const cp = criticalPath(tickets, daysOf);
    const remaining = tickets.filter(t => !assign[t.id]).sort((a, b) =>
      cp[b.id] - cp[a.id] || b.pts - a.pts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const planned = [];
    const skipped = [];

    remaining.forEach(t => {
      const blocked = (t.deps || []).filter(d => tickById[d] && !next[d]);
      if (blocked.length) { skipped.push({ id: t.id, hint: 'Blocked' }); return; }

      const cands = [];
      let firstErr = null;
      people.forEach((p, order) => {
        const r = planFn(t, p.id, next, people);
        if (r.error) { if (!firstErr) firstErr = r; return; }
        const si = Math.floor(r.start / sprintDays);
        const prev = lastEpic(p.id, next, epicOf);
        cands.push({
          pid: p.id,
          start: r.start,
          days: r.days,
          finish: r.start + r.days,
          si,
          load: loadIn(p.id, next, ptsOf, si, sprintDays),
          isSwitch: prev !== null && prev !== t.epic,
          order
        });
      });
      if (!cands.length) { skipped.push({ id: t.id, hint: firstErr.hint }); return; }

      cands.sort((a, b) => a.finish - b.finish
        || (a.isSwitch - b.isSwitch)
        || a.load - b.load
        || a.order - b.order);
      const best = cands[0];
      let pick = best;
      if (best.isSwitch) {
        const sticky = cands.find(c => !c.isSwitch);
        if (sticky) {
          const pSticky = people.find(p => p.id === sticky.pid);
          const teamMean = people.reduce((s, p) => s + pct(loadIn(p.id, next, ptsOf, sticky.si, sprintDays), p.cap), 0) / people.length;
          const stickyAfter = pct(sticky.load + t.pts, pSticky.cap);
          const gainOk = sticky.finish - best.finish >= o.switchGainDays;
          const skewOk = stickyAfter - teamMean > o.maxSkewPct;
          pick = gainOk || skewOk ? best : sticky;
        }
      }

      next[t.id] = { personId: pick.pid, start: pick.start, days: pick.days };
      planned.push(t.id);
    });

    return { assign: next, planned, skipped };
  }

  const api = { DEFAULTS, criticalPath, autoPlan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AutoPlan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
