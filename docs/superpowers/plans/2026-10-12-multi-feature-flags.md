# Multi-feature Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project the backlog through on/off feature flags so hidden tickets leave the graph and Gantt, deps bridge across gaps, and save/export use the projection while the full backlog stays in memory.

**Architecture:** Pure `FeatureFlags` module (`isVisible`, `listFeatures`, `projectTickets`) over source `this.TICKETS`. App state holds `featureFlags`; layout, scheduling, download, and plan totals consume `visibleTickets()`. Flags persist in `sprint-plan.json` and undo snapshots. Source tickets are never mutated by toggles.

**Tech Stack:** Vanilla JS IIFE modules (browser + `require` for Node tests), `node --test` / `assert`, Design Component UI in `index.html`, JSON plan/tickets files.

## Global Constraints

- Follow `docs/superpowers/specs/2026-10-12-multi-feature-flags-design.md` and `CONTEXT.md` terms
- Hide iff ticket has ≥1 feature **and** every listed feature is off; untagged always visible
- Missing flag key → **on**; never mutate source tickets in `projectTickets`
- Download tickets + save plan totals/gantt use the **projection**; re-enable → tickets return **unassigned**
- No UI tag editor in v1; bump `package.json` version for the feature (0.2.0 → 0.3.0)
- Run tests via `npm test` (update the `test` script when adding the new file)
- Do not commit unless the user asks

## File map

| File | Role |
|------|------|
| `src/feature-flags.js` | Visibility, list features, project + bridge deps |
| `test/feature-flags.test.js` | Unit tests for the module |
| `src/graph-edit.js` | `cloneTickets` / `exportTickets` preserve `features` |
| `index.html` | State, toolbar, `visibleTickets()`, toggle, save/load/undo, wire layout/plan |
| `data/tickets.json` | Sample `features` on a few tickets |
| `package.json` | Version + test script entry |
| `README.md` | Feature bullet + data/save-load note |

---

### Task 1: FeatureFlags projection module (TDD)

**Files:**
- Create: `src/feature-flags.js`
- Create: `test/feature-flags.test.js`
- Modify: `package.json` (add test file to `"test"` script; bump version to `0.3.0`)

**Interfaces:**
- Consumes: nothing (pure)
- Produces:
  - `isVisible(ticket, featureFlags) → boolean`
  - `listFeatures(tickets) → string[]` (sorted unique)
  - `projectTickets(tickets, featureFlags) → ticket[]` (new objects; bridged `deps`; copies `features` when present)

- [ ] **Step 1: Write the failing test file**

```js
const assert = require('assert');
const F = require('../src/feature-flags.js');

const flags = (o) => o;

assert.strictEqual(F.isVisible({ id: 'A', deps: [] }, {}), true, 'untagged');
assert.strictEqual(F.isVisible({ id: 'A', features: [], deps: [] }, {}), true, 'empty features');
assert.strictEqual(
  F.isVisible({ id: 'A', features: ['payments', '3ds'], deps: [] }, { payments: false, '3ds': true }),
  true,
  'any on keeps'
);
assert.strictEqual(
  F.isVisible({ id: 'A', features: ['payments', '3ds'], deps: [] }, { payments: false, '3ds': false }),
  false,
  'all off hides'
);
assert.strictEqual(
  F.isVisible({ id: 'A', features: ['payments'], deps: [] }, {}),
  true,
  'missing flag defaults on'
);

assert.deepStrictEqual(
  F.listFeatures([
    { id: 'A', features: ['3ds', 'payments'] },
    { id: 'B', features: ['payments'] },
    { id: 'C' }
  ]),
  ['3ds', 'payments']
);

const src = [
  { id: 'A', pts: 1, deps: [], features: ['core'] },
  { id: 'B', pts: 1, deps: ['A'], features: ['payments'] },
  { id: 'C', pts: 1, deps: ['B'], features: ['core'] }
];
const out = F.projectTickets(src, { payments: false, core: true });
assert.deepStrictEqual(out.map(t => t.id), ['A', 'C']);
assert.deepStrictEqual(out.find(t => t.id === 'C').deps, ['A'], 'bridge A→B→C');
assert.notStrictEqual(out[0], src[0], 'new objects');
src[2].deps.push('X');
assert.deepStrictEqual(out.find(t => t.id === 'C').deps, ['A'], 'no mutate source deps');

const chain = [
  { id: 'A', deps: [] },
  { id: 'B', deps: ['A'], features: ['x'] },
  { id: 'C', deps: ['B'], features: ['x'] },
  { id: 'D', deps: ['C'] }
];
assert.deepStrictEqual(
  F.projectTickets(chain, { x: false }).find(t => t.id === 'D').deps,
  ['A'],
  'collapse hidden chain'
);

const multi = [
  { id: 'A', deps: [] },
  { id: 'B', deps: [] },
  { id: 'H', deps: ['A', 'B'], features: ['x'] },
  { id: 'C', deps: ['H'] }
];
assert.deepStrictEqual(
  F.projectTickets(multi, { x: false }).find(t => t.id === 'C').deps.sort(),
  ['A', 'B'],
  'multi parent bridge'
);

console.log('feature-flags.test.js: ok');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/feature-flags.test.js`  
Expected: FAIL (`Cannot find module '../src/feature-flags.js'` or missing exports)

