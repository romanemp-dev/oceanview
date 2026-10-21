# Oceanview — project handoff for AI assistants

_Last updated: 2026-10-21 (v1.0 scope; Tier 0 + Tier 1 shipped)._

> Give this file (plus `AGENTS.md` and the `docs/` set) to any AI coding agent.
> Read order: this file → `AGENTS.md` → `docs/product.md` → `docs/spec.md` →
> `docs/architecture.md` → `docs/decisions.md` → `docs/status.md` →
> `docs/visual-spec.md` (for visual work) → `docs/plan.md`.

## 1. What this project is

Oceanview is a **local-first personal desk web app**. Its database is a normal
folder of markdown files chosen by the user (File System Access API). There is
no backend, no accounts, no cloud. A visual "desk" shows stacks (one folder =
one stack) of notes, checklists, lists and slides; a Today tray surfaces due
and overdue tasks; AI agents (primary harness: OpenClaw) work on the same
folder directly and their activity is visualized for review.

Target: desktop Chrome/Edge. Vanilla ES modules, no bundler, zero runtime
dependencies (Three.js is vendored for the visual layer).

## 2. Current status (2026-10-19)

**MVP is complete.** Spec v1.0 items:

- Done: R-01…R-13 (all P0), R-05 P1 (list/slides), R-14 search, R-15 slides
  preview, R-16 (covered by `scripts/serve.sh`), R-18 PWA.
- **R-17 (final visual theme): planned** — requirements in
  `docs/visual-spec.md`; v1.0 visual scope: ONE background / single time of day, near-ideal on
desktop + mobile; time-of-day states and WebXR are post-v1.0 (D-023).
Tier 0 (ACES, cinematic light, vignette) and Tier 1 (toon shading, ink edges,
rim light, procedural wood) are shipped; next: Tier 2 with the final
single panorama (prompt template in docs/pano-prompt.md).
Wave 7 steps 1–5 shipped (Three.js scene foundation + M-rig camera demo;
  camera framing per user feedback; A0 panorama from the user reference with
  cover-fit; POV props; v1 animations; QA pass with realistic scale and three
  camera anchors; render watchdog + DOM fallback; demo mode; no-store server).
  See §8 for the continuation plan.

**Beyond the original spec** (tracked in decisions.md/plan.md):

- R-19 external change detection: SHA-256 fingerprints in `.desk/index.json`,
  soft "changed outside the app" panel (D-016).
- Wave 5: trash restore/purge with `_origin.json` manifests (D-015 extended),
  per-stack agent assignment editor (R-13 full).
- Wave 5 UX: silent checkbox/due-date saves from the reader, inline
  "+ Add text" editing, click-to-rename titles.
- Wave 6: nested stacks — sub-stacks at any depth (`stacks/<stack>/<sub>/…`),
  one-level desk navigation with breadcrumbs.

**Known issues / deferred work:**

1. **Nested-stack navigation UX (open, user-deferred).** A stack card is only
   clickable when it already has sub-stacks, and the "+ New sub-stack" card
   appears only after entering a stack — so an empty stack cannot be entered
   to create its first child. Planned fix: make every stack card openable
   (title click → `openStackPath(stack.path)`) and/or add a per-card
   "+ sub-stack" action.
2. **M-rig blank page (fixed 2026-10-17).** Cause: `vendor/three/three.module.js`
   (r171) imports `./three.core.js`, which was not vendored → module 404 →
   only the static HUD rendered. Fixed by vendoring `three.core.js`; the pitch
   sign in `camera-rig.js` was also corrected (cursor down now looks down).
   If a similar blank page appears, open DevTools console — `m-rig.html` now
   shows an error overlay for module failures.
3. **Docs stack in the user's workspace is a snapshot.** The repository is the
   source of truth; the workspace "Oceanview" stack holds readable copies and
   is refreshed by an agent task (`stacks/Oceanview/agent-task-sync-docs.md`).
4. R-17 panorama: v1 asset is in the repo (`assets/panorama/bay-view.jpg`,
   cover-fitted). Next: 4–6 time-of-day keyframes (visual-spec §9).
5. **Blank coloured scene screens (fixed 2026-10-19).** Root cause:
   `camera-rig.js` was missing the `pitchRest` default → NaN pitch on the first
   tick → NaN camera quaternion → everything frustum-culled → only the clear
   colour rendered. Fixed and verified. A render watchdog now falls back to
   the DOM desk if no frame/draw lands in 1.5 s.
6. **Stale build in the browser (fixed 2026-10-19).** The old python dev server
   allowed heuristic HTTP caching of modules. The dev server is now
   `server.mjs` (Cache-Control: no-store). If a browser is still stuck: open
   `/reset.html`, then hard-reload once (Cmd+Shift+R).

