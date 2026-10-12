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

Build agent: Wave 3 per docs/plan.md — R-09 smart placement (deterministic
heuristics, one-click confirm), then R-12 agent activity + workspace
conventions doc, R-13 agent assignment display.
User (optional): push to origin when ready; run `./scripts/serve.sh` and open
http://localhost:8171 in Chrome/Edge to try the flow (restart the server if it
was stopped).

Blocked

R-17 (final visual theme) — waiting on the user's visual spec.

Known issues

- Browsers without the File System Access API get an explanatory screen; the
  browser-storage fallback adapter is planned with Wave 1 UI work.
- Trash has no restore/purge UI yet; contents are plain files under .desk/trash/ (D-015).
