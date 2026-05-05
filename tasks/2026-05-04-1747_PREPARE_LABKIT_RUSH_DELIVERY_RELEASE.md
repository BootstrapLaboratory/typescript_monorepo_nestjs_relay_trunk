# Prepare Labkit Rush Delivery Release

## Goal

Create a dedicated Labkit repository that can build and publish the current
`@omgjs/labkit-*` libraries to the public npm registry through Rush and Rush
Delivery.

Target repositories:

- Labkit: `git@github.com:BootstrapLaboratory/labkit.git`
- Rush Delivery: `git@github.com:BootstrapLaboratory/rush-delivery.git`

The current source repository remains the owner until the new repository is
verified. Libraries are copied first; they are not removed from this repository
as part of the first slice.

## Current Snapshot

- [x] Clone Labkit into `/tmp/labkit-repo`.
- [x] Clone Rush Delivery into `/tmp/rush-delivery-repo`.
- [x] Copy current `libs/labkit/**` into `/tmp/labkit-repo/libs/labkit/**`.
- [x] Clean generated artifacts from the copied snapshot:
      `dist`, `node_modules`, `.rush`, and `rush-logs`.
- [x] Confirm the current Labkit package set:
      `@omgjs/labkit-auth-contract`, `@omgjs/labkit-runtime-config`,
      `@omgjs/labkit-server-auth`, `@omgjs/labkit-server-auth-typeorm`,
      `@omgjs/labkit-server-config`, `@omgjs/labkit-server-database`,
      `@omgjs/labkit-server-graphql`, `@omgjs/labkit-server-observability`,
      `@omgjs/labkit-webapp-auth`, `@omgjs/labkit-webapp-build-config`,
      `@omgjs/labkit-webapp-external-store`, `@omgjs/labkit-webapp-graphql-relay`,
      `@omgjs/labkit-webapp-realtime`, and `@omgjs/labkit-webapp-ui`.

## Architecture Decisions

- [x] Use the raw source copy only as the temporary staging snapshot.
- [x] Flatten the dedicated Labkit repository to `packages/<package>` before
      the first publish.
- [x] Keep Labkit as the product/library family name, publish under the
      existing `@omgjs` npm organization, and use `@omgjs/labkit-*` package
      names.
- [x] Keep folder layout independent from the npm public API.
- [x] Keep server-only packages CommonJS for now. They already work in the
      current Nest/Node setup and do not need package-format churn as part of
      repository extraction.
- [x] Keep browser-consumed and shared browser/server package formats as they
      are today. They are already tuned for the current Vite/browser and
      shared-runtime requirements.
- [x] Keep generated `dist` out of git and let each package build it in CI.
- [x] Copy and rename the shared ESLint helper from `@repo/eslint-config` to
      `@omgjs/labkit-eslint-config`.

## Phase 1: Rush Baseline

- [x] Initialize Rush in the Labkit repository.
- [x] Configure PNPM as the Rush package manager.
- [x] Add root command wrappers:
      `rush`, `rush:install`, `rush:update`, `rush:build`, `rush:version`, and
      `rush:publish`.
- [x] Add `common/scripts/install-run-rush.js`.
- [x] Add `common/scripts/write-esm-package-marker.mjs` or replace package
      build scripts with an equivalent local helper.
- [x] Add `common/config/rush/command-line.json` with `lint`, `test`, and
      `verify` bulk commands. Use Rush's built-in `build` command for package
      builds.
- [x] Move copied package folders from `libs/labkit/<package>` to
      `packages/<package>`.
- [x] Copy `tools/eslint-config` into the Labkit repository and rename its
      package from `@repo/eslint-config` to `@omgjs/labkit-eslint-config`.
- [x] Update Labkit package dev dependencies and ESLint config imports to use
      `@omgjs/labkit-eslint-config`.
- [x] Add every Labkit package to `rush.json` under `packages/<package>`.
- [x] Add the `@omgjs/labkit-eslint-config` helper project to `rush.json`.
- [x] Configure version policies intentionally for public package releases.
- [x] Run `rush update` and generate the Rush lockfile and config.
- [x] Commit the generated Rush baseline in the Labkit repository.

Phase 1 notes:

- The dedicated repo now uses `packages/<package>` and a root `README.md`.
- Package build scripts were updated from `../../../common/scripts/...` to
  `../../common/scripts/...`.
- Standalone tests made hidden host-app dependencies visible. The server Nest
  packages now explicitly depend on `rxjs`, and
  `@omgjs/labkit-webapp-graphql-relay` declares `react` as a peer dependency plus a
  dev dependency for package-local tests.
- Rush update currently leaves one peer warning from
  `@nestjs/apollo`/Apollo Server compatibility. Build, lint, test, and verify
  pass despite that warning.

## Phase 2: Package Publish Readiness

