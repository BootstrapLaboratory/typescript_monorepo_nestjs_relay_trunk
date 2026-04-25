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
  [../../apps/server/package.json](../../apps/server/package.json).

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
- loading repository-owned validation metadata from `.dagger/validate`
- running target validation scenarios declared by metadata
- reporting a clear no-op when no validation targets are selected

## Framework Contract

The reusable Dagger project may assume the repository is a Rush monorepo. It
should not assume this repository's package names, service names, providers,
databases, queues, GraphQL shape, or runtime topology.

Framework-owned behavior:

- compute affected Rush projects
- run standard Rush commands for selected projects
- load metadata from well-known `.dagger/*` directories
- execute generic metadata shapes
- provide shared container/cache helpers

Repository-owned behavior:

- package scripts such as `verify`, `lint`, `test`, and `build`
- validation scenario metadata under `.dagger/validate`
- provider-specific deployment metadata under `.dagger/deploy`
- target-specific commands, environment variables, services, and smoke checks

This keeps Dagger usable as a framework: adding a project or service should
primarily mean adding Rush/package metadata and optional `.dagger/*` metadata,
not editing Dagger TypeScript branches for that project.

## Proposed Dagger API

Add a public Dagger entrypoint:

```text
validate
```

Suggested arguments:

- `repo: Directory`
- `eventName: string = "pull_request"`
- `prBaseSha: string = ""`
- `validateTargetsJson: string = "[]"`

The return value can be a JSON summary, similar to the release path results.

`validateTargetsJson` is an explicit manual/debug override. It contains Rush
project names, not deploy target names. The GitHub pull-request workflow should
not pass it; normal PR validation should compute `validate_targets` from Rush
and `prBaseSha`.

## Rush Validation Plan

Refactor the current Rush build planner so it can build steps from an explicit
target list:

- `verify`
- `lint`
- `test`
- `build`

Validation should use `ciPlan.validate_targets`.

Release build/package should continue using `ciPlan.deploy_targets`.

## Validation Target Metadata

Project-specific validation must be metadata-driven. Dagger should not hardcode
`server`, PostgreSQL, Redis, GraphQL, or any project-specific scripts.

Proposed metadata location:

```text
.dagger/validate/targets/<rush-project-name>.yaml
```

Example shape for the current server package:

```yaml
name: server

services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_DB: chatdb
      POSTGRES_USER: chatuser
      POSTGRES_PASSWORD: chatpass
    ports:
      - 5432

  redis:
    image: redis:7-alpine
    ports:
      - 6379

steps:
  - name: migrations
    command: npm
    args: ["--prefix", "apps/server", "run", "ci:migration:run"]
    env:
      DATABASE_HOST: postgres
      DATABASE_PORT: "5432"
      DATABASE_NAME: chatdb
      DATABASE_USER: chatuser
      DATABASE_PASSWORD: chatpass

  - name: server
    service:
      command: npm
      args: ["--prefix", "apps/server", "run", "start:prod"]
      ports:
        - 3100
      env:
        NODE_ENV: production
        HOST: 0.0.0.0
        PORT: "3100"
        GRAPHQL_PATH: /graphql
        DATABASE_HOST: postgres
        DATABASE_PORT: "5432"
        DATABASE_NAME: chatdb
        DATABASE_USER: chatuser
        DATABASE_PASSWORD: chatpass
        DATABASE_SSL: "false"
        DATABASE_SYNCHRONIZE: "false"
        PUBSUB_DRIVER: redis
        REDIS_URL: redis://redis:6379

  - name: smoke
    command: bash
    args: ["deploy/cloudrun/tests/validate-post-deploy-smoke.sh"]
    env:
      SERVICE_URL: http://127.0.0.1:3100
```

Dagger's job is to parse this generic shape and execute:

- named service containers
- command steps
- foreground service steps that later command steps can consume
- per-step env
- service bindings by metadata name

If a Rush project has no `.dagger/validate/targets/<name>.yaml`, Rush
`verify/lint/test/build` is still sufficient for that project.

## GitHub Wiring

Update GitHub Actions so pull requests call Dagger validation.

Decision:

- add a separate `.github/workflows/ci-validate.yaml`
- trigger it on `pull_request`
- call `dagger call validate`
- use `pull_request`, not `pull_request_target`
- use minimal permissions, starting with `contents: read`
- avoid deploy credentials, deploy env files, Google auth, Cloudflare secrets,
  and Docker socket setup

The separate workflow keeps release and validation credential boundaries clear.
`ci-release.yaml` remains focused on push/manual release execution.

