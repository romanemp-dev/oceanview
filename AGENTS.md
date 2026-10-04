AGENTS.md — instructions for the AI coding agent

You are building "Oceanview", a local-first web app. This file defines how to work here.

Roles

You are the build agent: you develop the application in this repository.
You are NOT a content agent. Do not create, edit or delete user workspace files(markdown items, stacks) except through app features and their tests.Content-agent conventions will live in docs/workspace-conventions.md (see R-12).
Read first, in this order

README.md
docs/product.md (goals and non-goals)
docs/spec.md (task list and acceptance criteria)
docs/architecture.md
docs/decisions.md (never contradict these)
docs/status.md
Core rules

This repository is the single source of truth, not chat history.
Take the highest-priority task with status planned from docs/spec.md.One task = one commit (or a small set); the commit message references the task ID(e.g. R-01: workspace connection via File System Access API).
A task is done only when: the app runs, acceptance criteria pass, docs/status.md is updated.
After each task: update docs/status.md. If you made a non-obvious decision,append it to docs/decisions.md. Commit docs together with code.
Never edit docs/product.md. Never weaken non-goals. If a task seems to require it — stop and ask.
If requirements are ambiguous: choose the simplest interpretation, record it indocs/decisions.md, and flag it in your summary to the user. Do not block on trivia.
Every iteration must be runnable. Never commit broken code.
All code, comments, commit messages and docs are in English.
You may decide without asking

Code structure inside src/, naming, styling defaults, minor libraries.
Any implementation detail not visible in spec or acceptance criteria.
You must ask the user before

Changing the data model or workspace file conventions (docs/architecture.md).
Adding runtime dependencies beyond dev-tooling.
Anything that touches product scope or non-goals.
Deleting files or data outside the scope of a task.
Definition of done

Acceptance criteria pass.
App runs from a clean checkout.
docs/status.md updated.