- [ ] **Step 3: Implement `src/feature-flags.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node test/feature-flags.test.js`  
Expected: `feature-flags.test.js: ok`

- [ ] **Step 5: Register in npm test + bump version**

In `package.json`: set `"version": "0.3.0"` and append `test/feature-flags.test.js` to the `"test"` script list.

Run: `npm test`  
Expected: all suites pass including feature-flags

- [ ] **Step 6: Commit** (only if user asked to commit)

```bash
git add src/feature-flags.js test/feature-flags.test.js package.json
git commit -m "Add feature-flag projection with dep bridging."
```

---

### Task 2: Preserve `features` in clone/export

**Files:**
- Modify: `src/graph-edit.js` (`cloneTickets`, `exportTickets`)
- Modify: `test/graph-edit.test.js` (one assertion on export/clone)

**Interfaces:**
- Consumes: tickets that may include `features: string[]`
- Produces: clone/export that keep `features` when present (omit key when absent)

- [ ] **Step 1: Extend export/clone test**

In `test/graph-edit.test.js`, add:

```js
{
  const src = [
    { id: 'A', epic: 'E', title: 'a', pts: 1, deps: [], features: ['payments'] },
    { id: 'B', epic: 'E', title: 'b', pts: 2, deps: ['A'] }
  ];
  const copy = G.cloneTickets(src);
  assert.deepStrictEqual(copy[0].features, ['payments']);
  copy[0].features.push('x');
  assert.deepStrictEqual(src[0].features, ['payments'], 'clone copies features array');
  const out = G.exportTickets({ name: 'S', start: '2026-01-01', days: 10 }, { 1: { tshirt: 'XS', days: 1 } }, [], src);
  assert.deepStrictEqual(out.tickets[0].features, ['payments']);
  assert.strictEqual(out.tickets[1].features, undefined);
}
```

- [ ] **Step 2: Run to verify fail**

Run: `node test/graph-edit.test.js`  
Expected: FAIL on features assertion

- [ ] **Step 3: Patch `cloneTickets` and `exportTickets`**

`cloneTickets`:

```js
function cloneTickets(tickets) {
  return (tickets || []).map(t => {
    const next = Object.assign({}, t, { deps: ((t && t.deps) || []).slice() });
    if (t && Array.isArray(t.features)) next.features = t.features.slice();
    return next;
  });
}
```

In `exportTickets` ticket map, include features when present:

```js
tickets: (tickets || []).map(t => {
  const row = {
    id: t.id,
    epic: t.epic,
    title: t.title,
    pts: t.pts,
    deps: ((t.deps) || []).slice()
  };
  if (Array.isArray(t.features) && t.features.length) row.features = t.features.slice();
  return row;
})
```