## Resolved Decisions

- PR validation lives in `.github/workflows/ci-validate.yaml`, not inside
  `.github/workflows/ci-release.yaml`.
- PR validation uses `pull_request`, not `pull_request_target`, to avoid
  exposing privileged release credentials to untrusted pull-request code.
- Validation does not use deploy credentials or provider secrets.
- Validation uses `validate_targets`, not `deploy_targets`.
- `validateTargetsJson` is supported only as a manual/debug override and should
  be documented as Rush project names.
- Project-specific validation scenarios live under `.dagger/validate`, not in
  Dagger TypeScript.
- Project-specific validation behavior should be expressed through package
  scripts and metadata, not hardcoded Dagger branches.
- The `validate` entrypoint returns a concise JSON summary with `status`,
  `mode`, `pr_base_sha`, `validate_targets`, and `rush_commands`.
- Shared Rush container/cache helpers live under `dagger/src/rush`.
- Validation target metadata uses `.dagger/validate/targets/<rush-project-name>.yaml`
  with backing `services` and ordered `steps`.
- Validation steps currently support two generic kinds: command steps and
  foreground service steps.
- Dagger executes validation metadata generically. It does not know about
  `server`, PostgreSQL, Redis, or GraphQL.
- A target validation scenario runs when its Rush project name is present in
  `validate_targets`.
- Do not add a second runtime-only heuristic yet; Rush owns affected-scope
  selection.
- Backing services declared under `services` use Dagger service bindings by
  metadata name.
- Foreground service steps run as local background processes inside later
  command-step containers. Those command steps should reach foreground services
  through `127.0.0.1:<port>`. This keeps long-running foreground services out of
  Dagger `Container.sync()` graphs while still preserving generic metadata
  execution.
- `ci-validate.yaml` is fully automatic and only runs for pull requests.
  Manual validation stays a local Dagger command.

## Phase 1: Planning And Rush Scope

- [x] Add focused tests for building Rush validation steps from
      `validate_targets`.
- [x] Refactor Rush step planning so deploy build and PR validation can share
      command construction without mixing scopes.
- [x] Ensure empty `validate_targets` returns a no-op validation result.
- [x] Keep deploy build/package behavior unchanged for `deploy_targets`.

## Phase 2: Dagger Validate Entrypoint

- [x] Add `validate` to [../../dagger/src/index.ts](../../dagger/src/index.ts).
- [x] Reuse existing CI plan detection instead of recomputing target logic in a
      new path.
- [x] Run Rush `verify`, `lint`, `test`, and `build` for
      `validate_targets`.
- [x] Return a concise JSON validation summary.
- [x] Add Dagger unit tests for selected targets, no-op behavior, and malformed
      inputs.

## Phase 3: Validation Metadata

- [x] Add `.dagger/validate/targets` metadata directory.
- [x] Define validation target YAML schema.
- [x] Add parser and validation tests for services, command steps, service
      steps, env, args, and ports.
- [x] Add repository metadata tests for every committed validation target.
- [x] Add server validation metadata as the first real target.
- [x] Keep server-specific commands and behavior in package/provider scripts or
      metadata, not in Dagger TypeScript.

## Phase 4: Generic Validation Runner

- [x] Create a Dagger validation runner that executes validation target
      metadata generically.
- [x] Support service containers declared by metadata.
- [x] Support command steps declared by metadata.
- [x] Support foreground service steps declared by metadata.
- [x] Bind backing metadata services into later steps by service name.
- [x] Run foreground service steps as local background processes that later
      command steps can validate through localhost.
- [x] Ensure logs are visible when a metadata-driven validation step fails.
- [x] Skip metadata validation for projects without matching metadata files.

## Phase 5: GitHub PR Workflow

- [x] Decide whether validation lives in a separate workflow or inside
      `ci-release.yaml`.
- [x] Add `.github/workflows/ci-validate.yaml`.
- [x] Keep provider deploy credentials out of PR validation.
- [x] Keep workflow permissions minimal.
- [x] Document the PR validation entrypoint in
      [../../docs/notes/ReleaseFlow.md](../../docs/notes/ReleaseFlow.md).

## Phase 6: Validation

- [x] Run Dagger unit tests.
- [x] Run Dagger TypeScript typecheck.
- [x] Run the Dagger validation entrypoint locally in a no-op case.
- [x] Run the Dagger validation entrypoint locally for a forced server target,
      if feasible.
- [x] Run a real GitHub pull-request validation.
- [x] Confirm release workflows still stay green after validation wiring.

## Remaining Open Questions

- None.
