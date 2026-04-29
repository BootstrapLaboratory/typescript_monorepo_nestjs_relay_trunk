# Project AI Conventions

- Read `docs/ai/architecture.md` before making code or architecture
  changes in this repository.
- If repository-level architecture changes, update
  `docs/ai/architecture.md` in the same task.
- Keep architecture documents self-contained. Do not add markdown links from
  architecture documents to other documentation files.
- When AI conventions point to architecture documents, use plain inline
  repo-root-relative paths like `apps/server/docs/ai/architecture.md`; do not
  use markdown links or relative paths such as `./architecture.md`.
- Do not load scoped project documents unless the task touches that project or
  boundary.
