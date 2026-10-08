/** Multi-sprint horizon + no-split assignment packing for sprint planner. */
(function (root) {
  const MAX_SPRINTS = 7;
  const GANTT_DAY_PX = [28, 40, 58, 76, 96];

  function sprintIndex(start, sprintDays) {
    return Math.floor(start / sprintDays);
  }

  function visibleSprintCount(assign, sprintDays, maxSprints) {
    const cap = maxSprints == null ? MAX_SPRINTS : maxSprints;
    let n = 1;
    Object.keys(assign || {}).forEach(id => {
      const a = assign[id];
      if (!a) return;
      n = Math.max(n, Math.floor((a.start + a.days - 1e-9) / sprintDays) + 1);
    });
    return Math.min(Math.max(1, n), cap);
  }

  function stepDayPx(current, dir) {
    const i = GANTT_DAY_PX.indexOf(current);
    const at = i < 0 ? 2 : i;
    const j = Math.max(0, Math.min(GANTT_DAY_PX.length - 1, at + dir));
    return GANTT_DAY_PX[j];
  }

  function stripLaterSprints(assign, sprintDays) {
    const next = {};
    Object.keys(assign || {}).forEach(k => {
      if (assign[k].start < sprintDays) next[k] = assign[k];
    });
    return next;
  }

  function ticketPts(tickets, id) {
    const t = tickets.find(x => x.id === id);
    return t ? t.pts : 0;
  }

  function usedInSprint(pid, assign, tickets, si, sprintDays) {
    const lo = si * sprintDays;
    const hi = lo + sprintDays;
    return Object.keys(assign).filter(k => {
      const a = assign[k];
      return a.personId === pid && a.start >= lo && a.start < hi;
    }).reduce((s, k) => s + ticketPts(tickets, k), 0);
  }

  function planAssignment(t, pid, assign, people, tickets, opts) {
    const sprintDays = opts.sprintDays;
    const maxSprints = opts.maxSprints;
    const daysOf = opts.daysOf;
    const strict = opts.strict;
    const p = people.find(x => x.id === pid);
    const first = (p.name.trim().split(' ')[0] || 'They');
    const dur = daysOf(t.pts);

    if (dur > sprintDays + 1e-9) {
      return { error: `${t.id} needs ${dur} days — a sprint is only ${sprintDays}.`, hint: 'Too long' };
    }
    if (t.pts > p.cap) {
      return { error: `${first} has ${p.cap} pts per sprint — ${t.id} needs ${t.pts}.`, hint: 'Over capacity' };
    }

    let depsEnd = 0;
    const missing = [];
    (t.deps || []).forEach(d => {
      const a = assign[d];
      if (!a) missing.push(d);
      else depsEnd = Math.max(depsEnd, a.start + a.days);
    });
    if (missing.length && strict) {
      return { error: `${t.id} is blocked by ${missing.join(' + ')} — schedule ${missing.length > 1 ? 'those' : 'that'} first.`, hint: 'Blocked' };
    }

    const busy = Object.keys(assign).filter(k => assign[k].personId === pid)
      .map(k => [assign[k].start, assign[k].start + assign[k].days]).sort((a, b) => a[0] - b[0]);

    let start = depsEnd;
    for (let guard = 0; guard < maxSprints + 2; guard++) {
      const si = Math.floor(start / sprintDays);
      if (si < 0 || si >= maxSprints) {
        return { error: `${t.id} would finish on day ${(start + dur).toFixed(1)} — past the sprint end.`, hint: 'Past sprint' };
      }
      const sprintStart = si * sprintDays;
      const sprintEnd = sprintStart + sprintDays;
      const used = usedInSprint(pid, assign, tickets, si, sprintDays);
      if (used + t.pts > p.cap) {
        if (si + 1 >= maxSprints) {
          return { error: `${first} has ${Math.max(0, p.cap - used)} pts left — ${t.id} needs ${t.pts}.`, hint: 'Over capacity' };
        }
        start = sprintEnd;
        continue;
      }
      let cursor = Math.max(start, sprintStart);
      for (const [s, e] of busy) {
        if (cursor + dur <= s + 1e-9) break;
        if (e > cursor) cursor = e;
      }
      if (cursor + dur > sprintEnd + 1e-9) {
        start = sprintEnd;
        continue;
      }
      return { start: cursor, days: dur, warn: missing.length ? `Scheduled before ${missing.join(', ')}` : null };
    }
    return { error: `${t.id} would finish on day ${(start + dur).toFixed(1)} — past the sprint end.`, hint: 'Past sprint' };
  }

  const api = {
    MAX_SPRINTS, GANTT_DAY_PX,
    sprintIndex, visibleSprintCount, stepDayPx, stripLaterSprints, planAssignment
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SprintHorizon = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
