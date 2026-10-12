# Ticket roles design

**Date:** 2026-10-12  
**Status:** implemented (v0.5.0)

## Goal

Limit which teammates can take a ticket by role. Tickets without roles stay open to anyone; tickets with roles require at least one overlapping role on the person. Mismatch is a hard assign block (same UX as over-capacity).

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Enforcement | Hard block via `planAssignment` (`hint: 'Wrong role'`) |
| Person field | `roles: string[]` (replaces singular `role`) |
| Ticket field | Optional `roles: string[]` |
| Match rule | Empty/missing ticket `roles` → anyone; else person must share ≥1 id |
| Catalog | Ids only, top-level `roles` array on `data/team.json` (no separate file) |
| Editing | JSON only; light UI shows role ids on people/tickets |
| Unknown ids | Ignored for matching (no crash / no hard validate against catalog) |
| Architecture | Guard inside `planAssignment` so drop, preview, load repack, and graph refresh share one gate |

## Data model

### Catalog + team (`data/team.json`)

```json
{
  "roles": ["frontend", "backend", "qa"],
  "team": [
    { "id": "p1", "name": "Maya Okonkwo", "roles": ["frontend"], "capacity": 21 },
    { "id": "p2", "name": "Liam Petrov", "roles": ["backend"], "capacity": 26 },
    { "id": "p3", "name": "Sofia Reyes", "roles": ["frontend", "backend"], "capacity": 18 },
    { "id": "p4", "name": "Dev Rao", "roles": ["qa"], "capacity": 13 }
  ]
}
```

- Catalog is the list of known role ids (display/docs). Not a runtime validator.
- People use `roles` (array). Drop legacy `role` string on load (do not map it automatically beyond sample data migration).

### Ticket (`data/tickets.json`)

```json
{ "id": "CHK-102", "epic": "CHK", "title": "Cart summary component", "pts": 3, "deps": ["CHK-101"], "roles": ["frontend"] }
{ "id": "ORD-306", "epic": "ORD", "title": "E2E happy-path suite", "pts": 8, "deps": ["CHK-106", "ORD-304"] }
```

- Omit or `[]` = unconstrained (anyone).
- Sample backlog: migrate team strings → ids; tag a few tickets so a mismatch is demoable.

## Match rule

```text
canAssign(ticket, person):
  needed = ticket.roles || []
  if needed is empty → true
  have = person.roles || []
  return intersection(needed, have) is non-empty
```

Person with empty `roles` can only take unconstrained tickets.

## Assignment

Early in `SprintHorizon.planAssignment` (before capacity/deps packing):

- If `!canAssign(t, p)` → `{ error: '<First> cannot take <id> (needs <roles>).', hint: 'Wrong role' }`

All callers of `planAssignment` inherit the block: drag-drop, row preview, shake, plan load + `repackAssign`, graph-edit `refreshAssign`.

## Load / normalize

- Tickets: ensure `roles` is an array (default `[]`).
- People: read `roles` array; ignore legacy `role` if present.
- Store catalog from `team.json` `roles` in app state if useful for display; not required for matching.

## UI (light)

- Gantt row: show person’s role ids under the name (comma-separated or similar).
- Ticket graph / tooltip: when ticket has roles, show them; unconstrained tickets omit the line.
- No in-app role picker in v1.

## Docs

- `CONTEXT.md`: **Role**, person/ticket `roles`, unconstrained ticket.
- `README.md`: catalog in `team.json`, `roles` on tickets/people, hard-block assign.

## Tests

Small node test covering:

1. Unconstrained ticket → any person ok  
2. Required roles + overlapping person → ok  
3. Required roles + no overlap → `Wrong role`  
4. Constrained ticket + person with empty `roles` → reject  

Prefer exercising through `planAssignment` (or a tiny exported helper if that keeps the test readable).

## Out of scope

- Separate `roles.json`
- In-app role editor
- Soft-warn assign
- Auto-migrate arbitrary legacy `role` display strings at runtime
- Catalog validation errors for unknown ids
