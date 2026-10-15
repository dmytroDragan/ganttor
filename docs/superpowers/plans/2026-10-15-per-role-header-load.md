# Per-Role Header Load Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline / native) or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Header shows Planned / Capacity / Fill per role when `ROLE_CATALOG.length > 1`; otherwise keep the team strip.

**Architecture:** Pure `RoleLoad.summarize` in `src/role-load.js`; `index.html` switches strips; README note.

**Tech Stack:** Vanilla JS IIFE, `node --test`, Design Component UI.

## Global Constraints

- Follow `docs/superpowers/specs/2026-10-15-per-role-header-load-design.md`
- Multi-role people: full capacity + full assigned pts in each role
- Demand = visible tickets requiring the role; unconstrained omitted
- Bump `package.json` `0.8.0` → `0.9.0`; add test to `"test"` script
- Do not commit unless the user asks

## File map

| File | Role |
|------|------|
| `src/role-load.js` | `summarize(roleIds, people, tickets, assign, effCapOf)` |
| `test/role-load.test.js` | Unit tests |
| `index.html` | Script tag, header `sc-for`, wiring |
| `package.json` | Version + test script |
| `README.md` | Header per-role note |

---

### Task 1: Helper + tests

- [ ] Write `test/role-load.test.js` (cases from spec)
- [ ] Implement `src/role-load.js`
- [ ] Wire npm test + version `0.9.0`
- [ ] `npm test` PASS

**API:**

```js
RoleLoad.summarize(roleIds, people, tickets, assign, effCapOf)
// → [{ id, planned, demand, capacity, fillPct }]
// effCapOf(person) → number
```

### Task 2: Header UI + README

- [ ] `showTeamLoad = ROLE_CATALOG.length <= 1`
- [ ] `showRoleLoads = !showTeamLoad`
- [ ] `roleLoads` from summarize with `effCapHorizon`
- [ ] Template: sc-if team strip / sc-for role strips
- [ ] README bullet
- [ ] `npm test` PASS
