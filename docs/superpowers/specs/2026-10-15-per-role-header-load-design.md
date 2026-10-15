# Per-role header load strips

**Date:** 2026-10-15  
**Status:** implemented (v0.9.0)

## Goal

When the team has multiple roles, replace the single header Planned / Team capacity / Fill strip with one strip **per role**, so load is visible role-by-role. With zero or one role in the catalog, keep today’s team-wide strip.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Attribution | Assigned pts and capacity attributed to people who have the role (option A) |
| Multi-role people | Full effective capacity and full assigned ticket pts count in **each** of their roles |
| Layout switch | `ROLE_CATALOG.length <= 1` → team strip; else per-role strips only (no team strip beside them) |
| Planned denominator (X) | Sum of pts of **visible** tickets that require that role; unconstrained tickets omitted from every role’s X |
| Planned numerator (N) | Sum of pts of tickets assigned to people who have that role |
| Capacity line | Same N / role capacity |
| Fill | `N / capacity` with existing color thresholds |
| Role list | `ROLE_CATALOG` from `team.json` (same as create-ticket form), catalog order |
| Architecture | Pure helper for math; header `sc-for` in `index.html` |

## Metrics (per role `R`)

```text
peopleR     = people where R ∈ person.roles
capacityR   = Σ effectiveCapHorizon(p) for p in peopleR
plannedR    = Σ ticket.pts for assignments whose person ∈ peopleR
              (ticket looked up in visible backlog; skip missing)
demandR     = Σ ticket.pts for visible tickets where R ∈ ticket.roles
fillR       = capacityR ? min(100, plannedR / capacityR * 100) : 0
```

Team strip (≤1 catalog role) unchanged: current `plannedPts` / `totalPts`, `usedPts` / `teamCap`, `fillPct`.

## UI

- Per-role strip: role id as uppercase/small label, then Planned `N / demandR pts`, Capacity `N / capacityR pts`, Fill bar.
- Compact enough to sit in the header; wrap or allow horizontal overflow if many roles (no tabs).
- Empty catalog or single role: existing markup/path.

## Docs

- `README.md`: note that with multiple roles the header shows per-role planned/capacity/fill.

## Tests

Unit-test the pure helper:

1. Single-role person + matching assigned ticket → planned/capacity/demand as expected  
2. Person with two roles → capacity and planned counted in both  
3. Unconstrained ticket pts not in any `demandR`  
4. Ticket requiring role but unassigned → in demand, not planned  
5. Hidden (feature-off) tickets omitted from demand and from planned lookups  

## Out of scope

- Changing assign / auto-plan role matching  
- Persisting header breakdown in `sprint-plan.json`  
- Per-role strips when catalog is empty/single (keep team strip)  
- Splitting a multi-role person’s capacity fractionally across roles  
