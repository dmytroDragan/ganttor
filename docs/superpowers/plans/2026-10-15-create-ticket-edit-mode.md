# Create Ticket in Edit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In graph Edit mode, open a small form to create a ticket (epic, id, title, pts, roles, features, deps); persist via Download tickets with the full backlog.

**Architecture:** Pure `suggestTicketId` / `listFeatureNames` / `createTicket` in `src/graph-edit.js`. Modal + catalogs in `index.html`; save through existing `applyGraphEdit` / undo. Role catalog loaded from `team.json` `roles`.

**Tech Stack:** Vanilla JS IIFE (`GraphEdit`), `node --test` / `assert`, Design Component UI in `index.html`.

## Global Constraints

- Follow `docs/superpowers/specs/2026-10-15-create-ticket-edit-mode-design.md` and `CONTEXT.md` terms
- Id suggest: max numeric `{epicId}-<digits>` suffix + 1, else `{epicId}-101`
- Empty roles/features omitted on the created row (same as `exportTickets`)
- Re-suggest id on epic change only if id still equals previous suggestion
- Bump `package.json` version `0.7.3` → `0.8.0`
- Do not commit unless the user asks

## File map

| File | Role |
|------|------|
| `src/graph-edit.js` | `suggestTicketId`, `listFeatureNames`, `createTicket`; clone `roles` in `cloneTickets` |
| `test/graph-edit.test.js` | Unit tests for the above |
| `index.html` | Edit-mode **+ New ticket**, modal, catalogs, wiring |
| `package.json` | Version `0.8.0` |
| `README.md` | Graph Edit create + Download note |

---

### Task 1: GraphEdit create helpers (TDD)

**Files:**
- Modify: `src/graph-edit.js`
- Modify: `test/graph-edit.test.js`
- Modify: `package.json` (version `0.8.0`)

**Interfaces:**
- Produces:
  - `suggestTicketId(tickets, epicId) → string`
  - `listFeatureNames(tickets) → string[]` (sorted unique)
  - `createTicket(tickets, input, opts) → { tickets, ticket, error? }`
    - `input`: `{ id, epic, title, pts, roles?, features?, deps? }`
    - `opts`: `{ epicIds: string[], sizeKeys: number[] }`
    - `error`: `'Title required' | 'Id required' | 'Id already exists' | 'Invalid epic' | 'Invalid points' | 'Unknown dependency: X' | 'Cannot depend on itself' | cycle message string`
  - `cloneTickets` also copies `roles` arrays

- [ ] **Step 1: Append failing tests** to `test/graph-edit.test.js`:

```js
{
  assert.strictEqual(G.suggestTicketId([], 'CHK'), 'CHK-101');
  assert.strictEqual(
    G.suggestTicketId([{ id: 'CHK-106', epic: 'CHK' }, { id: 'PAY-201', epic: 'PAY' }], 'CHK'),
    'CHK-107'
  );
  assert.strictEqual(
    G.suggestTicketId([{ id: 'CHK-101', epic: 'CHK' }, { id: 'CHK-103', epic: 'CHK' }], 'CHK'),
    'CHK-104',
    'max+1 not fill gaps'
  );
}

{
  assert.deepStrictEqual(
    G.listFeatureNames([
      { features: ['3ds', 'payments'] },
      { features: ['payments'] },
      { features: [] },
      {}
    ]),
    ['3ds', 'payments']
  );
}

{
  const opts = { epicIds: ['CHK', 'PAY'], sizeKeys: [1, 2, 3, 5, 8] };
  const base = [{ id: 'CHK-101', epic: 'CHK', title: 'a', pts: 1, deps: [] }];
  const { tickets, ticket, error } = G.createTicket(base, {
    id: 'CHK-102', epic: 'CHK', title: ' New work ', pts: 3,
    roles: ['frontend'], features: ['payments'], deps: ['CHK-101']
  }, opts);
  assert.strictEqual(error, undefined);
  assert.strictEqual(ticket.id, 'CHK-102');
  assert.strictEqual(ticket.title, 'New work');
  assert.deepStrictEqual(ticket.roles, ['frontend']);
  assert.deepStrictEqual(ticket.features, ['payments']);
  assert.deepStrictEqual(ticket.deps, ['CHK-101']);
  assert.strictEqual(tickets.length, 2);
  assert.strictEqual(base.length, 1, 'source unchanged');
}

{
  const opts = { epicIds: ['CHK'], sizeKeys: [1, 2, 3] };
  const base = [{ id: 'CHK-101', epic: 'CHK', title: 'a', pts: 1, deps: [] }];
  assert.strictEqual(G.createTicket(base, { id: 'CHK-102', epic: 'CHK', title: '  ', pts: 1 }, opts).error, 'Title required');
  assert.strictEqual(G.createTicket(base, { id: 'CHK-101', epic: 'CHK', title: 'x', pts: 1 }, opts).error, 'Id already exists');
  assert.strictEqual(G.createTicket(base, { id: 'CHK-102', epic: 'CHK', title: 'x', pts: 1, deps: ['NOPE'] }, opts).error, 'Unknown dependency: NOPE');
  assert.strictEqual(G.createTicket(base, { id: 'CHK-102', epic: 'CHK', title: 'x', pts: 1, deps: ['CHK-102'] }, opts).error, 'Cannot depend on itself');
  const empty = G.createTicket(base, { id: 'CHK-102', epic: 'CHK', title: 'x', pts: 1, roles: [], features: [] }, opts);
  assert.strictEqual(empty.ticket.roles, undefined);
  assert.strictEqual(empty.ticket.features, undefined);
}

{
  const src = [{ id: 'A', epic: 'E', title: 'a', pts: 1, deps: [], roles: ['frontend'] }];
  const copy = G.cloneTickets(src);
  copy[0].roles.push('backend');
  assert.deepStrictEqual(src[0].roles, ['frontend'], 'clone copies roles array');
}
```

