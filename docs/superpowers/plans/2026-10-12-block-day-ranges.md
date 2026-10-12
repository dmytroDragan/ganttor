# Block Day Ranges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-person calendar block ranges that gray out Gantt days, shrink effective capacity, and let tickets straddle blocks like weekends.

**Architecture:** Pure helpers + `planAssignment` changes in `src/sprint-horizon.js`. Map `blocks` ISO dates onto `opts.dates` working-day list. Keep assign `{ start, days }` as work duration; derive calendar span through blocks for packing busy ends, fit checks, and Gantt bar width. UI loads/saves `blocks` and paints gray washes.

**Tech Stack:** Vanilla JS IIFE (`SprintHorizon`), `node --test` / `assert`, Design Component UI in `index.html`.

## Global Constraints

- Follow `docs/superpowers/specs/2026-10-12-block-day-ranges-design.md` and `CONTEXT.md` terms
- `start === end` = single calendar day; inclusive ranges; weekends in range = no-op for those dates
- Effective cap: `floor(cap * (sprintDays - blockedInSprint) / sprintDays)`
- Stored `days` = work days; bar span derived through that person’s blocks
- Blocks JSON-only; no click-to-block UI
- Bump `package.json` version `0.6.0` → `0.7.0`; add test file to `"test"` script
- Do not commit unless the user asks

## File map

| File | Role |
|------|------|
| `src/sprint-horizon.js` | Block map, effective cap, span end, packing |
| `test/blocks.test.js` | Unit tests for helpers + packing with blocks |
| `index.html` | Load/save `blocks`, pass `dates`, gray overlays, effective cap UI, bar span |
| `data/team.json` | Sample `blocks` on one teammate |
| `package.json` | Version + test script |
| `README.md` / `CONTEXT.md` | Feature + domain term |

---

### Task 1: Block helpers + packing (TDD)

**Files:**
- Modify: `src/sprint-horizon.js`
- Create: `test/blocks.test.js`
- Modify: `package.json` (`"test"` script + version `0.7.0`)

**Interfaces:**
- Consumes: person `blocks: [{ start, end }]`, `opts.dates: string[]` (ISO `YYYY-MM-DD`, index = working-day index)
- Produces:
  - `blockDaySet(blocks, dates) → Set<number>`
  - `blockedInSprint(blockedSet, si, sprintDays) → number`
  - `effectiveCap(cap, sprintDays, blockedCount) → number`
  - `spanEnd(start, workDays, blockedSet) → number` (exclusive calendar index after `workDays` non-blocked days)
  - `planAssignment(...)` uses blocks when `opts.dates` present; capacity checks use per-sprint effective cap; busy ends use `spanEnd`

- [ ] **Step 1: Write failing tests** in `test/blocks.test.js`:

```js
const assert = require('assert');
const H = require('../src/sprint-horizon.js');

// Mon 2026-08-10 .. working days (no weekends in list)
const dates = [
  '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14',
  '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'
];

const set = H.blockDaySet([{ start: '2026-08-13', end: '2026-08-13' }], dates);
assert.ok(set.has(3) && set.size === 1, 'single-day block');

assert.strictEqual(H.blockDaySet([{ start: '2026-08-15', end: '2026-08-16' }], dates).size, 0, 'weekend-only no-op');

assert.strictEqual(H.effectiveCap(20, 10, 2), 16);
assert.strictEqual(H.effectiveCap(21, 10, 2), 16, 'floor');
assert.strictEqual(H.effectiveCap(20, 10, 10), 0);

assert.strictEqual(H.spanEnd(2, 2, new Set([3])), 5, '2 work days straddling index 3');

const tickets = [{ id: 'T', pts: 2, deps: [] }];
const people = [{ id: 'p1', name: 'Maya', cap: 20, blocks: [{ start: '2026-08-13', end: '2026-08-13' }] }];
const daysOf = (pts) => pts;
const opts = {
  sprintDays: 10, maxSprints: 1, daysOf, strict: true, dates
};
const r = H.planAssignment({ id: 'T', pts: 2, deps: [] }, 'p1', {}, people, tickets, opts);
assert.ok(!r.error);
assert.strictEqual(r.start, 0);
assert.strictEqual(r.days, 2, 'work days stored');
assert.strictEqual(H.spanEnd(r.start, r.days, set), 2, 'no straddle when starting at 0 with block at 3');

const r2 = H.planAssignment({ id: 'T', pts: 2, deps: [] }, 'p1', {
  X: { personId: 'p1', start: 0, days: 2 }
}, people, tickets.concat([{ id: 'X', pts: 2, deps: [] }]), opts);
assert.ok(!r2.error);
assert.strictEqual(r2.start, 2);
assert.strictEqual(H.spanEnd(r2.start, r2.days, set), 5, 'straddle block at 3');

const other = [{ id: 'p2', name: 'Liam', cap: 20, blocks: [] }];
const r3 = H.planAssignment({ id: 'T', pts: 2, deps: [] }, 'p2', {}, other, tickets, opts);
assert.strictEqual(r3.start, 0);
assert.strictEqual(H.spanEnd(r3.start, r3.days, H.blockDaySet([], dates)), 2, 'other person unaffected');

const low = [{ id: 'p1', name: 'Maya', cap: 10, blocks: [
  { start: '2026-08-10', end: '2026-08-14' },
  { start: '2026-08-17', end: '2026-08-21' }
]}];
const allBlocked = H.blockDaySet(low[0].blocks, dates);
assert.strictEqual(allBlocked.size, 10);
const r4 = H.planAssignment({ id: 'T', pts: 2, deps: [] }, 'p1', {}, low, tickets, opts);
assert.ok(r4.error);
assert.strictEqual(r4.hint, 'Over capacity');

console.log('blocks tests ok');
```

