/** Feature-flag visibility + dep-bridging projection over a ticket backlog. */
(function (root) {
  function featureList(t) {
    return (t && Array.isArray(t.features)) ? t.features : [];
  }

  function isOn(featureFlags, name) {
    if (!featureFlags || featureFlags[name] === undefined) return true;
    return !!featureFlags[name];
  }

  function isVisible(ticket, featureFlags) {
    const feats = featureList(ticket);
    if (!feats.length) return true;
    for (let i = 0; i < feats.length; i++) {
      if (isOn(featureFlags, feats[i])) return true;
    }
    return false;
  }

  function listFeatures(tickets) {
    const set = {};
    (tickets || []).forEach(t => {
      featureList(t).forEach(f => { if (f) set[f] = true; });
    });
    return Object.keys(set).sort();
  }

  function bridgeParents(childId, ticketsById, visible) {
    const out = [];
    const seen = {};
    const walk = (id) => {
      if (!id || seen[id]) return;
      seen[id] = true;
      if (visible[id]) {
        if (id !== childId && out.indexOf(id) < 0) out.push(id);
        return;
      }
      const t = ticketsById[id];
      const deps = (t && t.deps) || [];
      for (let i = 0; i < deps.length; i++) walk(deps[i]);
    };
    const child = ticketsById[childId];
    ((child && child.deps) || []).forEach(walk);
    return out;
  }

  function projectTickets(tickets, featureFlags) {
    const list = tickets || [];
    const byId = {};
    list.forEach(t => { byId[t.id] = t; });
    const visible = {};
    list.forEach(t => { if (isVisible(t, featureFlags)) visible[t.id] = true; });
    return list.filter(t => visible[t.id]).map(t => {
      const next = Object.assign({}, t, { deps: bridgeParents(t.id, byId, visible) });
      if (Array.isArray(t.features)) next.features = t.features.slice();
      else delete next.features;
      return next;
    });
  }

  const api = { isVisible, listFeatures, projectTickets };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.FeatureFlags = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
