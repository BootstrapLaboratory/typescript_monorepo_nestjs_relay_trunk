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

Build, package planning, and package manifest writing now run in Dagger
TypeScript, where parsing and planning are covered by the Dagger test suite.

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
- [x] Verify the Dagger-backed package job in real CI after the shell wrapper is
      removed.

## Phase 2: Move Package Planning Logic

- [x] Move package target action planning from the former package helper into
      Dagger TypeScript.
- [x] Reuse existing Dagger package target YAML parser from
      [../dagger/src/package-stage](../dagger/src/package-stage).
- [x] Generate package commands for `rush_deploy_archive` artifacts in Dagger
      TypeScript.
- [x] Validate `directory` artifacts in Dagger TypeScript.
- [x] Add focused Dagger tests for package command planning and validation.
- [x] Verify the Dagger-backed package job in real CI after package planning
      moved into Dagger TypeScript.

## Phase 3: Move Package Manifest Logic

- [x] Move package manifest schema/type handling from the former package
      manifest helper
      into Dagger TypeScript.
- [x] Keep manifest schema compatible with the deployed contract:
      `artifacts.<target>.kind`, `path`, and `deploy_path`.
- [x] Write `.dagger/runtime/package-manifest.json` from Dagger TypeScript.
- [x] Keep deploy consuming the same package manifest shape.
- [x] Add Dagger tests for manifest writing/planning.

## Phase 4: Remove Obsolete Package Scripts

- [x] Delete the obsolete package deploy-target helper
      after Dagger TypeScript owns package materialization.
- [x] Delete the obsolete package deploy-target helper tests
      after equivalent Dagger tests exist.
- [x] Delete the obsolete package manifest helper
      after equivalent Dagger code owns manifest writing.
- [x] Delete the obsolete package manifest helper tests
      after equivalent Dagger tests exist.
- [x] Update docs to remove references to the old package helper scripts.

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
