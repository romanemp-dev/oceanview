Product

Name

Oceanview.

One-liner

A local-first desktop-like workspace that organizes your notes, tasks, lists and slidesinto visual stacks, tells you what deserves attention today, and makes the work of yourAI agents visible and transparent.

Problem

A person with many interests, projects and ideas accumulates notes, to-dos, plans andfiles. Items get lost in folder trees; sorting steals attention; agents act invisibly.

Target user

Single user, no accounts. Many parallel topics: work, home, hobbies, watch lists,travel plans. Runs AI agents (primary harness: OpenClaw + GLM) as assistants on topics.

Core concepts

Desk — the main screen; visual metaphor of a physical desktop.
Stack — a pile of items on one topic ("Work", "Japan trip", "Series to watch").
Item — a unit of content: note (markdown), checklist, list, slides.
Inbox — unsorted capture zone; quick notes land here first.
Today tray — cross-stack surface: tasks due today and overdue items.
Attention markers — visual signals: overdue stack, inbox pending, agent made changes.
Agents — user-configured AI workers attached to stacks. They read/write the workspacefolder directly through their harnesses; the desk visualizes what they didand what needs review.
Value propositions (priority order)

Fast capture, zero sorting friction: write a note → desk suggests the stack → one click.
Nothing urgent gets lost: today's tasks and overdue stacks surface automatically.
Transparent agent collaboration: see which agents work on which stacks, what changed,what needs review.
Plain data: everything is markdown files in a normal folder — portable, private,directly usable by any AI agent with file access.
Key scenarios

S1 Quick capture. User hits capture, writes 2 lines → item lands in Inbox → desk suggestsstack "japan-trip" → user confirms with one click.
S2 Morning check. User opens desk → Today tray shows 3 tasks due today + 1 overdue;stack "work" is highlighted → user opens it, handles items, checks them off.
S3 Delegating. User asks an agent (in OpenClaw) to "clean up and summarize the workstack". Agent edits files and appends an activity log entry. Desk shows "work: 5 agent changes".
S4 Reviewing. User opens the stack → sees agent's changes and summary → marks reviewed.
S5 Weekly review. User scans stacks: which are dormant, which have open loops.
MVP definition

spec.md, all P0 items. Roughly: desk with stacks, items as markdown, inbox with suggestedplacement, today tray, overdue highlighting, read-only agent activity visualization,workspace = local folder.

Non-goals (v1)

No cloud sync, no accounts, no multi-user.
No mobile-native; desktop browser first.
No in-app agent runtime; no launching agents from the app.
No rich text editor; markdown only.
No external service integrations (calendar, email) in v1.
No real-time collaboration.
Visual direction (placeholder)

The desk metaphor and visual quality are core to the product. A dedicated visual spec willfollow from the user. v1 uses a clean, calm placeholder theme; code must not hard-codestyles — theming comes later.

