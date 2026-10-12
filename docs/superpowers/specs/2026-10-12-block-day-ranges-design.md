# Block day ranges design

**Date:** 2026-10-12  
**Status:** approved (not implemented)

## Goal

Let teammates declare calendar **block** ranges (leave, training, etc.). Work cannot land on blocked working days for that person, but a ticket may start before a block and finish after (weekend-style straddle). Capacity for the sprint shrinks automatically from blocked working days. Other teammates stay free on the same dates.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Input | Calendar dates on the person (`blocks[].start` / `end`), mapped onto working-day columns |
| Same-day range | `start === end` means that single calendar day |
| Visual | Gray wash on blocked columns for that row only; continuous bar through the gray when straddling |
| Editing | JSON only (`team.json` / saved plan); no click-to-block UI |
| Capacity | Authored `capacity` unchanged; **effective** cap = `floor(cap * availableWorkingDaysInSprint / sprintDays)` |
| Shared timeline | Day columns stay global; blocks are per-person overlays |
| Architecture | Map blocks → day indices; extend `planAssignment` so drop, preview, auto-plan, load repack, and graph refresh share one gate |

## Data model

### Person (`data/team.json` and in-memory `people`)

```json
{
  "id": "p1",
  "name": "Maya Okonkwo",
  "roles": ["frontend"],
  "capacity": 21,
  "blocks": [
    { "start": "2026-08-13", "end": "2026-08-14" },
    { "start": "2026-08-20", "end": "2026-08-20" }
  ]
}
```

- `blocks` optional; omit or `[]` = no blocks.
- Each range is inclusive on both ends.
- Multiple ranges allowed; overlapping / adjacent mapped intervals merge for packing.
- Weekends inside a calendar range map to zero working days (no-op for those dates), same as the Gantt already skips Sat/Sun.
- Save/load round-trips `blocks` on people in `capacityPlan` / plan people.

## Mapping

1. Build the horizon date list with existing `sprintDates` (working days only).
2. For each person block, mark every working day whose calendar date falls in `[start, end]`.
3. Per sprint `si`, blocked indices in `[si * sprintDays, (si + 1) * sprintDays)` reduce available days for that person.

Blocks entirely outside the visible horizon are ignored.

## Packing / assign rules

In `planAssignment` (and all callers):

1. Work duration `d = daysOf(pts)` still means **work days**, not calendar span.
2. Blocked indices for that person are not schedulable work; other people’s tickets on the same indices are irrelevant.
3. Placement finds the earliest start where `d` non-blocked days exist for that person after deps and same-person busy tickets, without placing work on a blocked day.
4. **Straddle:** if a block sits between work segments of the same ticket, one assignment spans it. Calendar end = start + work days + blocked days crossed. Keep stored `{ start, days }` where `days` is **work** duration; Gantt bar width/end is derived at render time by expanding through that person’s blocks between start and work end.
5. Finish must stay within the sprint (or shift to the next when multi-sprint is on), using that derived calendar span against sprint bounds — same failure modes as today (`Past sprint`, `Over capacity` against **effective** cap).
6. Effective capacity for sprint `si`:  
   `floor(cap * availableWorkingDaysInSprint / sprintDays)`  
   where `availableWorkingDaysInSprint = sprintDays - blockedWorkingDaysInSprint` (clamped ≥ 0). UI meters and assign checks use effective cap; authored `cap` is not edited for blocks.

### Example

Sprint working days indexed 0…9. Person blocked on index 3. Ticket needs 2 work days, earliest start 2:

- Work on 2, skip 3, work on 4.
- Bar spans indices 2…5 (continuous through gray).
- Fits if span ends in-sprint and points ≤ effective cap.

## UI

- Gray wash behind bars on blocked columns for that teammate only.
- One continuous bar through the gray when straddling (not split segments).
- Capacity meter / denominator uses effective capacity (multi-sprint: sum of per-sprint effective caps).
- No new capacity or block editors in the UI for this feature.
- Bar tooltip may note work days vs span when a block is crossed (e.g. `2d work · spans block`).

## Edge cases

| Case | Behavior |
|------|----------|
| Block outside horizon | Ignored |
| Block covers whole sprint | Effective cap 0; nothing assigns that sprint for that person |
| Weekend-only calendar range | Maps to no working days; no-op |
| `start === end` | Single calendar day |
| Loaded plan changes blocks | Repack like other person-field changes |
| Same date free for others | Unaffected |

## Tests

- Single-day block (`start === end`) maps to one working-day index when that date is a workday.
- 2-day ticket straddles a 1-day block; work days are non-blocked; span covers the block.
- Work is never placed on a blocked day for that person.
- Effective cap shrinks; assign fails when points exceed effective cap.
- Another person can still take work on the same calendar day.
- Weekend-only block range is a no-op.

## Files (expected)

- Packing helper + `planAssignment` updates (`src/sprint-horizon.js` and/or small `src/blocks.js`)
- `index.html` — load/save `blocks`, gray overlays, effective cap display, bar span
- `data/team.json` — sample block(s)
- `README.md` feature note; `CONTEXT.md` domain term **Block**
- Tests under `test/`

## Out of scope

- Click/drag to create blocks in the Gantt
- Editing capacity automatically written back into JSON
- Team-wide holidays (global non-working days beyond weekends)
- Split assignment records per ticket
