# Add AI Architecture Docs

## Goal

Make the repository easier for AI agents to navigate by adding concise,
layered architecture documents.

## Scope

- Add a top-level `docs/ai/project-architecture.md`.
- Add scoped architecture docs for Rush projects under `apps` and `libs`.
- Update `AGENTS.md` so agents always load the top-level architecture doc and
  only load scoped docs when touching their areas.

## Checklist

- [x] Inventory Rush projects, package scripts, CI metadata, and existing docs.
- [x] Create concise top-level project architecture guidance.
- [x] Create scoped architecture guidance for `apps/server`.
- [x] Create scoped architecture guidance for `apps/webapp`.
- [x] Create scoped architecture guidance for `libs/api`.
- [x] Update `AGENTS.md` loading rules.
- [x] Run documentation and metadata validation checks.
