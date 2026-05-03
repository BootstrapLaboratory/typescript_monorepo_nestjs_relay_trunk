# Project AI Conventions

- Read `.ai/architecture.md` before making code or architecture
  changes in this repository.
- If repository-level architecture changes, update
  `.ai/architecture.md` in the same task.
- Keep architecture documents self-contained. Do not add markdown links from
  architecture documents to other documentation files.
- Keep scoped AI documents self-contained within their own boundary. Do not add
  markdown links from scoped AI documents to parent or sibling AI documents;
  loading order belongs in `AGENTS.md` or in an explicit top-level router
  document such as `.ai/deployment.md`.
- When editing AI documents, keep statements you add or change aligned with the
  implementation, scripts, config, workflows, and metadata in the current
  checkout after the current task's intended changes. Prefer source files over
  older documentation when resolving conflicts. Do not broaden the task to fix
  unrelated documentation drift; if unrelated drift is noticed, mention it
  separately.
- When AI conventions point to architecture documents, use plain inline
  repo-root-relative paths like `apps/server/docs/ai/architecture.md`; do not
  use markdown links or relative paths such as `./architecture.md`.
- Do not load scoped project documents unless the task touches that project or
  boundary.
