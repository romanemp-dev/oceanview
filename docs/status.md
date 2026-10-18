Status

Phase: 1 — implementation (spec v1.0 frozen)

Done

Product concept, full docs set, decisions D-001 … D-010.
Spec v1.0 frozen after user confirmations (platform, slides, review depth, due syntax, name).
docs/plan.md added — backlog detail grouped into waves (M1–M4 milestones).
R-01 done — workspace connection via File System Access API (commit fc8fa9f):
picker, IndexedDB handle persistence, restore/re-grant on revisit, disconnect,
uniform storage-adapter interface, structure view (stacks/inbox cards),
dev server script scripts/serve.sh.
R-02 done — workspace conventions and item model (commit 18bd378):
layout scan/validate + one-click initialization, front-matter subset
parser/serializer, @due(YYYY-MM-DD) parser (isolated module, D-008),
checkbox tasks in any item type (D-013), workspace model ops
(createStack/createItem/moveItem/config), memory adapter, 11 unit tests via
node --test — all passing.

In progress

Nothing yet.

Scene robustness (2026-10-19, user report "empty colored screens"): the scene
canvas could stay on a cleared background with no geometry (render loop /
shader failure in some GPU environments, or a stale service-worker shell).
Mitigations: a render watchdog — if no frame/draw call lands within 1.5 s the
app disposes the scene and falls back to the normal DOM desk; a self-service
cache reset at /?reset=1 (unregisters the SW, clears its caches, keeps the
workspace handle); SW cache bumped to v5 and registration made update-proof
(sw.js?v=5, updateViaCache:none); a global runtime-error overlay; debug HUD
(?debug=1) with frame/draw counters; demo mode ?demo=1[&scene=…&stacks=N].

Wave 7 QA pass (2026-10-19, self-inspection via headless Chrome + demo mode):
- demo mode: /?demo=1[&scene=oceanview][&cam=window|rest|desk] — in-memory
  workspace; lets the desk and scene be inspected without picking a folder
- fixed a regression where earlier main.js fixes (scene root mode, stack
  clicks, disconnect cleanup) were overwritten by a stale build copy
- scene rescaled to realistic proportions (~1.4 m desk, seated camera) after
  screenshot review showed a "giant paper" world
