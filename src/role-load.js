/** Per-role planned / capacity / fill for the header. */
(function (root) {
  function hasRole(list, roleId) {
    return ((list || []).indexOf(roleId) >= 0);
  }

  function summarize(roleIds, people, tickets, assign, effCapOf) {
    const byId = {};
    (tickets || []).forEach(t => { if (t && t.id) byId[t.id] = t; });
    const capOf = typeof effCapOf === 'function' ? effCapOf : (() => 0);
    const ids = roleIds || [];
    return ids.map(roleId => {
      const peopleR = (people || []).filter(p => hasRole(p && p.roles, roleId));
      const personSet = {};
      peopleR.forEach(p => { personSet[p.id] = true; });
      let capacity = 0;
      peopleR.forEach(p => { capacity += (+capOf(p) || 0); });
      let planned = 0;
      const asg = assign || {};
      Object.keys(asg).forEach(tid => {
        const a = asg[tid];
        if (!a || !personSet[a.personId]) return;
        const t = byId[tid];
        if (!t) return;
        planned += (+t.pts || 0);
      });
      let demand = 0;
      (tickets || []).forEach(t => {
        if (!t || !hasRole(t.roles, roleId)) return;
        demand += (+t.pts || 0);
      });
      const fillPct = capacity ? Math.min(100, (planned / capacity) * 100) : 0;
      return { id: roleId, planned, demand, capacity, fillPct };
    });
  }

  const api = { summarize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RoleLoad = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
