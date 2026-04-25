# Add Dagger Validate Workflow

## Goal

Add a Dagger-owned pull-request validation workflow that replaces the old
GitHub split-job validation shape without bringing back GitHub artifact
handoffs, root `scripts/ci`, or the removed Makefile layer.

The target shape is:

```text
detect -> validate
```

Release remains:

```text
detect -> build -> package -> deploy
```

## Current State

- The supported release path is the composed Dagger `workflow` entrypoint.
- `.github/workflows/ci-release.yaml` currently runs on `push` and
  `workflow_call`.
- Pull-request validation is not wired into the composed Dagger workflow yet.
- Dagger already computes `validate_targets` in the canonical CI plan.
- Rush build planning currently targets deploy targets, so validation needs a
  reusable Rush command planner that can run against `validate_targets`.
- Server-specific validation scripts now live as package scripts in
  [../apps/server/package.json](../apps/server/package.json).

## Boundary

GitHub should stay a thin bootstrap adapter:

- checkout
- tag fetch when needed
- Dagger CLI installation
- one Dagger call

Dagger should own portable validation behavior:

- computing the CI plan
- reading `validate_targets`
- running Rush `verify`, `lint`, `test`, and `build`
- running server integration validation when `server` is in `validate_targets`
- reporting a clear no-op when no validation targets are selected

## Proposed Dagger API

Add a public Dagger entrypoint:

```text
validate
```

Suggested arguments:

- `repo: Directory`
- `eventName: string = "pull_request"`
- `prBaseSha: string = ""`
- `forceTargetsJson: string = "[]"`
- `deployTagPrefix: string = "deploy/prod"`

The return value can be a JSON summary, similar to the release path results.

## Rush Validation Plan

Refactor the current Rush build planner so it can build steps from an explicit
target list:

- `verify`
- `lint`
- `test`
- `build`

Validation should use `ciPlan.validate_targets`.

Release build/package should continue using `ciPlan.deploy_targets`.

## Server Integration Validation

When `server` is in `validate_targets`, Dagger should run the server's
production-like validation using Dagger services instead of GitHub services.

Target behavior to preserve:

- PostgreSQL service
- Redis service
- production-like migrations through `npm --prefix apps/server run
  ci:migration:run`
- production-like server startup through `npm --prefix apps/server run
  ci:start:prod-smoke`
- backend smoke check against the local server using
  [../deploy/cloudrun/tests/validate-post-deploy-smoke.sh](../deploy/cloudrun/tests/validate-post-deploy-smoke.sh)

Preferred implementation direction:

- use Dagger service containers for Postgres and Redis
- bind those services into the validation container
- reuse the same Rush dependency caches used by the composed workflow
- keep server-specific commands in `apps/server/package.json`

## GitHub Wiring

Update GitHub Actions so pull requests call Dagger validation.

Preferred shape:

- keep release execution on `push` and `workflow_call`
- add pull-request execution that calls `dagger call validate`
- avoid deploy credentials and Docker socket setup for PR validation unless the
  validation implementation explicitly needs them

This can be either:

- a separate `.github/workflows/ci-validate.yaml`
- or a pull-request branch inside `.github/workflows/ci-release.yaml`

The separate workflow is probably clearer if release and validation continue to
have different credential needs.

## Phase 1: Planning And Rush Scope

- [ ] Add focused tests for building Rush validation steps from
      `validate_targets`.
- [ ] Refactor Rush step planning so deploy build and PR validation can share
      command construction without mixing scopes.
- [ ] Ensure empty `validate_targets` returns a no-op validation result.
- [ ] Keep deploy build/package behavior unchanged for `deploy_targets`.

## Phase 2: Dagger Validate Entrypoint

- [ ] Add `validate` to [../dagger/src/index.ts](../dagger/src/index.ts).
- [ ] Reuse existing CI plan detection instead of recomputing target logic in a
      new path.
- [ ] Run Rush `verify`, `lint`, `test`, and `build` for
      `validate_targets`.
- [ ] Return a concise JSON validation summary.
- [ ] Add Dagger unit tests for selected targets, no-op behavior, and malformed
      inputs.

## Phase 3: Server Integration Validation

- [ ] Create a Dagger validation runner for server integration checks.
- [ ] Add Postgres service container.
- [ ] Add Redis service container.
- [ ] Wire server env variables for production-like local validation.
- [ ] Run `npm --prefix apps/server run ci:migration:run`.
- [ ] Run `npm --prefix apps/server run ci:start:prod-smoke`.
- [ ] Run the backend smoke test against the Dagger-hosted server endpoint.
- [ ] Ensure logs are visible when server validation fails.

## Phase 4: GitHub PR Workflow

- [ ] Decide whether validation lives in a separate workflow or inside
      `ci-release.yaml`.
- [ ] Add the GitHub pull-request workflow path.
- [ ] Keep provider deploy credentials out of PR validation.
- [ ] Keep workflow permissions minimal.
- [ ] Document the PR validation entrypoint in
      [../docs/notes/ReleaseFlow.md](../docs/notes/ReleaseFlow.md).

## Phase 5: Validation

- [ ] Run Dagger unit tests.
- [ ] Run Dagger TypeScript typecheck.
- [ ] Run the Dagger validation entrypoint locally in a no-op case.
- [ ] Run the Dagger validation entrypoint locally for a forced server target,
      if feasible.
- [ ] Run a real GitHub pull-request validation.
- [ ] Confirm release workflows still stay green after validation wiring.

## Open Decisions

- Whether to expose `validateTargetsJson` directly for manual debugging, or
  only support validation through `eventName`, `prBaseSha`, and
  `forceTargetsJson`.
- Whether PR validation should live in `.github/workflows/ci-release.yaml` or
  a separate `.github/workflows/ci-validate.yaml`.
- Whether server integration validation should be required for every PR that
  affects `server`, or only for changes that affect runtime/server packages.