- [ ] **Step 2: Run tests — expect FAIL** on missing exports

```bash
npm test
```

- [ ] **Step 3: Implement** in `src/graph-edit.js` (export on `api`):

```js
function suggestTicketId(tickets, epicId) {
  const re = new RegExp('^' + String(epicId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-(\\d+)$');
  let max = 100;
  let found = false;
  (tickets || []).forEach(t => {
    const m = t && t.id && String(t.id).match(re);
    if (!m) return;
    found = true;
    const n = +m[1];
    if (n > max) max = n;
  });
  return found ? epicId + '-' + (max + 1) : epicId + '-101';
}

function listFeatureNames(tickets) {
  const set = {};
  (tickets || []).forEach(t => {
    ((t && t.features) || []).forEach(f => { if (f) set[f] = true; });
  });
  return Object.keys(set).sort();
}

function createTicket(tickets, input, opts) {
  const epicIds = (opts && opts.epicIds) || [];
  const sizeKeys = (opts && opts.sizeKeys) || [];
  const id = input && input.id != null ? String(input.id).trim() : '';
  const title = input && input.title != null ? String(input.title).trim() : '';
  const epic = input && input.epic;
  const pts = input && input.pts;
  if (!title) return { tickets: tickets || [], ticket: null, error: 'Title required' };
  if (!id) return { tickets: tickets || [], ticket: null, error: 'Id required' };
  if ((tickets || []).some(t => t.id === id)) return { tickets: tickets || [], ticket: null, error: 'Id already exists' };
  if (epicIds.indexOf(epic) < 0) return { tickets: tickets || [], ticket: null, error: 'Invalid epic' };
  if (sizeKeys.indexOf(+pts) < 0 && sizeKeys.indexOf(pts) < 0) {
    return { tickets: tickets || [], ticket: null, error: 'Invalid points' };
  }
  const deps = ((input && input.deps) || []).slice();
  for (let i = 0; i < deps.length; i++) {
    const d = deps[i];
    if (d === id) return { tickets: tickets || [], ticket: null, error: 'Cannot depend on itself' };
    if (!(tickets || []).some(t => t.id === d)) {
      return { tickets: tickets || [], ticket: null, error: 'Unknown dependency: ' + d };
    }
  }
  const ticket = { id, epic, title, pts: +pts, deps };
  const roles = ((input && input.roles) || []).filter(Boolean);
  const features = ((input && input.features) || []).filter(Boolean);
  if (roles.length) ticket.roles = roles;
  if (features.length) ticket.features = features;
  const next = cloneTickets(tickets);
  next.push(Object.assign({}, ticket, {
    deps: deps.slice(),
    roles: ticket.roles ? ticket.roles.slice() : undefined,
    features: ticket.features ? ticket.features.slice() : undefined
  }));
  if (!ticket.roles) delete next[next.length - 1].roles;
  if (!ticket.features) delete next[next.length - 1].features;
  for (let i = 0; i < deps.length; i++) {
    if (wouldCycle(next, deps[i], id)) {
      return { tickets: tickets || [], ticket: null, error: 'Would cycle: ' + deps[i] + ' → … → ' + id };
    }
  }
  return { tickets: next, ticket: next[next.length - 1], error: undefined };
}
```

