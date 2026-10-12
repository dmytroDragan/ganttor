# ganttor

Local sprint planner: dependency graph of tickets scheduled onto teammates with capacity on a Gantt board.

## Language

**Ticket**:
A unit of work with id, epic, title, story points, and dependency ids.
_Avoid_: Issue, card, story (unless quoting external tools)

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