## 3. Repository layout

```
oceanview/
├── AGENTS.md                  # rules for the build agent (read first)
├── HANDOFF.md                 # this file
├── README.md                  # short overview + running
├── index.html                 # app shell (DOM overlay container + scene canvas)
├── styles.css                 # all styles, CSS custom properties only
├── sw.js                      # service worker: network-first shell, offline cache
├── manifest.webmanifest       # PWA manifest
├── m-rig.html                 # standalone CameraRig demo (M-rig milestone)
├── icons/icon.svg             # app icon
├── scripts/serve.sh           # dev server (python3 http.server, port 8171)
├── vendor/three/
│   ├── three.module.js        # Three.js r171 ESM build (vendored)
│   ├── three.core.js          # required by three.module.js (vendored)
│   └── LICENSE
├── docs/
│   ├── product.md             # goals, non-goals (never edit)
│   ├── spec.md                # requirements R-01…R-18 + statuses (frozen v1.0)
│   ├── architecture.md        # storage/layering, workspace layout, migration
│   ├── decisions.md           # append-only log D-001…D-022
│   ├── status.md              # current state, next steps, known issues
│   ├── plan.md                # wave breakdown (Waves 0–7)
│   ├── visual-spec.md         # R-17: scene, camera, themes, animations (EN)
│   └── workspace-conventions.md  # agent rules for the workspace folder
├── src/
│   ├── main.js                # bootstrap, routing (desk/item/review/trash),
│   │                          #   connection flow, handlers, change tracker wiring
│   ├── core/                  # domain + storage (no DOM)
│   │   ├── fsaccess.js        # FSA adapter: pick dir, permissions, file ops
│   │   ├── idb.js             # IndexedDB store for the directory handle
│   │   ├── memory-adapter.js  # in-memory adapter (unit tests)
│   │   ├── workspace.js       # model: scan, items, stacks (nested), trash,
│   │   │                      #   agents, config, review-state
│   │   ├── frontmatter.js     # YAML-subset parse/serialize (D-011)
│   │   ├── tasks.js           # @due(YYYY-MM-DD), checkbox toggles (D-008)
│   │   ├── markdown.js        # dependency-free XSS-safe markdown renderer
│   │   ├── search.js          # full-text search over the desk snapshot
│   │   ├── slides.js          # Marp-style --- splitter
│   │   ├── placement.js       # deterministic inbox→stack suggestions (D-006)
│   │   ├── activity.js        # activity log reader + unreviewed counters
│   │   └── changes.js         # external change detection (R-19, D-016)
│   ├── ui/                    # DOM views (overlay layer)
│   │   ├── desk.js            # desk cards, stack dialogs, breadcrumbs
│   │   ├── item.js            # reader, inline edit, full editor, slides viewer
│   │   ├── capture.js         # quick capture FAB + hotkey N + composer
│   │   ├── today.js           # Today tray aggregation + rendering
│   │   ├── search.js          # topbar search dropdown ('/' hotkey)
│   │   ├── review.js          # agent activity review view
│   │   └── trash.js           # trash list / restore / purge
│   └── visual/                # 3D layer (subscribes to state, never reads files)
│       ├── camera-rig.js      # mouse rig: yaw ±22°, pitch anchors, drift
│       ├── scene.js           # HOME scene: desk, stacks, working zone
│       └── mount.js           # opt-in bootstrap (localStorage switch)
└── test/                      # node --test suites (54 tests, all green)
    ├── workspace.test.js      # frontmatter/tasks/model basics
    ├── wave1.test.js          # R-04/R-06: trash, rename, markdown
    ├── wave2.test.js          # today tray, capture
    ├── wave3.test.js          # placement, activity, review-state
    ├── wave4.test.js          # search, slides
    ├── wave5.test.js          # trash restore/purge, agents
    ├── changes.test.js        # R-19 fingerprints/hooks/attribution
    └── nested.test.js         # Wave 6 nested stacks
```

## 4. Data model (workspace conventions)

The user's workspace folder (outside the repo):

```
workspace/
  inbox/                # unsorted items
  stacks/<stack>/       # one folder = one stack; sub-folders = sub-stacks
    <item>.md           # one markdown file per item
    <sub-stack>/...
  .desk/
    config.json         # stack meta: colors, order, agents, lastReviewedTs
    activity/YYYY-MM-DD.log  # append-only JSON lines from agents
    review-state.json   # last reviewed activity ts per stack
    index.json          # derived cache: file fingerprints + pending changes
    trash/<stamp>[-name]/    # soft-deleted entries + _origin.json manifest
```

Item front-matter: `type` (note|checklist|list|slides), `title`, `created`,
`updated`, `tags`. Tasks: `- [ ] text @due(YYYY-MM-DD)` (checked tasks `- [x]`).
Agents must append one JSON line per logical change to the activity log — see
`docs/workspace-conventions.md` (it is also copied to the workspace root as
`AGENTS.md`).

