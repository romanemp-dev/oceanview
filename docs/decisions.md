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
D-014

Context: most new users will not have a pre-arranged workspace folder; asking them
to build inbox/stacks/.desk by hand is a dead end at first launch.
Decision: welcome screen offers two paths — "Connect workspace…" (existing folder)
and "Create new desk…" (name + parent folder; the app creates the subfolder and
initializes the full structure). Folder creation goes through the same
showDirectoryPicker (FSA cannot create folders outside a picked directory);
creation over an existing non-empty folder is refused.
Consequences: empty-folder initialization now happens automatically on the create
path; the manual "Initialize workspace" banner stays for the connect path.

D-015

Context: the File System Access API cannot use the OS trash; permanent file
deletion would be scary and irreversible.
Decision: all deletions in v1 are soft — items and whole stacks move to
.desk/trash/<timestamp>/ (stacks keep their file names). No restore UI yet
(trash is browsable as plain files); purge/cleanup is a later decision.
Consequences: no data loss from misclicks; trash grows over time and needs a
cleanup affordance eventually; acceptance criterion for R-04 uses soft-delete
semantics instead of the spec's implied hard delete.

D-016

Context: "bump updated" discipline relies on the writer's honesty — external
agents may skip it, and the user editing in another editor certainly will not
bother. The desk must not trust anyone's discipline.
Decision: proactive external change detection (R-19). Every refresh
fingerprints all item files (SHA-256 into .desk/index.json, the derived cache
from architecture.md) and diffs against the index. Any content change made
outside the app — agent without a log entry, or manual edit — surfaces as a
soft warning: a "Changes outside the app" panel on the desk plus "changed
outside" badges on the affected stack/inbox cards. Changes the app makes
itself are recorded into the index via write hooks and never flagged.
Agent attribution is best-effort: if the activity log mentions the file, the
author is shown. "Mark all seen" re-baselines the flagged files.
Consequences: agents are no longer required to be honest about what they
touched — the desk sees it anyway; every refresh costs one read of all item
files (fine at workspace scale; index.json stays derived and safe to delete);
first run builds a baseline so pre-existing files are not flagged.

D-017

Context: visual-spec.md (v1.0) defines the presentation layer for R-17.
Decision: presentation layer = vanilla Three.js as ESM via importmap, vendored
into the repository (offline requirement). No bundler. Reconsidering Vite
requires a new decision with a real need (shader pipeline etc.).
Consequences: zero build step preserved; vendor directory adds repo weight;
importmap pinned to the vendored copy.

D-018

Decision: DOM overlay handles all editing (capture, editor, search,
suggestions, review); the 3D scene renders only short labels (counters,
nameplates) via canvas textures.
Consequences: no text editing inside WebGL; accessibility and input reuse stay
DOM-native; scene code stays presentational.

D-019

Decision: quick capture dialog gains an optional stack picker (extends R-08);
no selection → inbox/. Spec-level change recorded here per R-08 scope.
Consequences: capture can target a stack directly; inbox remains the default
path; suggestion flow still applies to inbox items only.

D-020

Decision: R-17 is unblocked by visual-spec.md; theming = preset system with
`minimal` (neutral, no window/panorama — dev/fallback) and `oceanview` (full
scene). All visual parameters live in config, no hardcoded styles (per
product.md).
Consequences: the environment layer (window/panorama) is switchable, doubling
as the low-end fallback; theme presets are data, not code forks.

D-021

Decision: working zone (Today tray surface) shows a visible limit of 5 task
sheets + a "+N" mini-stack at the zone edge.
Consequences: zone stays calm under load; overflow is one click away;
spec R-10 logic unchanged (full list remains derivable).

D-022

Decision: mobile webview and WebXR are phases 2–3; storage there swaps the
storage adapter (OPFS or sync backend) following the architecture migration
path; CameraRig input sources (gyro, xr-head) follow the same phasing.
Consequences: v1 stays desktop mouse-only; no adapter API changes required
now; phase 2/3 work is additive.
