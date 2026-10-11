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

Onboarding reworked (D-014): welcome screen with two paths — "Connect workspace…"
and "Create new desk…" (app creates the folder and initializes the structure).
Commit a75b5d5; decisions.md updated.

Next

Build agent: R-03 desk view polish on live data, then R-04 stack CRUD + move items
(Wave 1 continues per docs/plan.md).
User (optional): push to origin when ready; run `./scripts/serve.sh` and open
http://localhost:8171 in Chrome/Edge to try the flow.

Blocked

R-17 (final visual theme) — waiting on the user's visual spec.

Known issues

- Browsers without the File System Access API get an explanatory screen; the
  browser-storage fallback adapter is planned with Wave 1 UI work.
- Stack delete (R-04) will permanently delete files (FSA has no OS-trash API) —
  confirm semantics with the user before implementing (see docs/plan.md open questions).
