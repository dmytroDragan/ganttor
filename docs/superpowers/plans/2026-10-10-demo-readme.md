# Demo-style README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a demo-first README with a zoomed hero GIF, three feature stills, and a trimmed reference section.

**Architecture:** Capture real UI from the local static server into `assets/`, then rewrite `README.md` to hook → GIF → stills → try-it → compact reference. No product code changes unless capture is blocked.

**Tech Stack:** static HTTP server, browser capture, ffmpeg for GIF, Markdown README

## Global Constraints

- Follow `docs/superpowers/specs/2026-10-10-demo-readme-design.md`
- Media shows: core loop, ready highlight, graph Edit only
- Trim reference aggressively; keep save/load critical facts
- Do not delete `assets/demo.png` without user confirmation
- Do not commit unless the user asks

---

### Task 1: Stage and capture media

**Files:**
- Create: `assets/demo.gif`
- Create: `assets/ready-highlight.png`, `assets/graph-edit.png`, `assets/gantt-capacity.png`
- Optional: `assets/demo.mp4`

**Interfaces:**
- Consumes: `data/tickets.json`, `data/team.json`, running app at `http://localhost:8000/`
- Produces: asset files listed above for Task 2

- [x] **Step 1: Start the app** (python http.server on :8765)
- [x] **Step 2: Open app, stage board**
- [x] **Step 3: Capture stills** → `ready-highlight.png`, `graph-edit.png`, `gantt-capacity.png`
- [x] **Step 4: Capture hero sequence** → `assets/demo.mp4` + `assets/demo.gif` (~15s, ~6.4MB)
- [x] **Step 5: Verify assets**

---

### Task 2: Rewrite README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: assets from Task 1
- Produces: demo-style README matching the approved structure

- [x] **Step 1: Replace README content** (demo-first structure)
- [x] **Step 2: Spot-check paths**
- [x] **Step 3: Done checkpoint**

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Hero GIF with zooms | Task 1 |
| Three stills | Task 1 |
| README structure / trim | Task 2 |
| Critical save/load facts | Task 2 |
| No delete demo.png without confirm | Task 1 (keep file) |
