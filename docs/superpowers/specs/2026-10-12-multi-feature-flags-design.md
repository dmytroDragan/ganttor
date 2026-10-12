# Multi-feature flags design

**Date:** 2026-10-12  
**Status:** approved for planning (pending user review of this file)

## Goal

Let planners slice the backlog by named features. Toggling a feature off removes its tickets from the dependency map and Gantt, bridges deps across the hole (A→B→C becomes A→C when B is hidden), and omits those tickets from save/export while the flag is off.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | Graph + Gantt + save/export use the filtered set |
| Ticket field | Optional `features: string[]` (multi) |
| Hide rule | Hidden iff ticket has ≥1 feature **and** every listed feature is off |
| Untagged | Missing / empty `features` → always visible |
| Flag persistence | Stored with the plan (`featureFlags` in `sprint-plan.json`) |
| Tag editing | JSON only in v1; UI tag editor later |
| Architecture | View projection over full in-memory backlog (do not mutate source tickets) |

## Data model

### Ticket

```json
{ "id": "PAY-203", "epic": "PAY", "title": "3-D Secure challenge", "pts": 5, "deps": ["PAY-202"], "features": ["payments", "3ds"] }
```

- `features` is optional. Omit or `[]` = untagged.
- Feature names are opaque strings; UI lists the union of all names present on the loaded backlog.

### Plan

Extend `sprint-plan.json` with:

```json
"featureFlags": { "payments": true, "3ds": false }
```

- Missing key or missing object → treat as **on**.
- Load plan restores flags; then projection + assign repack run as today.

## Projection

Pure function (new module, e.g. `src/feature-flags.js`):

```text
projectTickets(tickets, featureFlags) → tickets'
```

1. **Visible?** Keep ticket if untagged, or if at least one of its features is on (default on when flag absent).
2. **Bridge deps:** For each kept ticket, resolve each dep by walking through *hidden* tickets until a kept ticket (or dead end). Collect kept ancestors, dedupe, drop self-refs.
3. Return **new** ticket objects (`deps` copied/bridged). Never mutate the source array or objects.

Bridging is the association principle: A→B[hidden]→C ⇒ effective edge A→C. Chains of hidden tickets collapse the same way. Multiple parents: keep every kept ancestor reached.

Known feature names:

```text
listFeatures(tickets) → sorted unique strings from all tickets' features arrays
```

## UI

- “Features” control near existing toolbar toggles (Multi-sprint / Edit).
- One checkbox per name from `listFeatures`; checked = on.
- Hidden entirely when there are zero feature names.
- No add/remove feature tags on tickets in v1.

### Toggle behavior

- **Off:** tickets that become hidden are removed from the active assignment map; remaining assign is repacked (reuse existing unassign/repack paths where practical).
- **On again:** tickets reappear on the graph **unassigned** (no restore of prior slots).

## App wiring

| Consumer | Input |
|----------|--------|
| Dependency graph, ready highlight, graph edit targets | `projectTickets(...)` |
| Gantt, capacity, planAssignment | same projection |
| Assign / unassign | operate on projected ids; source backlog unchanged |
| Download tickets | export projected tickets (bridged deps); include `features` on rows that remain |
| Save plan | write `featureFlags` + schedule as today |
| Undo/redo | include `featureFlags` in history snapshots with tickets/assign |

Graph edit (pts/deps) still mutates the **source** ticket when the id exists there; after each edit, re-project for display. Editing a currently hidden ticket is impossible (not on the map).

## Testing

Unit tests on the projection module (no UI):

- Untagged always kept
- Multi-feature: stays while any feature on; hidden only when all off
- Single hidden middle node: A→B→C ⇒ A→C
- Chain of hidden nodes collapses
- Multiple parents; diamond; no self-dep after bridge
- Default flag = on when key missing
- Empty feature set in backlog → `listFeatures` empty

## Out of scope (v1)

- UI to edit `features` on tickets
- Persisting flags outside the plan file
- Restoring prior assignments when re-enabling a feature
- Feature metadata (colors, descriptions, ordering beyond sort)

## README (implementation follow-up)

When shipping: add a short bullet + note in the data-files / save-load reference that tickets may carry `features`, plan may carry `featureFlags`, and download/export reflects the active projection.

## Implementation sketch

1. `src/feature-flags.js` + `test/feature-flags.test.js` (projection + list + visibility).
2. Wire flags state + toolbar in `index.html`; project before graph/Gantt render and before export.
3. Persist/load `featureFlags` in plan save/load; fold into undo snapshots.
4. Sample data: tag a few `data/tickets.json` rows so the control is demoable.
5. README update per product “feature” rule.
