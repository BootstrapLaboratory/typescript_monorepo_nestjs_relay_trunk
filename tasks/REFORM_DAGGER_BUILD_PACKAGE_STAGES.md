# Dagger Build And Package Stage Reform Plan

## Goal

Split the CI/release framework into clearer Dagger-owned stages:

- `detect`: compute canonical scope
- `build`: run universal project validation and build work
- `package`: materialize artifacts from built outputs
- `deploy`: consume deploy artifacts and talk to providers
- future `release`: publish libraries or packages to registries

The main design goal is to keep stage metadata in the stage that owns it. Deploy
metadata should not describe package artifacts, and package metadata should not
describe provider runtime details.

Another important goal is to avoid hook-shaped configuration when a normal Rush
command can express the work. Projects should opt into build verification with
ordinary package scripts, and the framework should run descriptive stages.

This plan builds on [REFORM_CI_STAGE_HANDOFF.md](./REFORM_CI_STAGE_HANDOFF.md)
and [REFORM_RUSH_PLAN_TARGET_MAPPING.md](./REFORM_RUSH_PLAN_TARGET_MAPPING.md).

## Problem

The current GitHub `package` job still has target-specific knowledge:

- `server` requires a GraphQL contract check
- `server` requires `rush deploy` to create a pruned runtime bundle
- `server` uploads a `tgz` archive
- `webapp` uploads `apps/webapp/dist`

That keeps working, but it does not match the reusable Dagger framework shape
we want. The workflow knows too much about concrete targets.

The first attempted metadata shape put package information inside
`.dagger/deploy/targets/<target>.yaml`. That exposed two design issues:

- `artifact_path` and `package.artifact.source` partially duplicate each other
- deploy metadata becomes a mixed deploy/package configuration file

The better shape is to make package output a handoff contract from `package` to
`deploy`, instead of storing package artifact paths in deploy metadata.

## Stage Boundaries

### Detect

`detect` owns scope selection.

It writes [../.dagger/runtime/ci-plan.json](../.dagger/runtime/ci-plan.json),
including:

- `mode`
- `pr_base_sha`
- `validate_targets`
- `deploy_targets`
- future release-oriented scopes when npm/package publishing is introduced

### Build

`build` owns universal project work:

- lint selected Rush projects
- test selected Rush projects
- build selected Rush projects
- run project-owned verification that must pass before artifacts are produced

The build stage should be target-agnostic. It should receive a list of Rush
projects and run generic Rush commands against them.

For deploy packaging, the initial build scope is `deploy_targets`.
For PR validation, the initial build scope is `validate_targets`.
For future package publishing, another build invocation can use a separate
release scope.

### Package

`package` owns artifact materialization.

It should read:

- [../.dagger/runtime/ci-plan.json](../.dagger/runtime/ci-plan.json)
- `.dagger/package/targets/<target>.yaml`

It should write:

- [../.dagger/runtime/package-manifest.json](../.dagger/runtime/package-manifest.json)

Package examples:

- backend: run `rush deploy` to create a pruned deploy bundle, then archive it
- webapp: expose the already-built `dist` directory as the deploy artifact

### Deploy

`deploy` owns provider work.

It should read:

- [../.dagger/runtime/ci-plan.json](../.dagger/runtime/ci-plan.json)
- [../.dagger/runtime/package-manifest.json](../.dagger/runtime/package-manifest.json)
- `.dagger/deploy/targets/<target>.yaml`

It should not need to know how package artifacts were produced.

### Future Release

Future `release` should publish built library/package artifacts to registries,
for example npm. It should be separate from deploy because not every Rush
project is deployable, and not every release target is a service.

## Metadata Layout

Recommended repository-owned metadata:

```text
.dagger/
  package/
    targets/
      server.yaml
      webapp.yaml
  deploy/
    services-mesh.yaml
    targets/
      server.yaml
      webapp.yaml
```

`deploy` metadata remains provider/runtime oriented:

```yaml
name: server
deploy_script: scripts/ci/deploy-server.sh

runtime:
  image: node:24-bookworm-slim
```

`package` metadata owns artifact materialization:

```yaml
name: server
artifact:
  kind: rush_deploy_archive
  project: server
  scenario: server
  output: common/deploy/server
```

```yaml
name: webapp
artifact:
  kind: directory
  path: apps/webapp/dist
```

The package stage should derive CI artifact names from the existing convention:

```text
${DEPLOY_ARTIFACT_PREFIX}-${target}
```

## Package Manifest

The package stage should produce a manifest like:

```json
{
  "artifacts": {
    "server": {
      "kind": "archive",
      "path": "deploy-target-server.tgz",
      "deploy_path": "common/deploy/server"
    },
    "webapp": {
      "kind": "directory",
      "path": "apps/webapp/dist",
      "deploy_path": "apps/webapp/dist"
    }
  }
}
```

The manifest becomes the stage handoff from `package` to `deploy`.

This removes the need for deploy metadata to carry package artifact paths. It
also allows a future package stage to change how artifacts are created without
rewiring deploy runtime metadata.

No `.dagger/build` metadata is planned for the first pass. Build should stay a
normal Rush stage unless we later find a case that cannot be represented as a
project script.

## Build Verification Decision

The GraphQL contract check should move out of package-specific workflow logic.