## 5. Architecture and data flow

`storage adapter` (fsaccess.js, memory-adapter.js) → `workspace model`
(workspace.js: scan/read/write, conventions) → `UI` (DOM views, visual scene).
The scene/UI never touch the File System API directly.

- **Connection:** `showDirectoryPicker` → handle persisted in IndexedDB →
  restore on revisit with one-click re-grant when the browser requires it.
- **Writes:** every app write goes through the model, which bumps `updated`
  and fires hooks; hooks feed the change tracker (`changes.js`) so app-owned
  edits never show up as "external changes".
- **Change detection:** on refresh, all item files are hashed (SHA-256) and
  diffed against `.desk/index.json`; changed/added/removed items surface in a
  soft panel; agent attribution comes from activity log `files` entries.
- **Nested stacks:** `readDesk(path)` returns one level (items + child stack
  names + relative path); navigation is a folder-tree with breadcrumbs.
- **Visual layer:** opt-in via `localStorage` key `oceanview-visual`
  (`{"theme":"minimal"}` or `{"theme":"oceanview"}`); DOM overlay remains the
  editing layer (D-018); scene reads only the desk snapshot.

## 6. Running, testing, viewing

```bash
cd ~/Documents/Apps/oceanview
./scripts/serve.sh            # http://localhost:8171 (dev server, keep running)
node --test test/             # 54 tests, must stay green
```

Open `http://localhost:8171` in desktop Chrome/Edge, connect a workspace
folder (or create a new desk). Camera rig demo: `http://localhost:8171/m-rig.html`.
Demo mode (no folder picking, in-memory workspace):
`http://localhost:8171/?demo=1` — add `&scene=oceanview` and
`&cam=window|rest|desk` to inspect the 3D scene; `?cam=rest` matches the POV
composition reference. This is the fastest way for an agent to screenshot the UI.
Scene preview: in DevTools console run
`localStorage.setItem('oceanview-visual','{"theme":"oceanview"}')`, reload,
connect a workspace. Remove the key to return to the DOM-only desk.

If the page looks stale after an update: hard reload (Cmd+Shift+R). The service
worker is network-first for shell assets, so normal reloads should pick up
changes when online.

## 7. Rules for agents (condensed from AGENTS.md)

- The repository is the single source of truth; docs are English.
- Take the topmost planned P0 task from `docs/spec.md` (or the next item in
  `docs/plan.md`); one task = one commit; commit message references the task.
- A task is done only when the app runs, acceptance criteria pass, and
  `docs/status.md` is updated.
- Non-obvious decisions go to `docs/decisions.md` (append-only, real dates).
- Never edit `docs/product.md`; never weaken non-goals; ask before changing
  the data model / workspace conventions / adding runtime dependencies.
- `file://` does not work (ES modules); always run via the dev server.

## 8. How to continue (ordered)

1. **Fix nested-stack UX** (small, high value): every stack card opens on
   title click; add a "+ sub-stack" action directly on cards; keep breadcrumbs.
2. **Wave 7 — visual scene** (per `docs/visual-spec.md`):
   a. A0 track: panorama assets — v1 single reference image landed
      (`assets/panorama/bay-view.jpg`); next: 4–6 time-of-day keyframes.
   b. Camera polish: pitch framing per §3 (window 70–80% up, desk 90–99% down),
      optional drag mode; verify with `m-rig.html`.
   c. Animations §6: stack assembly, note flights, mass moves, depth
      transitions, welcome drift; never block input.
   d. Working zone: limit 5 + "+N" (D-021) with a DOM overflow panel; blank
      capture sheet wired to the capture dialog with optional stack picker
      (D-019 — extend `src/ui/capture.js`).
   e. Make the scene the primary desk UI for the `oceanview` preset while
      keeping the DOM desk for `minimal` and as a no-WebGL fallback.
3. **R-17 closure:** document the chosen theme preset, update spec/status,
   add acceptance notes; keep all styling in CSS variables/config (D-020).
4. Backlog: trash purge scheduling, tag editing UI, PWA icon PNG set.

## 9. Verification checklist for any change

- `node --test test/` — all green (add tests for new core logic).
- `./scripts/serve.sh` running; pages return 200 (including
  `/vendor/three/three.core.js`).
- Desk flow smoke: connect workspace → open stack → create item → toggle a
  checkbox (persists, "saved" chip) → refresh (state intact) → Today tray
  shows due tasks.
- Agent flow: append a valid activity line → stack shows "N agent changes" →
  review view opens → mark reviewed clears it.
- Workspace writes by the app must not appear in the "Changes outside the
  app" panel; external edits must appear.
