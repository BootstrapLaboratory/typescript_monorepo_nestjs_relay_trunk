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
- The package manifest supplies the selected artifact path.
- The deploy executor receives only the artifact and declared runtime support files.
- Deploy tag updates should be considered separately from target runtime execution, so deploy containers do not need a full Git checkout just to push tags.

## Open Decisions

- Decide whether deploy tag updates should move out of target executors into the deploy orchestrator/source container.
- Decide the metadata shape for runtime workspace includes, for example `runtime.workspace.include`.
- Decide whether deploy scripts should be made artifact-root friendly instead of repo-root friendly.
- Decide whether to keep a full-workspace fallback for local/debug usage or remove it immediately.
- Decide how much of this belongs in generic Dagger framework metadata versus target-specific YAML.

## Checklist

- [x] Identify the likely Dagger-specific server deploy regression from CI logs.
- [x] Confirm the current deploy executor mounts the full workspace.
- [x] Inspect the server deploy script for workspace assumptions.
- [ ] Audit `deploy-server.sh` dependencies and classify each as artifact, support file, credential, socket, or Git operation.
- [ ] Audit `deploy-webapp.sh` dependencies for the same minimal-workspace model.
- [ ] Propose the target metadata shape for runtime workspace includes.
- [ ] Decide how deploy tag updates should run without requiring a full workspace in every target executor.
- [ ] Decide whether server Docker build should use `-f "${ARTIFACT_PATH}/apps/server/Dockerfile"` or receive a separate Dockerfile mount.
- [ ] Add tests for runtime workspace planning.
- [ ] Implement minimal workspace construction for deploy executors.
- [ ] Run Dagger unit/type tests.
- [ ] Validate in real GitHub CI and record before/after server deploy timings.
