Decision log

Append-only. Never rewrite or delete entries. When appending, add the real date.Format: ID, date, context → decision → consequences.

D-001

Context: audience may grow to thousands of users; native apps were considered.
Decision: web app, not native. Mobile via PWA later if needed.
Consequences: one codebase, instant updates, no app-store gate.
D-002

Context: planning happens in a chat without git access; implementation will be handedto local AI agents (OpenClaw) with git and shell access.
Decision: local-first prototype now; backend/hosting deferred to phase 2; repo and docsstructured for agent handoff.
Consequences: no accounts/multi-user in v1; AGENTS.md is the entry point for agents.
D-003

Decision: the repository is the single source of truth; all docs and code in English;user communication in Russian.
Consequences: context is restored from status.md + decisions.md alone.
D-004

Context: users' AI agents must work with the same data the desk shows, without integrations.
Decision: the database is the workspace folder — plain markdown, one folder per stack,YAML front-matter, .desk/ for app state. Agents read/write it directly via their harnesses.
Consequences: zero integration cost for any agent ecosystem; full portability and privacy;file conventions must be designed carefully and versioned.
D-005

Decision: v1 does not launch agents from the app and does not execute agent code.It visualizes external agent activity via the .desk/activity/ log convention (read-only).
Consequences: simpler and safer v1; review UX is designed from day one; launcher is a later feature.
D-006

Decision: smart placement in v1 = deterministic heuristics + one-click confirm, no LLM calls.
Consequences: no API keys or costs in v1; suggestion quality is limited until an optionalLLM suggester is added later.
D-007

Decision: reminders in v1 come from task due dates only (no manual pins).
Consequences: Today tray is fully derived from files; pins are P1 if wanted.
D-008

Context: per-task due dates must live inside markdown so agents and the app read them equally.
Decision: inline @due(YYYY-MM-DD) inside checklist lines; rendered as a date chip;the parser is isolated in a single module so the syntax can change without refactoring.
Consequences: human-readable and agent-editable; not Obsidian-Tasks-compatible —acceptable for v1, revisit if interop is ever needed.
D-009

Decision: product name — "Oceanview" (working title).
Consequences: display-level only (branding/config); user checks name availability beforeany public release; renaming later is cheap by design.
D-010

Decision: primary content-agent harness is OpenClaw + GLM (user migrated from Claude Code).Conventions and examples target OpenClaw first; the format itself stays harness-agnostic(plain files + JSON lines).
Consequences: docs/workspace-conventions.md ships OpenClaw-ready; other harnesses work as-is.