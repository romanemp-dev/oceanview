# Implementation plan — spec v1.0 backlog detail

Delivery order grouped into waves. IDs refer to docs/spec.md. This file records
planning detail; authoritative requirements and statuses stay in spec.md.

## Wave 0 — Foundation

### R-01 Workspace connection (P0)
- File System Access API picker (`showDirectoryPicker`, read/write mode).
- Persist the directory handle in IndexedDB; restore on revisit:
  auto-connect when permission is already granted; one-click re-grant button otherwise.
- Uniform storage-adapter interface (`listDir/readFile/writeFile/ensureDir/exists`)
  so domain code never touches the API directly (architecture: layered).
- Graceful screen for browsers without the API (spec: graceful fallback).
- Disconnect (forget the stored handle).
- Minimal structure view to verify acceptance (stacks/items listing).
- Dev server script (ES modules need an http origin; D-012).

### R-02 Workspace conventions (P0)
- Layout scan: `inbox/`, `stacks/<name>/`, `.desk/` detection; validation issue list;
  one-click workspace initialization for empty/non-conforming folders.
- Item model: YAML front-matter subset parser/serializer (D-011):
  `type/title/created/updated/tags`.
- `@due(YYYY-MM-DD)` inline parser isolated in a single module (D-008).
- Checkbox tasks parsed in any item type (D-013) so the Today tray can rely on them.
- Unit tests with a memory adapter (`node --test`, zero runtime dependencies).

## Wave 1 — Desk core

### R-03 Desk view (P0)
- Stack cards with the pile metaphor (layered sheets), item counts, attention-marker slots.
- Inbox card; empty states; desk refresh after every mutation.

### R-04 Stack CRUD + moving items (P0)
- Create stack (folder), rename (folder rename; fallback recreate+copy), delete
  (confirm; files deleted permanently — FSA has no OS-trash API; flag to user first).
- Move item between stacks (read+write+delete; bump `updated`).
- Stack order/colors persisted in `.desk/config.json`.

### R-06 Markdown editor + preview (P0)
- Split editor/preview; minimal safe markdown renderer (headings, emphasis, code,
  lists, links — escaped HTML, no dependencies, XSS-safe).
- Save = write file + bump `updated` front-matter; Ctrl/Cmd+S; dirty-state guard.
- Create item (note/checklist) with a front-matter stub; delete item.

### R-05 (P0 part) Item types
- note + checklist behaviors (checkbox toggling persists to the file).
- P1 part (list, slides) deferred to Wave 4.

## Wave 2 — Tasks & capture

### R-07 Due dates (P0)
- Date chips on tasks; set/clear `@due` via editor or inline date picker;
  today/overdue derivation in local timezone; unit tests.

### R-08 Quick capture (P0)
- Floating button + hotkey (N); two-line composer; creates an inbox item with a
  front-matter stub.

### R-10 Today tray (P0)
- Cross-stack panel: due today + overdue with source stack; click opens the item.

### R-11 Attention markers (P0)
- Overdue stack marker, inbox badge, agent-activity marker slot (wired fully in R-12).

## Wave 3 — Placement & agents

### R-09 Smart placement (P0)
- Deterministic heuristics only (D-006): tag match; term overlap of note text vs
  stack name and existing item contents; recent-stack fallback.
- Suggestion UI on inbox items (top-3 stacks), one-click confirm = move the file;
  "keep in inbox" option.

### R-12 Agent activity (P0)
- Read `.desk/activity/YYYY-MM-DD.log` JSON lines (tolerant: skip malformed lines).
- Per-stack "agent change" marker on refresh; review view: changed files + agent
  summary; mark-reviewed state.
- Ship `docs/workspace-conventions.md` — agent-readable rules (layout, front-matter,
  @due syntax, activity format), OpenClaw-ready per D-010.

### R-13 Agent assignment (P0)
- Per-stack assigned agent(s) in `.desk/config.json`; display on the stack card;
  v1 display-only (editor later, per spec).

## Wave 4 — Polish (P1/P2)
- R-14 full-text search (client-side index over item files, rebuilt on scan).
- R-15 Marp-style slides preview (parse `---` slide separators; minimal renderer).
- R-16 double-click server script polish (basic `scripts/serve.sh` ships in Wave 0).
- R-17 final visual theme — blocked on the user's visual spec.
- R-18 PWA packaging (manifest + service worker, offline shell).

## Wave 7 — Visual scene (R-17, per docs/visual-spec.md)
- Vendor Three.js (ESM importmap, vendored copy, no bundler — D-017).
- CameraRig abstraction (mouse v1; gyro/xr-head later — D-022): yaw ±22°,
  pitch anchors (window/table), dead zone ~12%, exp lerp, welcome drift.
- Scene HOME: panorama → window frame → desk → objects; stacks as paper piles
  with ribbon accents from config; parallax toward near layers.
- Working zone = Today tray surface: due-today + overdue, limit 5 + "+N"
  mini-stack (D-021); always-visible blank sheet for capture (R-08, D-019
  stack picker).
- DOM overlay for all editing; scene renders labels only (D-018).
- Theme presets: minimal (neutral fallback) / oceanview (full scene) —
  parameters in config.json, no hardcoded styles (D-020).
- Animation set per visual-spec §6 (stack build/fly/mass-move/depth/welcome).
- A0 track: panorama pipeline (3:1–4:1 sector image, 4–6 time-of-day keyframes,
  live sprites) — longest content path, starts early.

## Milestones
- M1 = Waves 0–1: usable desk (browse, edit, organize markdown).
- M2 = Wave 2: daily capture + task surface.
- M3 = Wave 3: agent-transparent workspace (markers, review, conventions doc).
- M4 = Wave 4: theme, search, slides, PWA.

## Open questions (non-blocking)
1. R-04 delete semantics: permanent file deletion (FSA has no trash API) — confirm
   with the user before implementing.
2. R-17 visual direction: the user provides the visual spec (per product.md).