- [ ] **Step 4: Run tests**

Run: `node test/graph-edit.test.js && npm test`  
Expected: pass

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add src/graph-edit.js test/graph-edit.test.js
git commit -m "Preserve ticket features in clone and export."
```

---

### Task 3: Wire flags into the app (UI, projection, save/load/undo)

**Files:**
- Modify: `index.html` (script tag, state, toolbar, helpers, save/load/undo, layout/plan/download paths)
- Modify: `data/tickets.json` (sample features)
- Modify: `README.md` (feature bullet + data/save-load note)

**Interfaces:**
- Consumes: `FeatureFlags.isVisible`, `listFeatures`, `projectTickets` from Task 1; `GraphEdit.exportTickets` from Task 2
- Produces: `state.featureFlags`, `visibleTickets()`, `setFeatureFlag(name, on)`, plan field `featureFlags`

- [ ] **Step 1: Load script**

After the other `src/` scripts (before app body logic):

```html
<script src="./src/feature-flags.js"></script>
```

- [ ] **Step 2: State + helpers**

Add to `state`:

```js
featureFlags: {},
```

Add methods on the planner component:

```js
visibleTickets() {
  return FeatureFlags.projectTickets(this.TICKETS, this.state.featureFlags);
}

ticket(id) {
  return this.visibleTickets().find(t => t.id === id) || this.TICKETS.find(t => t.id === id);
}

sourceTicket(id) {
  return this.TICKETS.find(t => t.id === id);
}
```

Keep graph **mutations** on `this.TICKETS` / `sourceTicket`. Keep **layout, edges, readiness, assign planning, unassign cascade, save totals, download** on `visibleTickets()` (replace `this.TICKETS` in those paths — `layout`, node/edge builders, `plan` / `planWithTickets` callers for assign, `downloadTickets`, `savePlan` backlog/unplanned counts and gantt ticket lookups via `ticket()`).

For `savePlan` gantt rows, resolve ticket via visible set (assigned hidden ids should already be stripped on toggle). Include:

```js
featureFlags: Object.assign({}, this.state.featureFlags),
```

in the saved JSON root (sibling of `gantt` / `capacityPlan`).

- [ ] **Step 3: Undo snapshots**

```js
snapBoard(s) {
  return {
    people: s.people,
    assign: s.assign,
    multiSprint: !!s.multiSprint,
    featureFlags: Object.assign({}, s.featureFlags || {}),
    tickets: GraphEdit.cloneTickets(this.TICKETS)
  };
}

boardFromSnap(snap) {
  if (snap.tickets) this.TICKETS = GraphEdit.cloneTickets(snap.tickets);
  this.nextPid = this.maxNextPid(snap.people);
  return {
    people: snap.people,
    assign: snap.assign,
    multiSprint: !!snap.multiSprint,
    featureFlags: Object.assign({}, snap.featureFlags || {})
  };
}
```

- [ ] **Step 4: Toggle handler**

```js
setFeatureFlag = (name, on) => {
  this.commit(s => {
    const featureFlags = Object.assign({}, s.featureFlags, { [name]: !!on });
    const visible = FeatureFlags.projectTickets(this.TICKETS, featureFlags);
    const keep = {};
    visible.forEach(t => { keep[t.id] = true; });
    const assign = {};
    Object.keys(s.assign).forEach(id => {
      if (keep[id]) assign[id] = s.assign[id];
    });
    const packed = UnassignRecalc.repackAssign(
      assign, s.people, visible,
      (t, pid, a, p) => this.planWithTickets(visible, t, pid, a, p)
    );
    return { featureFlags, assign: packed };
  });
  this.say('ok', on ? `Feature “${name}” on` : `Feature “${name}” off`);
};
```

- [ ] **Step 5: Load / download**

In `applyPlan`, after reading sprint/people/gantt, before repack:

```js
const featureFlags = (data.featureFlags && typeof data.featureFlags === 'object')
  ? Object.assign({}, data.featureFlags)
  : {};
