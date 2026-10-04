Architecture (v1.0)

Principles

Local-first: fully offline; user data never leaves the machine.
Plain files are the database. The workspace is a normal OS folder of markdown files.No proprietary formats. Any tool — including AI agents — reads/writes it directly.
Layered: storage (workspace I/O) is isolated from domain logic and UI. A futurebackend/sync replaces storage without touching the rest.
Progressive enhancement: core works with a browser-storage fallback; full power withthe File System Access API (desktop Chrome/Edge).
Workspace layout (convention v1)

workspace/ inbox/ # unsorted items; desk suggests placement from here stacks/ work/ # one folder = one stack; folder name = stack name 2025-06-01-q3-plan.md checklist-renovation.md japan-trip/ ... .desk/ config.json # app settings, stack meta (assigned agents, colors, order) activity/ # agent activity logs; agents append, app reads index.json # derived cache; safe to delete, app rebuilds; agents never edit

text


Item = one markdown file with YAML front-matter:
type: note # note | checklist | list | slides title: Flights to Osaka created: 2025-06-01 updated: 2025-06-01 tags: [travel]

Body text. Checklist tasks: "- [ ] buy flights @due(2025-06-20)"

text


## Stack
- Frontend-only, no backend in v1.
- Default: no-build vanilla ES modules to keep "open and run" simplicity. If complexity
  demands a bundler, propose Vite in docs/decisions.md before switching.
- File access: File System Access API (`showDirectoryPicker`); permission persistence on
  revisit via IndexedDB. If file:// blocks anything, ship R-16 (one-click local server).

## Agent integration (v1: read-only visualization)
- Content agents run outside the app. Primary harness: OpenClaw + GLM.
- Agents edit workspace files directly and append JSON lines to `.desk/activity/YYYY-MM-DD.log`:
  `{"ts":"...","agent":"...","stack":"...","action":"edit|create|summarize","files":["..."],"summary":"..."}`
- The desk reads logs, aggregates per stack, shows markers and a review view.
- R-12 ships docs/workspace-conventions.md: a concise agent-readable rules file (workspace
  layout, front-matter, @due syntax, how to append activity lines), written so the user
  can drop it into their OpenClaw agent's instructions as-is.
- Later: optional in-app launcher, agent gateway on backend.

## Migration path
Phase 2 adds hosting + sync backend; the storage layer swaps to an API client; the
workspace folder remains the source of truth.
