# Auto-plan design

**Date:** 2026-10-12  
**Status:** implemented (v0.6.0)

## Goal

One click schedules every remaining (unassigned, visible) ticket onto the team. Respects roles, capacity, dependencies and the sprint horizon exactly as a manual drop does, never moves what is already assigned, and keeps each teammate on one epic unless switching finishes the ticket significantly earlier or the sticky teammate is already far above team utilization. Both thresholds are parameters.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Objective | Earliest finish per ticket, with epic stickiness as a tie-break that can only be overridden by gain or skew |
| Solver | Greedy list scheduler, single pass, deterministic |
| Constraint gate | Reuse `SprintHorizon.planAssignment` through a `planFn` (same as `repackAssign`) |
| Existing assignments | Untouched; auto-plan only appends |
| Parameters | `switchGainDays` (default 2), `maxSkewPct` (default 25). JSON seeds, UI overrides for the session |
| Undo | One `commit` per run, so one ⌘Z reverts everything |
| Multi-sprint off | Only tickets that fit sprint 1 are placed; the rest stay in the graph |

## Module: `src/auto-plan.js`

UMD wrapper like `unassign-recalc.js`. Exports `{ DEFAULTS, criticalPath, autoPlan }`.

```text
DEFAULTS = { switchGainDays: 2, maxSkewPct: 25 }

autoPlan(assign, people, tickets, planFn, opts)
  -> { assign, planned: string[], skipped: [{ id, hint }] }

opts = { sprintDays, switchGainDays, maxSkewPct }
planFn(t, pid, assign, people) -> planAssignment result
```

### Ordering (epic-batched)

`criticalPath(tickets, daysOf)` returns `id -> own days + max criticalPath(children)`. Priority within the work list: critical path desc, then `pts` desc, then `id` asc.

Scheduling runs one epic at a time:

1. A ticket is ready when none of its dependencies are still pending. A ready ticket whose dependency was skipped is itself skipped with `Blocked`.
2. If the current epic has ready tickets, take the highest-priority one. Otherwise the current epic becomes the epic of the highest-priority ready ticket overall.
3. Place it, then repeat until nothing is pending.

### Candidate choice per ticket

1. For every person call `planFn`; keep results without `error`, with `finish = start + days`.
2. Classify each candidate by the person's latest-ending assigned ticket in the working `assign`: `same` (same epic), `idle` (no tickets), `switch` (different epic).
3. Sort candidates: `finish` asc, then `same` before `idle` before `switch`, then pts already used in that sprint asc, then team order. `best` = first.
4. `stay` = earliest-finish `same` candidate. If there is none, or `stay` is `best`, take `best`.
5. Otherwise take `best` only when one holds, else take `stay`:
   - `stay.finish - best.finish >= switchGainDays`
   - `utilAfter(stay) - teamMean > maxSkewPct`, where `utilAfter = (usedInSprint(stay, si) + t.pts) / effCap * 100`, `si` is the sprint the stay placement lands in, and `teamMean` is the mean of `usedInSprint(p, si) / effCap * 100` over teammates whose roles cover the ticket. `effCap` is the effective capacity for that sprint (blocked working days removed). Revised in 0.7.3; the original used authored `cap` and all teammates.
6. No candidate: push `{ id, hint }` to `skipped` using the first error's `hint`.

Because `idle` teammates no longer count as "free to take the epic", a new epic is spread onto a second teammate only when the first one is `switchGainDays` or more behind, or overloaded.

`switchGainDays = 0` yields pure earliest finish. `maxSkewPct = 100` disables the skew override.

## Parameters

- `data/tickets.json` may carry `sprint.autoPlan: { switchGainDays, maxSkewPct }`. It already reaches `this.SPRINT` through `Object.assign` in `loadData`.
- App state `autoPlanOpts` is seeded from `DEFAULTS` merged with `SPRINT.autoPlan` after load.
- Two number inputs in the header edit `autoPlanOpts` for the session. Not written to `sprint-plan.json`.
- `GraphEdit.exportTickets` passes `sprint.autoPlan` through when present so Download tickets does not drop it.

## App wiring (`index.html`)

- Load `./src/auto-plan.js` next to the other modules.
- `autoPlan = () => {}` handler: `tickets = this.visibleTickets()`, `planFn = (t, pid, a, p) => this.planWithTickets(tickets, t, pid, a, p)`, `opts = { sprintDays: this.sprintDays(), ...autoPlanOpts }`.
- Nothing planned: `say('info', ...)` with the skipped summary, no commit.
- Otherwise `commit(() => ({ assign }))` and toast `Auto-planned N tickets` plus `· M left: ID (hint), ...` capped at three ids.
- Header: `Auto-plan` button before `Clear board`, followed by `gain >= [2] d` and `skew > [25] %` inputs.

## Docs

- `README.md`: feature bullet, Try-it step, `sprint.autoPlan` row in the data table, one line on the two knobs.
- `CONTEXT.md`: **Auto-plan**, **Epic switch**, **Skew**.
- `package.json`: `0.5.0` -> `0.6.0`; add the new test to `npm test`.

## Tests (`test/auto-plan.test.js`)

Node `assert`, `daysOf = pts => pts`, `sprintDays = 10`, `maxSprints = 1` unless stated.

1. Child never starts before its parent ends; parents are planned.
2. Role-constrained ticket never lands on a person without the role.
3. Two epics, two equal people: with `switchGainDays = 99` each person ends up with a single epic; with `0` the same backlog interleaves (at least one switch).
4. Gain override: sticky person is loaded so the ticket would finish >= `switchGainDays` later than an idle teammate; the idle teammate gets it.
5. Skew override: sticky person far above team mean utilization loses the ticket even when the gain is below threshold.
6. Pre-existing assignments are byte-identical after the run.
7. A ticket that fits nobody appears in `skipped` with a hint and is absent from `assign`.

## Out of scope

- Local-search swap passes after the greedy run.
- Re-planning already assigned tickets.
- Persisting the knobs in `sprint-plan.json`.
- Fixing `exportTickets` dropping ticket `roles` (pre-existing, noted separately).
