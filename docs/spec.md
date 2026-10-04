Specification — v1.0 (frozen)

Statuses: planned / in-progress / done / blocked.The build agent takes the topmost planned P0 task.

ID	Requirement	Priority	Status
R-01	Connect a local folder as workspace (File System Access API); restore on revisit	P0	planned
R-02	Workspace conventions: stacks/<name>/ folders, inbox/, .desk/ state; YAML front-matter on items	P0	planned
R-03	Desk view: stacks as visual piles with item counts and attention markers	P0	planned
R-04	Stack CRUD; move items between stacks	P0	planned
R-05	Item types: note, checklist (P0); list, slides (P1)	P0/P1	planned
R-06	Markdown editor + preview for items	P0	planned
R-07	Tasks: checkboxes with per-task due date via inline @due(YYYY-MM-DD); item-level due: in front-matter optional	P0	planned
R-08	Quick capture (button + hotkey) → item lands in inbox/	P0	planned
R-09	Smart placement: heuristic suggestions for inbox items, one-click confirm moves the file	P0	planned
R-10	Today tray on the desk: all tasks due today + overdue, across stacks	P0	planned
R-11	Attention markers: stack with overdue items, inbox badge, agent activity	P0	planned
R-12	Agent activity: read .desk/activity/ logs (append-only JSON lines), per-stack markers, review view (read-only); ship docs/workspace-conventions.md targeting OpenClaw	P0	planned
R-13	Agent assignment per stack (stored in .desk/config.json); v1 = display only, editor later	P0	planned
R-14	Full-text search across items	P1	planned
R-15	Slides preview (Marp-style markdown)	P1	planned
R-16	Double-click local server script, if file:// limits block any feature	P1	planned
R-17	Final visual theme (blocked on user's visual spec)	P1	blocked
R-18	PWA packaging (installable, offline)	P2	planned
Acceptance criteria (the risky P0s)

R-01: given a folder matching the conventions, picking it shows correct stacks/items;after closing and reopening the browser the workspace restores without re-picking.
R-07: task with @due(today's date) appears in Today tray; overdue unchecked taskadds a red marker to its stack; checking it off removes it from the tray.
R-09: inbox note "buy flights to Osaka" with an existing stack whose files mentionOsaka → suggestion shown; confirming moves the file into that stack folder.
R-12: appending a valid activity log line → stack shows "agent change" marker onrefresh; clicking it opens a review view listing changed files and the agent's summary.
Notes

Slides = Marp-style markdown (confirmed).
v1 target browser: desktop Chrome/Edge for full file access; graceful fallback elsewhere.
Review depth in v1: view changes + mark reviewed. Accept/reject is a phase-2 feature.