- [x] Remove `"private": true` from publishable `@omgjs/labkit-*` packages.
- [x] Keep `@omgjs/labkit-eslint-config` private as repository tooling for now.
- [x] Add package metadata required for public npm packages:
      `license`, `repository`, `homepage`, `bugs`, and `publishConfig`.
- [x] Set `publishConfig.access` to `public` for scoped packages.
- [x] Review `files` entries so npm publishes only intended artifacts and
      README/license material.
- [x] Review dependency boundaries:
      package dependencies for Labkit packages, peer dependencies for host
      framework packages when the consuming app should own the runtime version, and
      dev dependencies for build/test tooling.
- [x] Verify all local `@omgjs/labkit-*` workspace dependency ranges are publishable
      and compatible with Rush versioning.
- [x] Verify every package has `build`, `lint`, `test`, and `verify` behavior
      that makes sense in a standalone repository.
- [x] Verify TypeScript declaration output and ESM/CJS package exports after a
      clean install.

Phase 2 notes:

- Each publishable package now has MIT license metadata, repository directory,
  package homepage, issue URL, npm public publish config, and README included
  in `files`.
- `@omgjs/labkit-eslint-config` remains private and is not treated as a public npm
  package in this slice.
- Package dry-runs were executed from each package directory. All 14
  publishable packages pack as `@omgjs/labkit-*`, include README and `dist`, and do
  not include `src`, `test`, `node_modules`, `.rush`, or `rush-logs`.

## Phase 3: Rush Delivery Package Release

- [x] Add `.dagger/release/npm.yaml`.
- [x] Use the Rush Delivery npm release schema for editor validation:
      `https://bootstraplaboratory.github.io/rush-delivery/schemas/v0.6.2/npm-release.schema.json`.
- [x] Configure npm release metadata:
      `kind: npm`, `versioning.strategy: rush-change-files`,
      `versioning.target_branch: main`, token auth with `NPM_TOKEN`,
      public npm registry, `tag: latest`, `access: public`, and provenance.
- [x] Add `common/config/rush/.npmrc-publish` with npm token interpolation for
      Rush publish.
- [ ] Confirm Rush Delivery validation checks Rush change files when npm
      release metadata exists.
- [ ] Confirm `release-packages` runs the Rush lifecycle, applies change files,
      publishes packages, and pushes the generated version commit back to `main`.
- [x] Add Rush minor change files for the 14 publishable packages so the first
      public release resolves to `0.1.0`.

Phase 3 notes:

- Rush-generated minor change files exist for all publishable `@omgjs/labkit-*`
  packages. `@omgjs/labkit-eslint-config` does not have a change file because it
  remains private tooling.
- A direct `rush publish` dry run confirmed the planned updates to `0.1.0`,
  dependency range updates among Labkit packages, changelog generation, package
  tags, and `pnpm publish --tag latest --access public --no-git-checks` dry-run
  commands. It did not publish npm packages.
- Important: direct `rush publish` without `--apply --publish` still performed
  Git branch, commit, merge, and push operations in the temp Labkit checkout.
  It pushed the initialized Labkit repository state and change files to
  `origin/main` at commit `99172ac`. The package versions remain `0.0.1`
  until a live Rush publish apply step consumes the change files.
- Rush Delivery metadata contract validation currently fails for this
  package-only repository because the framework still requires deploy services
  mesh and Rush cache provider metadata even when only npm release metadata is
  configured. Labkit should not add fake deploy metadata. Resolve this by
  teaching Rush Delivery package release validation to allow package-only
  repositories.
