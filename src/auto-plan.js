/** Auto-plan: epic-batched earliest-finish scheduler with same-epic stickiness for sprint planner. */
(function (root) {
  const DEFAULTS = { switchGainDays: 2, maxSkewPct: 25 };
  const KIND_RANK = { same: 0, idle: 1, switch: 2 };

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

  function canTake(t, p) {
    const needed = (t.roles || []).filter(Boolean);
    return !needed.length || needed.some(r => (p.roles || []).indexOf(r) >= 0);
  }

  function autoPlan(assign, people, tickets, planFn, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const sprintDays = o.sprintDays;
    const daysOf = o.daysOf || (pts => pts);
    const capOf = o.capOf || (p => p.cap);
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
    const byPriority = (a, b) => cp[b.id] - cp[a.id] || b.pts - a.pts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const pending = new Set(tickets.filter(t => !assign[t.id]).map(t => t.id));
    const planned = [];
    const skipped = [];

    // Earliest finish among teammates, but a teammate already on this epic is kept
    // unless another one finishes at least switchGainDays earlier or load skew is high.
    const place = (t) => {
      const cands = [];
      let firstErr = null;
      people.forEach((p, order) => {
        const r = planFn(t, p.id, next, people);
        if (r.error) { if (!firstErr) firstErr = r; return; }
        const si = Math.floor(r.start / sprintDays);
        const prev = lastEpic(p.id, next, epicOf);
        const kind = prev === null ? 'idle' : prev === t.epic ? 'same' : 'switch';
        cands.push({
          pid: p.id, start: r.start, days: r.days, finish: r.start + r.days,
          kind, si, cap: capOf(p, si), load: loadIn(p.id, next, ptsOf, si, sprintDays), order
        });
      });
      if (!cands.length) return { hint: firstErr.hint };
      cands.sort((a, b) => a.finish - b.finish || KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.load - b.load || a.order - b.order);
      const best = cands[0];
      const stay = cands.find(c => c.kind === 'same');
      let pick = best;
      if (stay && stay !== best) {
        // Mean over teammates who could take this ticket, each against their capacity in that sprint.
        const pool = people.filter(p => canTake(t, p));
        const teamMean = pool.reduce((s, p) => s + pct(loadIn(p.id, next, ptsOf, stay.si, sprintDays), capOf(p, stay.si)), 0) / pool.length;
        const stayAfter = pct(stay.load + t.pts, stay.cap);
        const gainOk = stay.finish - best.finish >= o.switchGainDays;
        const skewOk = stayAfter - teamMean > o.maxSkewPct;
        if (!gainOk && !skewOk) pick = stay;
      }
      return { pid: pick.pid, start: pick.start, days: pick.days };
    };

    // Batch by epic: finish the current epic's ready tickets before starting another epic.
    let cur = null;
    while (pending.size) {
      const ready = [...pending].map(id => tickById[id])
        .filter(t => !(t.deps || []).some(d => pending.has(d)));
      if (!ready.length) {
        // Dependency cycle: nothing can start.
        [...pending].forEach(id => skipped.push({ id, hint: 'Blocked' }));
        break;
      }
      const orphans = ready.filter(t => (t.deps || []).some(d => tickById[d] && !next[d]));
      if (orphans.length) {
        orphans.forEach(t => { pending.delete(t.id); skipped.push({ id: t.id, hint: 'Blocked' }); });
        continue;
      }
      const inEpic = cur ? ready.filter(t => t.epic === cur) : [];
      const t = (inEpic.length ? inEpic : ready).slice().sort(byPriority)[0];
      cur = t.epic;
      pending.delete(t.id);
      const r = place(t);
      if (r.hint) skipped.push({ id: t.id, hint: r.hint });
      else {
        next[t.id] = { personId: r.pid, start: r.start, days: r.days };
        planned.push(t.id);
      }
    }

    return { assign: next, planned, skipped };
  }

  const api = { DEFAULTS, criticalPath, autoPlan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AutoPlan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
