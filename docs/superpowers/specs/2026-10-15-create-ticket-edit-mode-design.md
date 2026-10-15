# Create ticket in edit mode

**Date:** 2026-10-15  
**Status:** approved (design)

## Goal

In graph **Edit** mode, create a new ticket through a small popup. The ticket joins the in-memory backlog immediately and is included when the user **Download tickets** (full backlog export). No disk write — same persistence model as pts/deps edits.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Entry | **+ New ticket** beside the Edit control; only while Edit is on |
| Fields | Epic, id, title, pts, roles (multi), features (multi), deps (multi) |
| Id | Auto-suggest next free `{epicId}-{n}`; editable before save |
| Id re-suggest | On epic change, re-suggest only if id still equals the previous suggestion |
| Roles / features | Multi-select from current catalogs; empty = unconstrained / untagged |
| Deps | Optional multi-select of existing ticket ids; empty allowed |
| Architecture | Pure helpers in `GraphEdit`; modal + wiring in `index.html` |
| Persist | `applyGraphEdit` / undo snapshot; **Download tickets** via existing `exportTickets` |
| Disk | No overwrite of `data/tickets.json` |

## UX

1. User turns on **Edit**.
2. Clicks **+ New ticket** → modal opens with defaults.
3. Fills / adjusts fields; Create validates; Cancel / Escape closes with no change.
4. On success: ticket appears unassigned on the graph; toast `Created <id>`; one undo step.
5. Leaving Edit closes the modal if open.
6. **Download tickets** exports the full backlog including the new row.

### Form fields

| Field | Control | Source / rules |
|-------|---------|----------------|
| Epic | required dropdown | `EPICS` |
| Id | text, prefilled | `suggestTicketId`; user may edit |
| Title | required text | trimmed non-empty |
| Pts | required dropdown | keys of `SIZES`; default = smallest size key |
| Roles | multi-select (optional) | role catalog from `team.json` (`roles`) |
| Features | multi-select (optional) | feature names already present on tickets |
| Deps | multi-select (optional) | other current ticket ids |

## Architecture

### Pure helpers (`src/graph-edit.js`)

- `suggestTicketId(tickets, epicId)` — for that epic, take the max numeric suffix among ids matching `{epicId}-<digits>`; return `{epicId}-{max+1}`, or `{epicId}-101` if none.
- `listFeatureNames(tickets)` — sorted unique feature strings from tickets.
- `createTicket(tickets, input, opts)` → `{ tickets, ticket, error }`
  - `input`: `{ id, epic, title, pts, roles?, features?, deps? }`
  - `opts`: `{ epicIds, sizeKeys }` (or equivalent) for membership checks
  - Validates: trimmed title; non-empty id; unique id; epic in epic ids; pts in size keys; every dep exists; no self-dep; `wouldCycle` for proposed deps
  - Builds row `{ id, epic, title, pts, deps }`; include `roles` / `features` only when non-empty (same omit rule as `exportTickets`)
  - Returns cloned ticket list with the new row appended

### App wiring (`index.html`)

- State: `createTicketOpen` and draft fields (or rebuild draft on open).
- **+ New ticket** visible only when `graphEdit`.
- On Create: `GraphEdit.createTicket(...)` → error → `say('error', …)`, keep open; ok → `applyGraphEdit(next, null, 'Created …')`, close modal.
- Role options from loaded team catalog; features via `listFeatureNames(this.TICKETS)`; deps = all current ticket ids.
- `downloadTickets` unchanged: full `this.TICKETS` through `exportTickets`.

## Validation / errors

Modal stays open on error:

| Case | Behavior |
|------|----------|
| Empty title | `Title required` |
| Empty / whitespace id | `Id required` |
| Duplicate id | `Id already exists` |
| Unknown epic / pts | `Invalid epic` / `Invalid points` |
| Unknown dep id | `Unknown dependency: X` |
| Self-dep | Same as existing dep edit (`Cannot depend on itself`) |
| Cycle | Same cycle messaging as existing dep edit |
| Role/feature picks | UI only offers catalog values |

## Docs

- `README.md`: Graph Edit can create tickets via popup; new tickets are in **Download tickets**.
- `CONTEXT.md`: no new domain terms required (Ticket / Role / Feature already defined).

## Tests

Extend `test/graph-edit.test.js`:

1. `suggestTicketId` — no tickets for that epic → `CHK-101`; after `CHK-106` → `CHK-107`; max+1 scoped to that epic only
2. `createTicket` happy path with roles, features, deps
3. Reject duplicate id, empty title, unknown dep, self-dep; cycle if a proposed parent already reaches the new id
4. Empty roles/features omitted from the created row
5. Existing `exportTickets` still round-trips roles/features/deps on the new ticket

## Out of scope

- Creating new epics, roles, features, or size keys in the UI
- Editing or deleting existing tickets via the form
- Writing files to disk (browser download only)
- Epic-header “+” affordance (toolbar button only)