- [ ] **Step 2: Run** `node test/blocks.test.js` — expect FAIL (missing exports / behavior)

- [ ] **Step 3: Implement** in `src/sprint-horizon.js`:

```js
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
  const lo = si * sprintDays, hi = lo + sprintDays;
  blocked.forEach(i => { if (i >= lo && i < hi) n++; });
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
  const guard = start + workDays + (blocked ? blocked.size : 0) + 2;
  while (work < workDays && i < guard) {
    if (!blocked || !blocked.has(i)) work++;
    i++;
  }
  return i;
}
```

Update `planAssignment`:
- Build `blocked = blockDaySet(p.blocks, opts.dates)`
- Replace `p.cap` checks with `effectiveCap(p.cap, sprintDays, blockedInSprint(blocked, si, sprintDays))` (ticket-too-big uses sprint 0 or max over possible — use: if `t.pts > p.cap` keep as absolute ceiling; for sprint fit use effective; also if `t.pts > effectiveCap(...)` for current si)
- Busy intervals: `[a.start, spanEnd(a.start, a.days, blocked))`
- Placement: from `cursor`, advance while inside busy; then walk forward consuming `dur` non-blocked days; if a day is busy before work completes, jump cursor to busy end and retry; if calendar end `> sprintEnd`, next sprint; never count blocked days as work

Export new helpers on `api`.

- [ ] **Step 4: Run** `node test/blocks.test.js` — PASS; `npm test` — all pass

- [ ] **Step 5: Skip commit** (unless user asks)

---

### Task 2: Wire UI — load/save, dates, packing, gray, effective cap, bar span

**Files:**
- Modify: `index.html`
- Modify: `data/team.json` (sample block on one person)
- Modify: `CONTEXT.md`, `README.md`

**Interfaces:**
- Consumes: `SprintHorizon.blockDaySet`, `spanEnd`, `effectiveCap`, `blockedInSprint`, `planAssignment` with `opts.dates`
- Produces: people with `blocks`; Gantt gray overlays; bars using span width

- [ ] **Step 1: Load/save people `blocks`**
  - When mapping team / plan people: `blocks: Array.isArray(p.blocks) ? p.blocks : []`
  - `savePlan` capacityPlan entries include `blocks: p.blocks || []`
  - `addPerson`: `blocks: []`

- [ ] **Step 2: Pass dates into plan**
  - Helper `dateIsos()` → `this.sprintDates(this.horizonDays()).map(d => format YYYY-MM-DD)`
  - Every `planAssignment` call site adds `dates: this.dateIsos()` (or dates covering max horizon for multi-sprint)

- [ ] **Step 3: Effective capacity in UI**
  - For each person/sprint visible: `den = sum over si of effectiveCap(p.cap, sprint, blockedInSprint(...))`
  - `usedBy` unchanged (sum pts)
  - Header team capacity uses same effective sum

- [ ] **Step 4: Gray overlays + bar span**
  - Per row, for each blocked index in `0..totalDays`, absolute div gray wash (`background:#EBE7DF` or similar, low opacity)
  - Bar `left` = `start/totalDays`; `width` = `(spanEnd(start,days,blocked)-start)/totalDays`
  - Preview uses same span
  - Tooltip note when `spanEnd - start > days`: `Nd work · spans block`

- [ ] **Step 5: Sample data + docs**
  - `data/team.json`: e.g. Maya `blocks: [{ "start": "2026-08-13", "end": "2026-08-14" }]` (Thu–Fri of sample sprint start 2026-08-10)
  - `CONTEXT.md` term **Block**
  - `README.md` feature bullet + team.json field note

- [ ] **Step 6: Run** `npm test` — pass; smoke in browser optional

- [ ] **Step 7: Skip commit** (unless user asks)

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| Calendar dates on person | 1–2 |
| `start === end` single day | 1 |
| Gray wash per row | 2 |
| Continuous bar through gray | 2 (`spanEnd` width) |
| JSON-only edit | 2 (no UI editor) |
| Effective cap formula | 1–2 |
| Shared columns, per-person blocks | 1–2 |
| Straddle packing | 1 |
| Weekend-only no-op | 1 |
| Other person unaffected | 1 |
| README + CONTEXT | 2 |
| Out of scope (click-to-block, etc.) | omitted |

## Type consistency

- `blocks: [{ start: string, end: string }]`
- `opts.dates: string[]` ISO dates
- `spanEnd(start, workDays, Set) → exclusive number`
- Assign remains `{ personId, start, days }` with `days` = work
