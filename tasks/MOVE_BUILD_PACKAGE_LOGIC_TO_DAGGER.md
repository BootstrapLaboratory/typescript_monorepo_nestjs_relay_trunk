# Move Build And Package Logic Into Dagger

## Goal

Move the remaining deploy-target build/package implementation out of
shell/Node CI helper scripts and into testable TypeScript under
[../dagger/src](../dagger/src).

The CI shell should stay thin:

- call Dagger entrypoints
- export Dagger outputs for CI-provider artifact upload
- keep provider-specific credential and artifact upload behavior outside the
  reusable Dagger framework

## Current State

GitHub already calls Dagger for deploy-target build/package:

- `build-and-package-deploy-targets`
- `build-deploy-targets`
- `package-deploy-targets`

The package Dagger function still wraps existing CI helper scripts:

- [../scripts/ci/package-deploy-targets.mjs](../scripts/ci/package-deploy-targets.mjs)
- [../scripts/ci/package-manifest.mjs](../scripts/ci/package-manifest.mjs)

The next cleanup should move the logic behind those scripts into the Dagger
module itself, where TypeScript parsing/planning can be tested with the Dagger
test suite.

## Principles

- Keep `build` and `package` as separate Dagger stages.
- Prefer TypeScript helpers with focused tests over shell glue.
- Keep target-specific package behavior in repository metadata under
  [../.dagger/package/targets](../.dagger/package/targets).
- Keep GitHub artifact upload in GitHub Actions for now.
- Do not move deploy runtime scripts in this task; deploy scripts are still the
  portable target runtime contract.

## Phase 1: Move Build Stage Logic

- [x] Port deploy target JSON parsing from the former build shell wrapper into
      Dagger TypeScript.
- [x] Generate Rush `--to <target>` arguments from `ci-plan.json` inside
      [../dagger/src/build-stage](../dagger/src/build-stage).
- [x] Run Rush `verify`, `lint`, `test`, and `build` directly from Dagger
      TypeScript.
- [x] Delete the obsolete build shell wrapper.
- [x] Add or update Dagger tests for build command planning.
- [ ] Verify the Dagger-backed package job in real CI after the shell wrapper is
      removed.

## Phase 2: Move Package Planning Logic

- [ ] Move package target action planning from
      [../scripts/ci/package-deploy-targets.mjs](../scripts/ci/package-deploy-targets.mjs)
      into Dagger TypeScript.
- [ ] Reuse existing Dagger package target YAML parser from
      [../dagger/src/package-stage](../dagger/src/package-stage).
- [ ] Generate package commands for `rush_deploy_archive` artifacts in Dagger
      TypeScript.
- [ ] Validate `directory` artifacts in Dagger TypeScript.
- [ ] Add focused Dagger tests for package command planning and validation.

## Phase 3: Move Package Manifest Logic

- [ ] Move package manifest schema/type handling from
      [../scripts/ci/package-manifest.mjs](../scripts/ci/package-manifest.mjs)
      into Dagger TypeScript.
- [ ] Keep manifest schema compatible with the deployed contract:
      `artifacts.<target>.kind`, `path`, and `deploy_path`.
- [ ] Write `.dagger/runtime/package-manifest.json` from Dagger TypeScript.
- [ ] Keep deploy consuming the same package manifest shape.
- [ ] Add Dagger tests for manifest writing/planning.

## Phase 4: Remove Obsolete Package Scripts

- [ ] Delete [../scripts/ci/package-deploy-targets.mjs](../scripts/ci/package-deploy-targets.mjs)
      after Dagger TypeScript owns package materialization.
- [ ] Delete [../scripts/ci/package-deploy-targets.test.mjs](../scripts/ci/package-deploy-targets.test.mjs)
      after equivalent Dagger tests exist.
- [ ] Delete [../scripts/ci/package-manifest.mjs](../scripts/ci/package-manifest.mjs)
      after equivalent Dagger code owns manifest writing.
- [ ] Delete [../scripts/ci/package-manifest.test.mjs](../scripts/ci/package-manifest.test.mjs)
      after equivalent Dagger tests exist.
- [ ] Update docs to remove references to the old package helper scripts.

## Phase 5: Real CI Validation

- [ ] Run forced `webapp` release.
- [ ] Run forced `server` release.
- [ ] Run a normal `main` release path when both deploy targets are selected.

## Stop Point

- GitHub calls Dagger for deploy-target build/package.
- Dagger TypeScript owns deploy-target build and package materialization logic.
- Package artifact upload remains a CI-provider adapter.
- The only remaining portable runtime scripts are deploy target scripts such as
  [../scripts/ci/deploy-server.sh](../scripts/ci/deploy-server.sh) and
  [../scripts/ci/deploy-webapp.sh](../scripts/ci/deploy-webapp.sh).
