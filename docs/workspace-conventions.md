# Workspace conventions — for AI agents

This file is written for AI coding agents (primary harness: OpenClaw + GLM)
working inside an Oceanview workspace folder. Drop it into your agent's
instructions as-is, or let the agent read it on first use.

The workspace folder is the single source of truth. Everything the desk shows
is plain files; everything you do is plain file operations. No APIs, no
integrations.

## Layout

```
workspace/
  inbox/                  # unsorted items; the desk suggests placement from here
  stacks/<name>/          # one folder = one stack; folder name = stack name
    *.md                  # items (see Item format)
  .desk/                  # app state — do not restructure
    config.json           # stack meta: colors, order, assigned agents
    activity/             # YOUR activity logs (see below)
    review-state.json     # last-reviewed timestamps; do not edit
    trash/                # soft-deleted items; do not restore silently
```

## Item format

One markdown file per item, with YAML front-matter:

```markdown
---
type: note            # note | checklist
title: Flights to Osaka
created: 2026-06-01
updated: 2026-06-01
tags: [travel]
---

Body text.

Checklist tasks: "- [ ] buy flights @due(2026-06-20)"
```

Rules:

- `title` must match the content; keep `created` unchanged; bump `updated`
  (YYYY-MM-DD, local date) whenever you change the file.
- Tasks are markdown checkboxes in any item type. Due date syntax is exactly
  `@due(YYYY-MM-DD)` at the end of the task line. Do not invent other date
  formats — the desk parses only this one.
- Do not create files outside `inbox/` and `stacks/<name>/` (except your
  activity logs).

## Working with content

- When asked to "clean up" or "summarize" a stack, edit the item files in
  place. Prefer editing existing items over creating duplicates.
- Sort inbox items into stacks when the target stack is obvious from content;
  otherwise leave them in `inbox/` — the user confirms placement with one
  click.
- Never delete user content to `.desk/trash/` on your own initiative;
  deletion is a user action.

## Activity log — mandatory

After every work session on a stack, append one JSON line **per logical
change** to `.desk/activity/YYYY-MM-DD.log` (local date). Create the file if
missing. The desk reads these lines to show the user what you did and what
needs review.

Line format (single line, valid JSON, UTF-8):

```json
{"ts":"2026-06-01T14:32:11.000Z","agent":"my-agent","stack":"work","action":"edit","files":["stacks/work/q3-plan.md"],"summary":"Reordered priorities, added milestones section"}
```

Field rules:

- `ts` — ISO-8601 timestamp of the change (UTC with Z is fine).
- `agent` — your agent's name, stable across sessions.
- `stack` — stack name exactly as the folder name under `stacks/`; use
  `"inbox"` for inbox work; use `"desk"` for workspace-wide operations.
- `action` — one of `create | edit | summarize | move | cleanup`.
- `files` — workspace-relative paths you touched, as an array.
- `summary` — one human-readable sentence: what changed and why.
- Append only; never rewrite or delete log lines. If a line is malformed,
  write a corrected one after it — the desk skips broken lines.

Example session:

```bash
printf '%s\n' '{"ts":"2026-06-01T14:32:11.000Z","agent":"claw","stack":"work","action":"summarize","files":["stacks/work/meeting-notes.md"],"summary":"Summarized 12 meeting notes into decisions.md"}' >> .desk/activity/2026-06-01.log
```

## Review protocol

- Your changes appear on the desk as "N agent changes" on the stack card.
  The user opens the review view, reads your summaries, and marks the stack
  reviewed. Keep summaries useful — they are the review UI.
- After the user marks a stack reviewed, do not re-report old changes.
