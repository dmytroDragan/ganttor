# Gain and skew

Gain and skew are the two knobs of **Auto-plan**. They decide when a teammate who is already working on an epic should be passed over for a teammate who can finish the ticket sooner. They only affect Auto-plan. Manual drag-and-drop ignores them.

Source: `src/auto-plan.js` (`DEFAULTS`, `place()`). Design: [auto-plan design](superpowers/specs/2026-10-12-auto-plan-design.md).

## The two knobs

| Knob | Header input | `tickets.json` key | Default | Override fires when |
|------|--------------|--------------------|---------|---------------------|
| Gain | `gain ≥ [2] d` | `sprint.autoPlan.switchGainDays` | `2` days | the sticky teammate would finish at least this many days later than the best candidate (`≥`) |
| Skew | `skew > [25] %` | `sprint.autoPlan.maxSkewPct` | `25` percentage points | the sticky teammate's load after the ticket is more than this many points above the team mean (`>`) |

Both knobs are non-negative numbers. "Sticky" means a teammate whose latest-ending ticket is on the same epic as the ticket being placed.

## How a ticket is placed

For each unassigned ticket, in epic-batched order, Auto-plan does this:

1. Ask every teammate for a placement that respects roles, capacity, dependencies and the sprint horizon.
2. `best` is the candidate with the earliest finish. Ties go to same-epic teammates, then to lower load, then to team order.
3. `stay` is the earliest-finishing teammate already on this epic. If there is none, or `stay` is `best`, Auto-plan takes `best` and the knobs do nothing.
4. Otherwise Auto-plan takes `best` if **either** override fires. If neither fires, it takes `stay`.

```text
gain override:  stay.finish − best.finish ≥ switchGainDays
skew override:  (stay's sprint load + ticket pts) / effCap × 100
                − team mean load % > maxSkewPct
```

`effCap` is the teammate's effective capacity in that sprint, after blocked working days are removed. The team mean is the average of the same percentage over teammates whose roles cover the ticket. Teammates who could never take the ticket are left out.

Two consequences follow from the formulas:

- `switchGainDays = 0` makes gain always fire, because `best` finishes no later than `stay`. Skew then never matters: pure earliest finish.
- `maxSkewPct = 100` disables skew, because skew can never exceed 100 points.

## Example 1: gain decides

Setup: Ann and Ben both have capacity 20. Ann is on epic `Y` and finishes `Y0` (6 pts) on day 6. Ben is on epic `X` and finishes `X0` (2 pts) on day 2. Next is `Y1` (epic `Y`, 2 pts, no dependencies).

| Candidate | Start | Finish | Epic |
|-----------|-------|--------|------|
| Ann | day 6 | day 8 | same (`stay`) |
| Ben | day 2 | day 4 | switch (`best`) |

The finish gap is 4 days.

| Gain | Skew | Result |
|------|------|--------|
| `99` | `25` | Ann, day 6. The gap is below 99 and skew is 20 points, not above 25. |
| `2` | `25` | Ben, day 2. The gap of 4 is at least 2. |
| `4` | `25` | Ben, day 2. Equal counts as "at least". |

## Example 2: skew decides

Setup: Ann has capacity 20 and finishes `Y0` (8 pts) on day 8. Ben has capacity 20 and finishes `X0` (2 pts) on day 2. Next is `Y1` (epic `Y`, 2 pts). Gain is set to `99` so it can never fire.

- Ann's load after `Y1`: 10 / 20 = 50%.
- Team mean: (Ann 8/20 = 40% + Ben 2/20 = 10%) / 2 = 25%.
- Skew: 50 − 25 = 25 points.

| Skew | Result |
|------|--------|
| `20` | Ben, day 2. 25 is above 20. |
| `25` | Ann, day 8. 25 is not above 25 (strict `>`). |
| `0` | Ben, day 2. Any positive skew switches. |

## Example 3: gain at zero ignores skew

Use the setup from Example 2 with gain `0` and skew `25`. The gap of 6 days is at least 0, so gain fires and Ben takes `Y1`. Skew does not need to fire.

## Example 4: roles can block both overrides

Setup: Ann has the `frontend` role and holds `Y0`. Ben has `backend`. `Y1` needs `frontend`.

With gain `0` and skew `0`, Ann still gets `Y1` on day 6. Ben cannot take a frontend ticket, so Ann is the only candidate. There is no `best` to switch to. Gain and skew can only move work between teammates who are both allowed to do it.

## Example 5: teammates who cannot take the ticket are ignored

Setup: Ann (frontend, capacity 20) holds `Y0` (6 pts). `Y1` (2 pts) needs `frontend`. Ben is frontend and idle. Two QA people are idle. Gain is `99` and skew is `25`.

- Team mean over the frontend pool (Ann and Ben): (30% + 0%) / 2 = 15%.
- Ann's skew after `Y1`: 40 − 15 = 25, not above 25.
- Result: Ann, day 6. The two QA people do not change the mean, so the result is the same as a team without them.

## Example 6: blocks make skew see effective capacity

Setup: Ann has capacity 20 but is blocked for 5 of the 10 sprint days, so her effective capacity is 10 pts. Ben has no block. Ann holds `Y0` (2 pts). `Y1` (2 pts) is next. Gain is `99`.

- Ann's skew after `Y1`: (2 + 2) / 10 = 40%.
- Team mean: (Ann 2/10 = 20% + Ben 0%) / 2 = 10%.
- Skew: 40 − 10 = 30.
- Result with skew `20` or `25`: Ben, day 0. 30 is above both thresholds.

Under the old formula, which divided by authored capacity, the same work measured 15 points and Ann kept `Y1`.

Blocks shrink what the gate allows (see [block day ranges](superpowers/specs/2026-10-12-block-day-ranges-design.md)), and skew now reflects that same capacity.

## Things that do not happen

- **Existing assignments do not move.** Auto-plan only appends. If Ann was loaded by hand, gain and skew only change where new tickets go.
- **A ticket that is too big for every teammate is skipped,** not forced onto the sticky teammate. The skipped summary shows the hint (`Over capacity`, `Blocked`, `Past sprint`, `Wrong role`).
- **Manual drops ignore gain and skew.** Drag-and-drop uses the normal earliest-start rule.

## Where the values come from

- `src/auto-plan.js` defaults: gain `2`, skew `25`.
- `data/tickets.json` may set `sprint.autoPlan`. Missing keys fall back to the defaults, so `{ "switchGainDays": 1 }` keeps `maxSkewPct` at `25`.
- The header inputs override the values for the session only. They are not written to `sprint-plan.json`. Download tickets keeps `sprint.autoPlan` from the JSON.
- Empty, non-numeric, or negative input is stored as `0`. Clearing the gain box therefore means "pure earliest finish", not the default `2`.

## Changed in 0.7.3

- Skew divides by effective capacity per sprint, so blocked days count (Example 6).
- The team mean covers only teammates whose roles cover the ticket (Example 5).

## Intentional behaviour

- **Clearing the gain box sets it to `0`.** That turns Auto-plan into pure earliest finish. This is deliberate: an empty box means "no stickiness", not "use the default".

## Tests

`test/auto-plan.test.js` covers the stickiness, gain and skew cases, and the rule that existing assignments are untouched. Run it with `npm test`.

## See also

- [README](../README.md): Auto-plan overview and how to tune the knobs.
- [CONTEXT.md](../CONTEXT.md): definitions of **Auto-plan**, **Epic switch** and **Skew**.
