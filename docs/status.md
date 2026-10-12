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

All spec items are done or explicitly deferred except R-17 (final visual
theme) — blocked on the user's visual spec.
Suggested follow-ups: real-agent trial run of docs/workspace-conventions.md
(S3/S4), trash restore/purge UI (D-015), push to origin, v1.0 tag.

Blocked

R-17 (final visual theme) — waiting on the user's visual spec. Everything
else in spec v1.0 is done; MVP (all P0) complete.

Known issues

- Browsers without the File System Access API get an explanatory screen; the
  browser-storage fallback adapter is planned with Wave 1 UI work.
- Trash has no restore/purge UI yet; contents are plain files under .desk/trash/ (D-015).
