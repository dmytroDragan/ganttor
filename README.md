
## Gattor

Most sprint planning tools miss the link between dependencies and capacity — that is why **ganttor** exists.

Minimalistic Local sprint planner for dependency-aware scheduling: 
Just drag tickets from a graph onto teammates and see capacity fill on a Gantt board.

![ganttor: dependency graph and team Gantt schedule](demo.png)

## Main capabilities

- **Dependency graph** — tickets laid out by epic, with parallel workstreams in component lanes; arrows show parent → child direction, pending vs scheduled deps
- **Graph edit mode** — toggle **Edit** on the graph to step story points (−/+ through 1 / 2 / 3 / 5 / 8), two-click a parent then a child to add a dep, or click an edge to drop one; the layout re-runs and the Gantt cascade-unassigns if a new dep isn’t scheduled yet
- **Drag-and-drop assign** — drop an unassigned ticket onto a teammate; start day is chosen from capacity, free gaps, and dependency finish times
- **Gantt + capacity** — per-person bars across sprint working days, utilization bars, planned vs team capacity in the header
- **Multi-sprint** — header toggle to plan up to 7 sprints; a ticket that cannot sit wholly in one sprint moves to the next; Gantt −/+ zoom and horizontal scroll with a sticky teammate column
- **Ready-ticket highlight** — tickets whose dependencies are already scheduled glow so you know what can go next
- **Undo / redo** — board history (⌘Z / ⇧⌘Z) plus Clear board; graph edits and the plan refresh undo together
- **Save / load plan** — download or import `sprint-plan.json` (gantt + capacity plan)
- **Download tickets** — export the in-memory backlog (edited estimates and deps) as `tickets.json`
- **Team editing** — rename people, set capacity points, add/remove teammates
- **Layout controls** — resizable graph/Gantt split and graph fullscreen

## How to run

Serve the project directory over HTTP (the app loads JSON via `fetch`, so opening the HTML file directly will not work). A network connection is needed on first load for Google Fonts and the Design Component runtime (React / Babel from unpkg).

```bash
cd ganttor
python3 -m http.server 8000
```

Or:

```bash
npm start
```

Open [http://localhost:8000/](http://localhost:8000/).

Any static server works (`npx serve .`, etc.).

### Quick planning loop

1. Edit `tickets.json` and `team.json` for your sprint backlog and roster (a fictional checkout sample ships with the repo).
2. Reload the page — data is fetched on startup; optional `sprint-plan.json` is applied if present.
3. Drag ready tickets onto teammates; click a Gantt bar (or assigned graph node, when Edit is off) to unassign.
4. Turn on **Edit** to change estimates or dependencies; the graph rebounds and the sprint plan refreshes after each change.
5. **Save plan** to download `sprint-plan.json`, **Download tickets** to keep backlog edits, or **Load plan** to restore a schedule.

## Data files

| File | Role |
|------|------|
| `tickets.json` | Sprint metadata, epic colors, story-point → days sizes, ticket list (`id`, `epic`, `title`, `pts`, `deps`) |
| `team.json` | People (`id`, `name`, `role`, `capacity`) |
| `sprint-plan.json` | Optional saved schedule (`gantt`, `capacityPlan`, totals) |

**Download tickets** builds the same shape as `tickets.json` from the current session (including edited `pts` / `deps`) and triggers a browser download. Reload still reads `./tickets.json` from disk — drop the download in the project root when you want edits to stick. The plan file only stores who/when.

If `tickets.json` / `team.json` cannot be read, the app falls back to built-in sample data.

## Sprint plan save / load

**Save plan** does not write into the project folder. It builds a JSON snapshot of the current board and triggers a browser download named `sprint-plan.json`. To have the app auto-load that plan next time, put the downloaded file in the project root (same directory as the HTML) and reload.

### What gets written

| Field | Contents |
|-------|----------|
| `generatedAt` | ISO timestamp when you clicked Save |
| `sprint` | `name`, `start`, `workingDays`, and `multiSprint` (whether later sprints were in use) |
| `totals` | Backlog points, planned points, team capacity, and IDs of tickets still unassigned |
| `capacityPlan` | One row per teammate: capacity, planned/remaining points, utilization %, over-commit flag, and their assigned ticket IDs |
| `gantt` | One row per scheduled ticket, sorted by start day |

Each `gantt` entry includes ticket metadata (`ticket`, `epic`, `title`, `points`), assignee (`assignee`, `assigneeId`), schedule (`startDay` / `endDay` are 1-based working days; `durationDays`; calendar `startDate` / `endDate`), plus `dependencies` and `unmetDependencies` (deps missing or finishing after this ticket’s start).

### How load uses that file

- **On startup:** if `./sprint-plan.json` is present and readable, it is applied after `tickets.json` / `team.json`.
- **Load plan button:** pick any saved JSON file from disk.

Apply rules:

1. People come from `capacityPlan` when present (id, name, capacity); otherwise the current team stays.
2. Each `gantt` row is matched to a ticket (by id) and a person (by `assigneeId`, else name). Unmatched rows are skipped.
3. Start day is taken from `startDay` (converted to 0-based) or `start`. **Duration is always recomputed** from the ticket’s current story points → days map — saved `durationDays` is ignored so size changes in `tickets.json` win.
4. Assignments are then **repacked** (same planner used when dragging) so capacity gaps and dependency order stay consistent. `sprint.multiSprint` turns the Multi-sprint toggle on before packing; if it is off, tickets whose start is past sprint 1 are dropped.

`tickets.json` remains the source of truth for the backlog; the plan file only stores who/when.

## Tests

Logic helpers have Node tests:

```bash
npm test
```

Or:

```bash
node --test unassign-recalc.test.js graph-row-order.test.js graph-epic-order.test.js sprint-horizon.test.js graph-edit.test.js graph-edge-arrow.test.js
```

## License

MIT — see [LICENSE](LICENSE).