Use a generic Rush `verify` bulk command and let projects opt in through
`npm run verify --if-present`.

This keeps project checks close to each project and preserves the universal
build-stage shape:

```text
rush verify
rush lint
rush test
rush build
```

Then `server` can own the GraphQL contract check through a project script, and
the build stage can stay free of target-specific conditionals.

Projects without a `verify` script should be skipped naturally by Rush/npm.
That makes the framework hook-free for build verification and keeps Dagger
metadata focused on stage inputs and artifact contracts.

## Logical Stage First, Physical Job Later

The first implementation should separate stages logically inside Dagger before
splitting every stage into separate GitHub jobs.

Reason: a separate GitHub `build` job would need to preserve build outputs for
the `package` job. That is possible, but it adds artifact/cache handoff
complexity. Dagger can call `build -> package -> deploy` internally with a
cleaner data flow first.

Recommended migration order:

1. make the stage boundaries explicit in metadata and Dagger code
2. keep GitHub job boundaries close to the current working shape
3. only split `build` and `package` into separate CI jobs if the benefits
   outweigh the handoff cost

## Refactor Phases

## Phase 0: Lock The New Shape

- [x] Reject storing package artifact metadata in `.dagger/deploy`.
- [x] Define deploy metadata as provider/runtime metadata only.
- [x] Define package metadata as artifact materialization metadata.
- [x] Define `package-manifest.json` as the package-to-deploy handoff.
- [x] Record that physical GitHub job splitting is optional and later.

## Phase 1: Build Stage Design

- [x] Decide to implement project verification with a normal Rush `verify`
      command instead of `.dagger/build` hooks.
- [x] Add a Rush `verify` bulk command that runs
      `npm run verify --if-present`.
- [x] Move the GraphQL contract check into the server project's `verify`
      script.
- [x] Keep Rush lint/test/build generic over selected project lists.
- [x] Keep PR validation and deploy build scopes separate but reusable.
- [x] Verify the Rush `verify` slice in real GitHub CI.

## Phase 2: Package Metadata

- [x] Create `.dagger/package/targets/server.yaml`.
- [x] Create `.dagger/package/targets/webapp.yaml`.
- [x] Add parser and tests for package target metadata.
- [x] Validate that package target names match known deploy targets for deploy
      packaging.
- [x] Keep package metadata out of `.dagger/deploy/targets`.

## Phase 2.5: Generic CI Package Bridge

- [x] Rename the current deploy-target build task to
      `ci-build-deploy-targets`.
- [x] Add `ci-package-deploy-targets` as a generic package materializer backed
      by `.dagger/package/targets`.
- [x] Materialize `rush_deploy_archive` artifacts from package metadata.
- [x] Validate `directory` artifacts from package metadata.
- [x] Replace server-specific bundle/archive steps in the GitHub package job.
- [x] Keep GitHub upload steps as the provider-specific adapter for now.

## Phase 3: Package Manifest

- [x] Define the exact `package-manifest.json` schema.
- [x] Add writer and reader tests for `package-manifest.json`.
- [x] Make package artifact paths relative to the repository or runtime
      workspace, not hidden in deploy metadata.
- [x] Ensure manifest entries preserve current artifact naming.
- [x] Write `.dagger/runtime/package-manifest.json` from the package stage.
- [x] Upload and download `package-manifest.json` as a GitHub artifact so the
      deploy job has the package-to-deploy handoff available.

## Phase 4: Dagger Build And Package Entry Points

- [x] Add a Dagger build entrypoint that reads `ci-plan.json`.
- [x] Keep build separate from package so it only runs Rush
      verify/lint/test/build for selected deploy targets.
- [x] Add a Dagger package entrypoint that reads `ci-plan.json`.
- [x] Materialize `rush_deploy_archive` artifacts from package metadata.
- [x] Materialize `directory` artifacts from package metadata.
- [x] Write `package-manifest.json`.
- [x] Keep current GitHub artifact upload behavior working during migration by
      leaving the GitHub package job on the proven Make/script bridge for this
      slice.
- [x] Make the Dagger package entrypoint return a workspace directory so CI can
      explicitly export artifacts during the later cutover.
- [x] Add a composed Dagger wrapper that runs build and package as separate
      stages but exports the final packaged workspace once.
- [x] Switch the GitHub package job to the Dagger build/package entrypoints.

## Phase 5: Deploy Consumes Package Manifest

- [x] Update deploy to read `package-manifest.json`.
- [x] Remove deploy dependency on static package artifact paths.
- [x] Keep deploy target YAML focused on scripts, runtime env, mounts, and
      provider toolchains.
- [x] Preserve successful Cloud Run and Cloudflare deploy behavior.

## Phase 6: Future Release Stage Preparation

- [ ] Reserve release-oriented naming for package/library publishing.
- [ ] Keep `deploy_targets` distinct from future `release_targets`.
- [ ] Design future npm publishing metadata separately from deploy metadata.
- [ ] Allow build to run for deploy scopes and release scopes independently.

## Stop Point

- GitHub no longer contains target-specific package conditionals.
- Dagger owns the logical `build -> package -> deploy` sequence.
- Package artifacts are described by `.dagger/package` metadata.
- Deploy consumes `package-manifest.json` and deploy metadata only.
- The design can later support npm/package publishing without overloading
  deploy concepts.