```

Build `assign` only for tickets that exist; then:

```js
const visible = FeatureFlags.projectTickets(this.TICKETS, featureFlags);
// drop assign entries not in visible
Object.keys(assign).forEach(id => { if (!visible.find(t => t.id === id)) delete assign[id]; });
let packed = UnassignRecalc.repackAssign(
  assign, people, visible,
  (t, pid, a, p) => SprintHorizon.planAssignment(t, pid, a, p, visible, { /* same opts as today */ })
);
this.commit(() => ({ people, assign: packed, multiSprint, featureFlags }));
```

`downloadTickets`:

```js
downloadTickets = () => {
  const vis = this.visibleTickets();
  const out = GraphEdit.exportTickets(this.SPRINT, this.SIZES, this.EPICS, vis);
  // ...same blob download...
  this.say('ok', `Downloaded tickets.json — ${vis.length} ticket${vis.length === 1 ? '' : 's'}`);
};
```

- [ ] **Step 6: Toolbar UI**

Near Multi-sprint / Edit, when `FeatureFlags.listFeatures(this.TICKETS).length`:

Render a compact “Features” group: for each name, a checkbox bound to `featureFlags[name] !== false`, `onChange` → `setFeatureFlag(name, checked)`.

Pass handlers/flags through the existing render props object (same pattern as `toggleMultiSprint`).

**Bridged-edge edit:** In `onEdgeClick`, before `removeDep`:

```js
const src = this.sourceTicket(childId);
if (!src || (src.deps || []).indexOf(parentId) < 0) {
  this.say('info', 'Bridged dependency — re-enable features to edit');
  return;
}
```

Pts / addDep stay on source tickets that are visible (both endpoints visible ⇒ safe).

- [ ] **Step 7: Sample data**

In `data/tickets.json`, tag a slice so toggles are demoable, e.g.:

- `PAY-203`, `PAY-206`: `"features": ["3ds"]`
- `ORD-305`: `"features": ["upsell"]`
- `PAY-202`, `PAY-204`: `"features": ["payments"]` (and keep `PAY-203` as `["payments","3ds"]` if desired)

Enough that turning **3ds** off hides some nodes and bridges edges.

- [ ] **Step 8: README**

Under “What you get”, add one bullet for feature flags. In Data files / Save load: note optional `features` on tickets and `featureFlags` on the plan; download/export reflects the active projection.

- [ ] **Step 9: Manual smoke**

Run: `npm start` → open app  
- Features control visible  
- Turn **3ds** off → those tickets leave graph + Gantt; edges bridge  
- Save plan → JSON contains `featureFlags`  
- Download tickets → omitted hidden rows, bridged deps  
- Undo restores flags + assign  

Run: `npm test`  
Expected: all pass

- [ ] **Step 10: Commit** (only if user asked)

```bash
git add index.html data/tickets.json README.md package.json
git commit -m "Wire multi-feature flags into graph, Gantt, and save/export."
```

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| `features[]` + hide-all-off / untagged always on | Task 1 |
| Dep bridging A→B→C → A→C | Task 1 |
| View projection, no source mutate | Task 1 + 3 |
| Toolbar toggles | Task 3 |
| Graph + Gantt use projection | Task 3 |
| Save/export strip hidden + bridged deps | Task 3 |
| `featureFlags` in plan + load default on | Task 3 |
| Undo includes flags | Task 3 |
| Re-enable → unassigned | Task 3 |
| clone/export preserve features | Task 2 |
| Sample data + README | Task 3 |
| No tag editor v1 | (omitted) |

## Placeholder / consistency check

- API names stable: `isVisible`, `listFeatures`, `projectTickets`, `visibleTickets`, `setFeatureFlag`, `featureFlags`
- Bridged-edge edit guarded so removeDep cannot target synthetic edges
