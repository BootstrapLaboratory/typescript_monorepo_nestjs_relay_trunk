# Add Dagger Documentation

## Context

The Dagger module has become the main release framework for this repository:
source acquisition, detection, validation, build, packaging, deployment,
toolchain images, and Rush install cache are now mostly owned by Dagger.

The project needs documentation that explains how to use the framework without
forcing readers through implementation details. The root Dagger README should
stay short and point to structured documents under `dagger/docs/`.

## Goal

Create concise, API-oriented Dagger documentation with a separate AI-facing
architecture section.

The docs should explain what the framework does, how callers interact with it,
which metadata files are part of the public contract, and how to reason about
the architecture at a high level.

## Proposed Layout

```text
dagger/
  README.md
  docs/
    README.md
    api.md
    metadata.md
    providers.md
    workflows.md
    ai/
      architecture.md
      conventions.md
```

## Documentation Principles

- Keep `dagger/README.md` very short: purpose, quick local commands, and links.
- Treat `dagger/docs/*` as user-facing API documentation, not source-code
  walkthroughs.
- Keep implementation details out unless they are necessary to understand a
  public contract or operational behavior.
- Use relative links between documentation files.
- Prefer current architecture only; do not document old GitHub-only CI flows.
- Make the `ai` directory useful for future coding agents: high-level
  architecture, boundaries, invariants, and naming conventions.

## Checklist

### Phase 1: Structure

- [x] Create `dagger/README.md` with a short overview and links into
      `dagger/docs/`.
- [x] Create `dagger/docs/README.md` as the documentation index.
- [x] Create `dagger/docs/ai/` for AI-facing architecture notes.

### Phase 2: API Documentation

- [x] Document public Dagger entrypoints and their intended use.
- [x] Document common local commands, including provider-off dry-runs and
      `self-check`.
- [x] Document workflow inputs at the contract level: source mode, deploy
      environment file, toolchain image provider, Rush cache provider, dry-run,
      and Docker socket behavior.
- [x] Document expected CI-provider responsibilities at a high level: provide
      source coordinates, credentials, deploy env file, and optional socket.

### Phase 3: Metadata Documentation

- [x] Document deploy target metadata under `.dagger/deploy/targets/`.
- [x] Document service mesh metadata under `.dagger/deploy/services-mesh.yaml`.
- [x] Document toolchain image provider metadata under
      `.dagger/toolchain-images/providers.yaml`.
- [x] Document Rush cache provider metadata under
      `.dagger/rush-cache/providers.yaml`.
- [x] Link schema files as the source of truth for exact field validation.

### Phase 4: AI Architecture Documentation

- [x] Document the high-level architecture in `dagger/docs/ai/architecture.md`.
- [x] Explain stage boundaries: source acquisition, detect, validate, build,
      package, deploy, and workflow orchestration.
- [x] Explain framework boundaries: Rush is the project model, metadata is the
      extension point, provider adapters are optional.
- [x] Explain important invariants: provider-off works locally, GitHub is an
      adapter not a framework dependency, deploy targets are metadata-driven,
      and completed task files are archived.
- [x] Add AI conventions for future contributors in
      `dagger/docs/ai/conventions.md`.

### Phase 5: Validation

- [x] Run documentation link/path sanity checks manually or with existing repo
      tooling.
- [x] Run `dagger call self-check --repo=..`.
- [x] Confirm documentation does not duplicate implementation details that can
      drift from source.

## Non-Goals

- Do not document historical GitHub Actions implementations.
- Do not write a line-by-line source walkthrough.
- Do not expose private project secrets, production-only values, or provider
  credentials in examples.
- Do not move the Dagger module into a separate repository in this task.