- Upstream request:
  [BootstrapLaboratory/rush-delivery#1](https://github.com/BootstrapLaboratory/rush-delivery/issues/1)

## Phase 4: GitHub Actions

- [x] Add PR validation workflow using direct Rush commands while Rush Delivery
      package-only validation is blocked by upstream issue #1.
- [x] Add package release workflow on pushes to `main` using
      `entrypoint: release-packages`.
- [x] Remove the extra `RUSH_DELIVERY_PACKAGE_RELEASE_ENABLED` workflow gate.
      The package release workflow now calls Rush Delivery directly on `main`
      pushes and manual dispatches.
- [x] Pin Rush Delivery to a released tag, not a floating branch.
- [x] Give validation read-only permissions.
- [x] Give package release `contents: write` so Rush Delivery can push the
      version commit and tags.
- [x] Give package release `packages: write` when GitHub package-backed
      toolchain or Rush cache providers are enabled.
- [x] Give package release `id-token: write` for npm provenance.
- [x] Provide `NPM_TOKEN` through `release-env`, not `deploy-env`.
- [x] Add repository secret `NPM_TOKEN` before live release.
- [x] Keep GitHub package/toolchain and Rush cache providers off for the
      initial release workflow. Provider metadata should be added only when it
      is intentionally needed.

Phase 4 notes:

- Labkit `main` has been pushed to
  `git@github.com:BootstrapLaboratory/labkit.git`. The workflow scaffold was
  pushed at commit `6087501`; the current renamed-package state was commit
  `cb01956`, and Rush Delivery workflow/schema references were bumped to
  `v0.6.1` at commit `f141927`. The workflow/schema references were then
  bumped to `v0.6.2` at commit `7a16033`.
- `.github/workflows/pr-validate.yaml` runs `rush install`,
  `rush change --verify`, `rush build`, `rush lint`, `rush test`, and
  `rush verify`.
- `.github/workflows/package-release.yaml` uses
  `BootstrapLaboratory/rush-delivery@v0.6.2` with
  `entrypoint: release-packages`, providers set to `off`, and `NPM_TOKEN` in
  `release-env`.
- `.dagger/release/npm.yaml` also points to the Rush Delivery `v0.6.2` npm
  release schema.
- The extra `RUSH_DELIVERY_PACKAGE_RELEASE_ENABLED` workflow gate was removed
  at commit `fe278f1`. The workflow now runs Rush Delivery directly for `main`
  pushes and manual dispatches.
- With `NPM_TOKEN` present, the `v0.6.1` `release-packages` action reached the
  Rush lifecycle in CI. The first live attempt failed inside `rush verify`,
  not while loading Rush Delivery.

## Phase 5: Local And CI Validation

- [x] Verify a clean source-only Labkit checkout.
- [x] Run `rush install`.
- [x] Run `rush update`.
- [x] Run `rush build`.
- [x] Run `rush lint`.
- [x] Run `rush test`.
- [x] Run `rush verify`.
- [ ] Run Rush Delivery metadata contract validation.
- [ ] Run a Rush Delivery local dry run for `release-packages`.
- [x] Create at least one Rush change file for the first publish.
- [x] Confirm the direct Rush publish dry run does not publish packages.
- [x] Confirm the live workflow requires `NPM_TOKEN` and GitHub write
      permissions before it can publish.
- [x] Confirm all 14 publishable packages pack as `@omgjs/labkit-*` after the
      npm scope rename.

Phase 5 notes:

- `git diff --check` passed for the final Labkit workflow and README edits.
- `npm run rush:build` passed after adding the workflow files; all package
  builds were already up to date.
- The npm scope rename was pushed to Labkit `main` at commit `cb01956`.
- After the rename, `rush update`, `rush build`, `rush lint`, serial
  `rush test`, serial `rush verify`, and per-package `npm pack --dry-run`
  passed in `/tmp/labkit-repo`.
- Rush Delivery metadata contract validation and local `release-packages`
  dry-run still need an explicit follow-up pass with Rush Delivery `v0.6.2`.
  Do not unblock any remaining package-only metadata issue by adding fake
  deploy metadata to Labkit.
- GitHub Actions package release failed from a clean checkout because Labkit's
  custom `test` and `verify` Rush commands had `ignoreDependencyOrder: true`.
  That allowed packages consuming other Labkit packages to start before their
  dependencies had produced `dist` and declaration files, causing
  `TS2307: Cannot find module '@omgjs/labkit-*'` errors.
- Fixed in the Labkit repository at commit `f9ad960` by making `test` and
  `verify` respect Rush dependency order while leaving `lint` unordered.
- Clean-dist validation passed after the fix:
  `node common/scripts/install-run-rush.js verify` and
  `node common/scripts/install-run-rush.js test` both succeeded after removing
  all generated `packages/*/dist` folders.
- The next live release attempt reached `rush publish` after `verify`, `lint`,
  `test`, and `build` completed. It then failed because Rush Delivery exposed
  internal `RUSH_DELIVERY_GIT_*` environment variables to Rush, and Rush
  rejects unknown variables with the reserved `RUSH_` prefix.

## Phase 6: Migration Back To This Repository

- [ ] After public packages are published, decide whether this application repo
      continues using local `libs/labkit/*` temporarily or switches to npm
      `@omgjs/labkit-*` dependencies.
- [ ] If switching to npm, remove local Rush project dependencies in a separate
      application-repo task.
- [ ] Keep the old local libraries until application build, test, and CI pass
      against the npm packages.
- [ ] Only delete local Labkit libraries after the dedicated repo is the source
      of truth and this repo consumes released package versions.

## Notes From Rush Delivery Inspection

- Rush Delivery package publishing is not modeled as a deploy target. It is
  configured by `.dagger/release/npm.yaml` and executed with the
  `release-packages` entrypoint.
- The release entrypoint uses Rush change files as the first supported
  versioning strategy.
- Live package release should use the GitHub Action's normal Git source mode or
  another HTTP(S) Git source URL. Rush Delivery configures token-based push auth
  for the generated version commit and rejects non-HTTP(S) source URLs in live
  package release mode.
- In live mode, Rush Delivery calls `rush publish --apply --publish`, then
  pushes the generated version commit and tags to the configured target branch.
- NPM credentials belong in `release-env`; deploy credentials and deploy target
  metadata are not needed for this first package-only repository.
