# ganttor

Local sprint planner: dependency graph of tickets scheduled onto teammates with capacity on a Gantt board.

## Language

**Ticket**:
A unit of work with id, epic, title, story points, and dependency ids.
_Avoid_: Issue, card, story (unless quoting external tools)

**Role**:
A catalog id that names who may do work (e.g. `frontend`). Stored as `roles` string arrays on tickets and people.
_Avoid_: Job title, permission, label (labels are features)

**Unconstrained ticket**:
A ticket with missing or empty `roles`; any teammate may take it.
_Avoid_: Open ticket, unassigned role

**Dependency**:
A directed prerequisite edge: child ticket lists parent ids in `deps` (parent must be done before child).
_Avoid_: Link, blocker (unless UI copy)

**Feature**:
A named slice tag on a ticket (`features` string array). Used only for feature flags, not for epic grouping.
_Avoid_: Tag, label, epic (epic is a separate grouping)

**Feature flag**:
On/off state for one feature name in the current plan (`featureFlags`). When off, tickets whose features are all off are hidden from the working view.
_Avoid_: Toggle, filter (unless describing UI chrome)

**Projection**:
The derived ticket list for the current flags: hidden tickets omitted, deps bridged across gaps. Source backlog is unchanged.
_Avoid_: Filter result, view model (implementation jargon)

**Untagged ticket**:
A ticket with missing or empty `features`; always present in every projection.
_Avoid_: Global ticket, default feature

**Auto-plan**:
A one-click pass that schedules every remaining visible ticket onto the team through the same gate as a manual drop. Never moves existing assignments.
_Avoid_: Auto-assign, optimizer, solver (implementation jargon)

**Epic switch**:
A teammate's most recently ending scheduled ticket belongs to a different epic than the ticket being placed. Auto-plan avoids these unless the gain or skew threshold overrides.
_Avoid_: Context switch (unless describing the goal)

**Skew**:
How far a teammate's load in one sprint sits above the team average, in percentage points of their capacity.
_Avoid_: Imbalance, variance

**Block**:
A per-person inclusive calendar date range (`blocks[].start` / `end`) when that teammate cannot take work. Mapped onto working-day columns; tickets may straddle a block (work before and after). Authored capacity is unchanged; effective capacity shrinks by blocked working days in the sprint.
_Avoid_: Holiday (team-wide), busy (other tickets), dependency block