Also update `cloneTickets` to copy `roles` like `features`.

- [ ] **Step 4: Run `npm test` — expect PASS**
- [ ] **Step 5: Bump version** in `package.json` to `0.8.0`

---

### Task 2: Modal UI + README

**Files:**
- Modify: `index.html`
- Modify: `README.md`

**Interfaces:**
- Consumes: `GraphEdit.suggestTicketId`, `createTicket`, `listFeatureNames` (or `FeatureFlags.listFeatures` for features list — prefer `GraphEdit.listFeatureNames` for consistency)
- Produces: Edit-only **+ New ticket**; modal draft state; create via `applyGraphEdit`

- [ ] **Step 1: Load role catalog** in `loadData` when `team.json` has `roles`:

```js
this.ROLE_CATALOG = Array.isArray(tm.value.roles) ? tm.value.roles.slice() : [];
```

Default `ROLE_CATALOG = ['frontend', 'backend', 'qa']` next to sample team (match sample data).

- [ ] **Step 2: State + open/close/create handlers**

```js
// state defaults
createTicketOpen: false,
createDraft: null, // { id, epic, title, pts, roles:{}, features:{}, deps:{}, suggestedId }

openCreateTicket = () => {
  if (!this.state.graphEdit) return;
  const epic = (this.EPICS[0] && this.EPICS[0].id) || '';
  const suggestedId = GraphEdit.suggestTicketId(this.TICKETS, epic);
  const sizeKeys = Object.keys(this.SIZES).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
  this.setState({
    createTicketOpen: true,
    createDraft: {
      id: suggestedId,
      suggestedId,
      epic,
      title: '',
      pts: sizeKeys[0] || 1,
      roles: {},
      features: {},
      deps: {}
    }
  });
};

closeCreateTicket = () => this.setState({ createTicketOpen: false, createDraft: null });

// toggleGraphEdit: also clear createTicketOpen / createDraft when leaving edit

submitCreateTicket = () => {
  const d = this.state.createDraft;
  if (!d) return;
  const sizeKeys = Object.keys(this.SIZES).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
  const pick = (map) => Object.keys(map || {}).filter(k => map[k]);
  const { tickets, error } = GraphEdit.createTicket(this.TICKETS, {
    id: d.id, epic: d.epic, title: d.title, pts: d.pts,
    roles: pick(d.roles), features: pick(d.features), deps: pick(d.deps)
  }, { epicIds: this.EPICS.map(e => e.id), sizeKeys });
  if (error) { this.say('error', error); return; }
  this.closeCreateTicket();
  this.applyGraphEdit(tickets, null, `Created ${d.id.trim()}`);
};
```

Epic change: if `d.id === d.suggestedId`, set new `suggestedId` + `id` from `suggestTicketId`.

- [ ] **Step 3: Template** — after Edit button, `sc-if` on `showCreateTicketBtn` for **+ New ticket**. Modal overlay when `createTicketOpen`: epic `<select>`, id/title inputs, pts `<select>`, checkbox lists for roles/features/deps (native), Create / Cancel. Escape via existing key handler if easy; Cancel button required.

Wire props in `render()`: draft fields, option lists, handlers.

- [ ] **Step 4: README** — under Graph Edit / What you get and Try it step 5: create ticket popup in Edit; Download tickets includes new rows.

- [ ] **Step 5: Run `npm test`** — PASS

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| suggestTicketId max+1 / 101 | Task 1 |
| createTicket validation + omit empty roles/features | Task 1 |
| clone roles | Task 1 |
| + New ticket in Edit | Task 2 |
| Form fields + catalogs | Task 2 |
| Id re-suggest on epic | Task 2 |
| applyGraphEdit / Download unchanged | Task 2 |
| README | Task 2 |
| Out of scope (no new epics/disk write) | honored |
