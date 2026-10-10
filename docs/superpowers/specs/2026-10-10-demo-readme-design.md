# Demo-style README design

**Date:** 2026-10-10  
**Status:** approved for planning (pending user review of this file)

## Goal

Rework `README.md` from a long reference document into a **product-demo README**: motion + stills sell the core loop; a compact reference section remains for people planning a real sprint.

## Audience

**Both** new visitors and people who will use ganttor for a sprint:

1. Demo / sell up top  
2. Short “try it” loop  
3. Trimmed data + save/load reference below  

## Scope of features shown

**In media (hero + stills):**

- Dependency graph + drag-and-drop assign → Gantt / capacity (core loop)  
- Ready-ticket highlight  
- Graph Edit mode (story points and/or dependency edit)  

**Mentioned in short prose / bullet strip only (no dedicated screenshots):**

- Multi-sprint  
- Cycle warning  
- Undo/redo, Clear board  
- Save / load plan, Download tickets  
- Team editing, layout controls  

## README structure

1. **Hook** — product name + one-liner (dependencies ↔ capacity); hero GIF immediately under it  
2. **See it** — 2–3 captioned stills (ready highlight, Edit, Gantt + capacity)  
3. **What you get** — ≤6 short bullets (not the current laundry list)  
4. **Try it** — how to serve (`npm start` / `python3 -m http.server`), then a 4–5 step planning loop  
5. **Reference** — compact data-files table + lean save/load rules  
6. **Tests** / **License** — keep short, as today  

Tone: demo-first, skim-friendly. No long field-by-field essays in the hero area.

## Media plan

### Hero GIF

- **File:** `assets/demo.gif` (optional companion `assets/demo.mp4` if useful for quality; README embeds GIF for GitHub reliability)  
- **Length:** ~15–20 seconds, looping  
- **Size target:** prefer under ~8–12MB; compress if needed  
- **Content beats (soft zooms/pans):**
  1. Full board (graph + Gantt)  
  2. Zoom graph — ready tickets glowing  
  3. Drag a ready ticket onto a teammate  
  4. Zoom Edit — change pts and/or a dependency  
  5. Pull back — Gantt bars + capacity fill update  

### Stills

| File | Shot |
|------|------|
| `assets/ready-highlight.png` | Graph with ready tickets glowing |
| `assets/graph-edit.png` | Edit mode (pts and/or dep interaction) |
| `assets/gantt-capacity.png` | Team Gantt + utilization / fill |

- Existing `assets/demo.png` is superseded by the hero GIF; remove from README (file may stay or be deleted only with explicit confirmation).  
- Capture against the shipping checkout sample (`data/tickets.json`, `data/team.json`). A small pre-filled plan may be used during capture so the board isn’t empty, without requiring that plan to ship in the repo unless useful for demos.

### Production

- Fixed browser viewport for consistent framing  
- Record UI interaction; encode to GIF (and optionally MP4) into `assets/`  
- No fake mockups — real app UI only  

## Reference section (trim)

**Keep, shortened:**

- Data files table (`tickets.json`, `team.json`, `sprint-plan.json`) + one line that reload reads disk and Download triggers a browser file  
- Save/load as bullet rules only: plan stores who/when; duration recomputed from current pts; unmatched rows skipped; put downloaded plan in project root to auto-load  

**Cut or collapse:**

- Long “Main capabilities” list → ≤6 bullets or fold into still captions  
- Detailed field-by-field `sprint-plan.json` schema essay  

**Unchanged:**

- Tests command block (paths may stay current)  
- MIT license pointer  

## Out of scope

- New product features or UI changes beyond what’s needed to capture demos  
- Separate marketing site  
- Annotated overlay graphics on screenshots (optional labels only if a shot is unclear)  
- Expanding multi-sprint / cycle warning into their own demo media  

## Success criteria

- README opens with hook + looping hero that shows the core loop with zooms  
- Three feature stills with short captions for ready / Edit / Gantt  
- Someone can run the app and complete the planning loop from the README alone  
- Reference section is skimmed in under a minute  
- No loss of critical save/load behavior facts (who/when, duration recompute, auto-load path)  

## Implementation notes (for the plan)

1. Start app locally; stage a photogenic board state for capture  
2. Record hero sequence; encode GIF (+ optional MP4)  
3. Capture three stills  
4. Rewrite `README.md` per structure above  
5. Spot-check image paths and that the GIF loops cleanly on GitHub-style markdown preview  
