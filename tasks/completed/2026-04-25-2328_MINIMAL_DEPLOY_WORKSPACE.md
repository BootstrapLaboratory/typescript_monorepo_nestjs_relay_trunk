# Minimal Deploy Workspace

## Context

The current Dagger release workflow is green, but server deploy is slower than
expected. The green CI log showed the server deploy wave spending about 42s on
mounting/copying `/workspace` into the deploy executor before the deploy script
started.

The current deploy executor code mounts the whole prepared repo into each target
executor:

- [execute-target.ts](../dagger/src/stages/deploy/execute-target.ts)

For the server target, this is likely more workspace than the deploy script
needs. The server deploy path appears to need only the pruned deploy artifact,
the Cloud Run deploy script, its helper script, the smoke test script, Docker
access, Google credentials, and a way to update the deploy tag.

## Goal

Reduce deploy executor workspace transfer time by replacing whole-repo runtime
mounts with a minimal per-target deploy workspace.

## Non-Goals

- Do not change the successful release workflow semantics.
- Do not remove the Dagger-owned source acquisition model.
- Do not make the Dagger framework hardcode Belt-specific deploy paths in TypeScript.
- Do not optimize the Rush build/package stages in this task.

## Initial Findings

- The slow server deploy handoff is likely caused by `.withDirectory("/workspace", repo)`.
- `deploy/cloudrun/scripts/deploy-server.sh` currently assumes it can `cd "${REPO_ROOT}"`.
- The server deploy script currently references `apps/server/Dockerfile` from repo root while using the pruned artifact as Docker build context.
- The smoke test is called from `deploy/cloudrun/tests/validate-post-deploy-smoke.sh`.
- Deploy tag updates currently run in the same target command after the deploy script.

## Design Direction

Prefer a generic metadata-driven runtime workspace plan:

- Target metadata declares what files/directories are needed at runtime.
- Artifact paths are explicit runtime workspace directories for now.
- The deploy executor receives only declared runtime files/directories instead of the whole repo.
- Deploy tag updates run through a framework-owned GitHub ref update, not
  through target runtime shell commands or `.git` workspace mounts.

## Selected Metadata Shape

Use `runtime.workspace.mode: full` only when a target explicitly needs the whole
workspace. If `mode` is omitted, the executor builds a small synthetic
`/workspace` from optional `dirs` and `files`.

Server target:

```yaml
runtime:
  workspace:
    dirs:
      - common/deploy/server
      - deploy/cloudrun/scripts
      - deploy/cloudrun/tests
    files:
      - apps/server/Dockerfile
```

Webapp target:

```yaml
runtime:
  workspace:
    dirs:
      - apps/webapp/dist
      - deploy/cloudflare-pages/scripts
```

Full-workspace fallback:

```yaml
runtime:
  workspace:
    mode: full
```

Rules:

- Omitted `runtime.workspace` means an empty synthetic workspace unless the
  target metadata declares `dirs` or `files`.
- Omitted `runtime.workspace.mode` means use `dirs` and `files`.
- `mode: full` ignores `dirs` and `files` and preserves the current whole-repo
  behavior.
- There is no `mode: minimal`; minimal behavior is the default shape when
  `mode` is omitted.
- Metadata validation checks workspace paths for safe repository-relative
  syntax, but does not require those paths to exist in a clean checkout because
  some workspace dirs are generated package artifacts.

## Open Decisions

- Decide whether deploy scripts should be made artifact-root friendly instead of repo-root friendly.
- Decide how much of this belongs in generic Dagger framework metadata versus target-specific YAML.

## Checklist

- [x] Identify the likely Dagger-specific server deploy regression from CI logs.
- [x] Confirm the current deploy executor mounts the full workspace.
- [x] Inspect the server deploy script for workspace assumptions.
- [x] Audit `deploy-server.sh` dependencies and classify each as artifact, support file, credential, socket, or Git operation.
- [x] Audit `deploy-webapp.sh` dependencies for the same minimal-workspace model.
- [x] Propose the target metadata shape for runtime workspace includes.
- [x] Decide how the full-workspace fallback is represented.
- [x] Decide how deploy tag updates should run without requiring a full workspace in every target executor.
- [x] Decide whether server Docker build should use `-f "${ARTIFACT_PATH}/apps/server/Dockerfile"` or receive a separate Dockerfile mount.
- [x] Add tests for runtime workspace planning.
- [x] Implement minimal workspace construction for deploy executors.
- [x] Run Dagger unit/type tests.
- [x] Validate in real GitHub CI and record before/after server deploy timings.

Real production deploy validation completed on 2026-04-26. The workflow is
green, the application is running correctly on production, and the full deploy
job is about 4 minutes. Server Docker context transfer dropped from about 172 MB
to about 141 MB after enabling Rush deploy's `omitPnpmWorkaroundLinks` option.