- camera base orientation moved to horizontal; three anchors: window (0.02),
  rest POV composition (-0.18, matches the user's POV reference), desk (-0.6)
- stacks: thick sheet piles with flat readable labels, thin ribbons, overdue
  seals; labels leaned slightly toward the viewer; pile scale reduces when
  more than 6 stacks
- status: window/pano, sill props, pen cup, warm light verified by screenshots

Scene mode UX (2026-10-19, user feedback): at the root level the 3D scene is
the desk — DOM cards are no longer rendered on top; the topbar stays above the
canvas (z-index) so the Scene toggle can always switch back; clicking a stack
in the scene opens that stack level as a DOM overlay (breadcrumb "Desk" returns
to the scene).

Fixed (2026-10-19, user report): welcome buttons unclickable — the scene canvas
rule `display:block` (declared later, same specificity) overrode `.hidden`,
leaving a transparent full-screen canvas above the welcome screen that swallowed
all clicks. `.hidden` is now `!important`; the DOM overlay sits above the
canvas with pointer-events pass-through on empty areas; disconnect now disposes
the scene and hides the canvas.

Fixed (2026-10-19, user report): blank app shell (only brand + status text) —
src/visual/mount.js imported './visual/scene.js' from inside src/visual/,
resolving to a 404 and breaking the whole module graph. Imports corrected;
stray duplicate files (src/core/desk.js, src/ui/main.js) removed. Added
scripts/check-imports.mjs — a static import checker (run it before commits);
all 24 module files pass.

Wave 7 step 3 (2026-10-19, user references): A0 panorama landed — the real
window view (assets/panorama/bay-view.jpg, user-provided reference) is
cover-fitted into the window with UV crop; POV reference applied: window
mullion, pen cup with pencils, plant and books on the sill. Animations v1
(visual-spec §6): staggered stack assembly on first build, note flights from
the working zone to the receiving stack (pulse), wired to moves and capture.
SW cache v3 includes scene, vendor and panorama assets.

Wave 7 step 2 (2026-10-19, user feedback + visual references): camera raised to
1.6 m and pulled to the desk edge; pitch anchors re-tuned — top = straight into
the window, bottom = desk fills ~90% of the frame; yaw reduced to ±15° and
lerp slowed for calmer tracking; desk deepened to reach the viewer; warm
window light, wall around the window, windowsill with placeholder props
(plant, books); working-zone sheets now sit on the desk surface (y fix).
Scene toggle button added to the topbar (off → minimal → oceanview).

HANDOFF.md added (repo root): full handoff for external AI agents — project
description, file map, data model, architecture, current stage, ordered next
steps, verification checklist.
Fixed (2026-10-17): m-rig blank page — vendor/three was missing three.core.js
(r171 module split); vendored + camera pitch sign corrected; m-rig now shows
an error overlay on module failures.

visual-spec.md added (v1.0, user-authored): presentation layer for R-17 —
Three.js scene, camera rig, working zone, panorama pipeline, animation table.
R-17 unblocked and set to planned. Decisions D-017…D-022 recorded
(Three.js ESM vendored, DOM overlay, capture stack picker, theme presets
minimal/oceanview, working-zone limit 5+N, mobile/XR phasing).

Wave 6 done — nested stacks (folder-tree model): stacks may contain sub-stacks
at any depth (stacks/<stack>/<sub>/...), the desk shows only the top level,
clicking a stack with children opens that level with breadcrumbs; create/
rename/delete/agents/trash all work with nested paths; trash preserves the
sub-tree structure. Conventions unchanged (a sub-stack is just a folder).

Wave 5 UX (commit 45bc916): silent saves from the reader — checkbox toggles
and due dates persist in place with a brief "saved" chip, no edit mode;
notes get an inline "+ Add text" tail editor and click-to-rename titles;
welcome item moved to inbox/; service worker switched to network-first so
updates reach the browser without manual cache bumps.

Wave 5 done (commit d797f46): trash management (manifest _origin.json,
restore with stack/folder recreation and name dedupe, purge with explicit
confirm, topbar Trash view) and full R-13 (per-stack agent assignment via
desk dialog, config.json as the store).

R-19 done — proactive external change detection (user-prioritized, D-016):
content fingerprints (SHA-256) of all item files in .desk/index.json, diffed
on every desk refresh; catches agent edits without log entries and manual
edits; soft-surfaced as a desk panel + "changed outside" badges; app-owned
writes are hook-recorded and never flagged; "Mark all seen" re-baselines.

Conventions audit (commit aa14d4f): workspace-conventions.md checked rule-by-
rule against the implementation. Two doc fixes (type enum extended to
note|checklist|list|slides; removed the undocumented stack:"desk" scope) and
two code consolidations (unreviewedCount shared by markers and review view).
Verified by an end-to-end agent simulation: inbox move, created/updated
semantics, @due parsing, activity log write/read, review-state persistence.

R-14 done — full-text search (commit 97944d2): client-side over the desk
snapshot, title/body scoring with phrase bonus, snippets, topbar dropdown,
'/' hotkey.
R-15 done — slides preview (commit 97944d2): Marp-style --- separators with
front-matter options, paged viewer (arrow keys), dark theme, editor preview
of slide 1.
R-05 fully done (commit 97944d2): P1 types list + slides added to the
note/checklist cycle.
R-18 done — PWA packaging (commit 62dd587): manifest, SVG icon, service
worker offline shell (cache-first app shell; workspace files stay on the
File System Access API path).
R-16 covered by scripts/serve.sh since R-01 (spec's conditional need — no
file:// feature blocking observed); no extra double-click script added.

R-09 done — smart placement (commit 0d448e4): deterministic scoring (shared
terms, stack-name tokens, tags; recent-stack fallback), one-click confirm
buttons with reasons on inbox items.
R-12 done — agent activity (commit f61f74f): activity log reader with
malformed-line tolerance, per-stack change markers, review view with
mark-reviewed state; docs/workspace-conventions.md shipped (OpenClaw-ready).
R-13 done — agent assignment display: agents from .desk/config.json shown as
chips on stack cards; config.json is the manual editor in v1 (per spec).

R-07 done — due dates (commit ae59a0d): setTaskDue set/change/clear @due on the
nth task line; due chips with today/overdue styling; chips are date inputs in
the reader, changes persist to the file.
R-08 done — quick capture (commit 9995c74): FAB + hotkey N, two-line composer,
item lands in inbox/.
R-10 done — today tray (commit 9995c74): due-today + overdue across stacks and
inbox, overdue first, click-through to the item.
R-11 done — attention markers (commit 9995c74): overdue/due-today pills on
stack cards, tray overdue note; agent-activity marker slot lands with R-12.

R-04 done — stack CRUD + moving items (commit 457f49f):
create/rename stack (dialog), soft-delete stack/items to .desk/trash/ (D-015),
move item between stacks and inbox, item name dedupe, desk view rendering
(stack cards with attention markers, item lines, new-stack card).
R-06 done — markdown editor + preview and item view (commit 676b557):
XSS-safe dependency-free markdown renderer, split editor/preview with
Ctrl/Cmd+S save, checkbox toggling in reader, type switch, move/delete dialogs,
desk<->item routing.

Next

Build agent: implement R-17 per docs/visual-spec.md — vendor Three.js,
CameraRig (mouse), scene HOME (working zone + stacks), theme presets
minimal/oceanview; start the panorama pipeline track (A0) early.
Suggested follow-ups: capture stack picker (D-019), working-zone limit (D-021).

Blocked

R-17 (final visual theme) — planned, requirements in docs/visual-spec.md.
Everything else in spec v1.0 is done; MVP (all P0) complete.

Known issues

- Browsers without the File System Access API get an explanatory screen; the
  browser-storage fallback adapter is planned with Wave 1 UI work.
- Trash has no restore/purge UI yet; contents are plain files under .desk/trash/ (D-015).
