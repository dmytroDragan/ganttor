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

  function blockDaySet(blocks, dates) {
    const set = new Set();
    if (!dates || !dates.length) return set;
    (blocks || []).forEach(b => {
      if (!b || !b.start) return;
      const lo = b.start;
      const hi = b.end || b.start;
      dates.forEach((d, i) => { if (d >= lo && d <= hi) set.add(i); });
    });
    return set;
  }

  function blockedInSprint(blocked, si, sprintDays) {
    let n = 0;
    const lo = si * sprintDays;
    const hi = lo + sprintDays;
    (blocked || []).forEach(i => { if (i >= lo && i < hi) n++; });
    return n;
  }

  function effectiveCap(cap, sprintDays, blockedCount) {
    if (sprintDays <= 0) return 0;
    const avail = Math.max(0, sprintDays - blockedCount);
    return Math.floor(cap * avail / sprintDays);
  }

  function spanEnd(start, workDays, blocked) {
    let work = 0;
    let i = start;
    const extra = blocked && typeof blocked.size === 'number' ? blocked.size : 0;
    const guard = start + workDays + extra + 2;
    while (work < workDays && i < guard) {
      if (!blocked || !blocked.has(i)) work++;
      i++;
    }
    return i;
  }

  function skipBlocked(cursor, blocked, sprintEnd) {
    let c = cursor;
    while (blocked && blocked.has(Math.floor(c)) && c < sprintEnd) c++;
    return c;
  }

  function placeInSprint(cursor, dur, blocked, busy, sprintStart, sprintEnd) {
    cursor = Math.max(cursor, sprintStart);
    cursor = skipBlocked(cursor, blocked, sprintEnd);
    for (let guard = 0; guard < busy.length + 5; guard++) {
      let moved = false;
      for (const [s, e] of busy) {
        const end = spanEnd(cursor, dur, blocked);
        if (end <= s + 1e-9) break;
        if (e > cursor) {
          cursor = skipBlocked(e, blocked, sprintEnd);
          moved = true;
        }
      }
      if (moved) continue;

      let work = 0;
      for (let i = cursor; i < sprintEnd && work < dur; i++) {
        if (!blocked || !blocked.has(i)) work++;
      }
      if (work < dur - 1e-9) return null;
      const end = spanEnd(cursor, dur, blocked);
      if (end > sprintEnd + 1e-9) return null;
      return cursor;
    }
    return null;
  }

  function planAssignment(t, pid, assign, people, tickets, opts) {
    const sprintDays = opts.sprintDays;
    const maxSprints = opts.maxSprints;
    const daysOf = opts.daysOf;
    const strict = opts.strict;
    const p = people.find(x => x.id === pid);
    const first = (p.name.trim().split(' ')[0] || 'They');
    const dur = daysOf(t.pts);
    const blocked = blockDaySet(p.blocks, opts.dates);
    const needed = (t.roles || []).filter(Boolean);
    if (needed.length) {
      const have = new Set((p.roles || []).filter(Boolean));
      if (!needed.some(r => have.has(r))) {
        return { error: `${first} cannot take ${t.id} (needs ${needed.join(', ')}).`, hint: 'Wrong role' };
      }
    }

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
      else {
        const owner = people.find(x => x.id === a.personId);
        const depBlocked = blockDaySet(owner && owner.blocks, opts.dates);
        depsEnd = Math.max(depsEnd, spanEnd(a.start, a.days, depBlocked));
      }
    });
    if (missing.length && strict) {
      return { error: `${t.id} is blocked by ${missing.join(' + ')} — schedule ${missing.length > 1 ? 'those' : 'that'} first.`, hint: 'Blocked' };
    }

    const busy = Object.keys(assign).filter(k => assign[k].personId === pid)
      .map(k => {
        const a = assign[k];
        return [a.start, spanEnd(a.start, a.days, blocked)];
      }).sort((a, b) => a[0] - b[0]);

    let start = depsEnd;
    for (let guard = 0; guard < maxSprints + 2; guard++) {
      const si = Math.floor(start / sprintDays);
      if (si < 0 || si >= maxSprints) {
        return { error: `${t.id} would finish on day ${(start + dur).toFixed(1)} — past the sprint end.`, hint: 'Past sprint' };
      }
      const sprintStart = si * sprintDays;
      const sprintEnd = sprintStart + sprintDays;
      const eCap = effectiveCap(p.cap, sprintDays, blockedInSprint(blocked, si, sprintDays));
      const used = usedInSprint(pid, assign, tickets, si, sprintDays);
      if (used + t.pts > eCap) {
        if (si + 1 >= maxSprints) {
          return { error: `${first} has ${Math.max(0, eCap - used)} pts left — ${t.id} needs ${t.pts}.`, hint: 'Over capacity' };
        }
        start = sprintEnd;
        continue;
      }
      const placed = placeInSprint(Math.max(start, sprintStart), dur, blocked, busy, sprintStart, sprintEnd);
      if (placed == null) {
        start = sprintEnd;
        continue;
      }
      return { start: placed, days: dur, warn: missing.length ? `Scheduled before ${missing.join(', ')}` : null };
    }
    return { error: `${t.id} would finish on day ${(start + dur).toFixed(1)} — past the sprint end.`, hint: 'Past sprint' };
  }

  const api = {
    MAX_SPRINTS, GANTT_DAY_PX,
    sprintIndex, visibleSprintCount, stepDayPx, stripLaterSprints, planAssignment,
    blockDaySet, blockedInSprint, effectiveCap, spanEnd
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SprintHorizon = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
