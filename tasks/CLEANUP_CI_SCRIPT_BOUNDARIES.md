# Cleanup CI Script Boundaries

## Goal

Move the remaining mixed responsibilities out of [../scripts/ci](../scripts/ci)
and into the owners that match the reusable Rush plus Dagger framework.

The target architecture is:

- Dagger owns reusable CI/release framework behavior.
- Rush is the only project-layout assumption hardcoded into Dagger.
- `.dagger` metadata tells Dagger which targets exist and how to package or
  deploy them.
- Project or provider modules own service-specific deploy and validation
  scripts.
- GitHub Actions stays a thin bootstrap layer for checkout, credentials, and
  one Dagger call.

## Current Problem

[../scripts/ci](../scripts/ci) currently mixes several categories:

- Dagger-called detect planning scripts.
- Legacy split-job GitHub output adapters.
- Server-specific validation helpers.
- Target-specific deploy scripts.
- Generic shell helpers used by those target scripts.

That makes the folder look like the framework contract, but it is really a
collection of historical glue. It also keeps project-specific target names and
provider behavior in a repo-global CI folder, which works against making the
Dagger module reusable across other Rush projects.

## Ownership Model

### Dagger Framework

Dagger should own reusable framework mechanics:

- detect planning from Git and Rush
- CI plan schema and parsing
- build-stage Rush command planning
- package-stage artifact materialization from `.dagger/package`
- deployment graph planning from `.dagger/deploy/services-mesh.yaml`
- target runtime execution from `.dagger/deploy/targets/*.yaml`
- generic deploy tag updates after target success

Dagger should not hardcode `server`, `webapp`, Cloud Run, Cloudflare Pages, or
repo-specific script paths.

### Metadata

Repository-owned metadata stays under `.dagger`:

- [../.dagger/deploy/services-mesh.yaml](../.dagger/deploy/services-mesh.yaml)
- [../.dagger/deploy/targets](../.dagger/deploy/targets)
- [../.dagger/package/targets](../.dagger/package/targets)

Adding a deployable Rush project should mostly mean adding target metadata, not
editing Dagger TypeScript.

### Project Or Provider Modules

Target-specific runtime behavior should live near the owning module:

- server app behavior can live under `apps/server/scripts`
- Cloud Run provider behavior can live under `deploy/cloudrun/scripts`
- webapp behavior can live under `apps/webapp/scripts`
- Cloudflare Pages provider behavior can live under
  `deploy/cloudflare-pages/scripts`

The target YAML `deploy_script` remains the extension point that connects
Dagger to those project/provider scripts.

### Package Script Rule

If a script belongs naturally to a Rush project and converting it into a
`package.json` script simplifies the code, convert it.

Prefer package scripts for project-owned behavior such as verification, schema
generation, local migrations, local smoke-test helpers, or app-specific build
preparation. Dagger should then call generic Rush commands or read metadata,
not hardcode project internals.

Keep standalone shell scripts only when they are a better operational boundary,
for example provider provisioning modules under `deploy/*`, target deploy
adapters referenced by `.dagger/deploy/targets/*.yaml`, or scripts that need to
be shared outside a single npm package.

### CI Provider Shell

GitHub Actions should remain thin:

- checkout
- tag fetch
- Dagger CLI install
- provider authentication
- flat deploy env file creation
- `dagger call workflow`

Provider-specific artifact upload/download is no longer part of the main
release flow after the composed Dagger `workflow` cutover.

## Inventory By Phase

| Script | Phase | Current callers | Recommended owner |
| --- | --- | --- | --- |
| Deleted root detect script layer | detect | formerly Dagger detect and legacy split-job adapters | Dagger TypeScript now owns CI plan schema, Rush planning, and target metadata loading. |
| Split-job CI plan output extraction | legacy GitHub adapter | [../examples/github/ci-release.split-jobs.yaml](../examples/github/ci-release.split-jobs.yaml) | The example derives outputs directly from `ci-plan.json`; no root helper script remains. |
| Deleted root GraphQL drift helper | build verify | formerly `apps/server` Rush `verify` script | Replaced by server-owned package scripts in [../apps/server/package.json](../apps/server/package.json). |
| [../scripts/ci/run-server-migrations.sh](../scripts/ci/run-server-migrations.sh) | validate | legacy Makefile split-job path | Move under `apps/server/scripts` if PR validation keeps this local migration check. |
| [../scripts/ci/start-local-server.sh](../scripts/ci/start-local-server.sh) | validate | legacy Makefile split-job path | Move under `apps/server/scripts` if local server smoke validation stays. |
| [../scripts/ci/deploy-server.sh](../scripts/ci/deploy-server.sh) | deploy | `.dagger/deploy/targets/server.yaml` | Move out of root CI scripts, preferably to `deploy/cloudrun/scripts/deploy-server.sh` or a server-owned deploy module. |
| [../scripts/ci/deploy-webapp.sh](../scripts/ci/deploy-webapp.sh) | deploy | `.dagger/deploy/targets/webapp.yaml` | Move out of root CI scripts, preferably to `deploy/cloudflare-pages/scripts/deploy-webapp.sh` or a webapp-owned deploy module. |
| [../scripts/ci/validate-webapp-routes.sh](../scripts/ci/validate-webapp-routes.sh) | deploy smoke | `deploy-webapp.sh` | Move with the webapp or Cloudflare Pages deploy module. |
| [../scripts/ci/update-deploy-tag.sh](../scripts/ci/update-deploy-tag.sh) | deploy state | target deploy scripts | Move into Dagger deploy orchestration as a generic post-target success step. |
| [../scripts/ci/require-envs.sh](../scripts/ci/require-envs.sh) | shell helper | target deploy scripts and legacy Makefile checks | Delete after Dagger validates runtime env and moved scripts own any remaining local validation. |

Tests under [../scripts/ci](../scripts/ci) should move with their production
code. Detect planner tests should become Dagger tests. Example-only adapters
should not keep production tests in the root CI script folder.

## Phase 0: Lock The Boundary

- [ ] Confirm `scripts/ci` is not treated as a reusable framework API.
- [ ] Keep Rush as the only Dagger framework assumption.
- [ ] Keep deploy target names loaded from `.dagger` metadata only.
- [ ] Decide whether provider deploy scripts live under `deploy/*/scripts` or
      under `apps/*/scripts/deploy`.
- [ ] Decide whether the split-job GitHub example should be refreshed or kept
      as a historical sample with self-contained helper scripts.

## Phase 1: Move Detect Planning Into Dagger

- [x] Port CI plan schema helpers into Dagger TypeScript.
- [x] Port Rush planning core into Dagger TypeScript.
- [x] Reuse Dagger deploy metadata loaders instead of
      the old root metadata helper.
- [x] Replace `dagger/src/detect/detect.ts` shell-out to
      root CI scripts with direct TypeScript planning.
- [x] Replace `dagger/src/workflow/build-package-runner.ts` shell-out to
      root CI scripts with direct TypeScript planning.
- [x] Migrate detect planner tests from `scripts/ci/*.test.mjs` to
      `dagger/test`.
- [x] Delete obsolete detect scripts after Dagger tests cover the same cases.

## Phase 2: Move Project-Specific Build Validation

- [x] Move GraphQL contract drift checking out of root `scripts/ci`.
- [x] Update [../apps/server/package.json](../apps/server/package.json) so
      `verify` calls the server-owned script.
- [ ] Convert project-owned shell helpers into `package.json` scripts whenever
      that makes the command simpler and keeps behavior inside the owning Rush
      project.
- [ ] Keep Rush `verify` as the generic build-stage command.
- [ ] Move or retire server local migration and start-server validation helpers
      from the legacy split-job path.
- [ ] Update tests/docs that reference the old root script paths.

## Phase 3: Move Target Deploy Adapters

- [ ] Move the server deploy adapter out of root `scripts/ci`.
- [ ] Move the webapp deploy adapter out of root `scripts/ci`.
- [ ] For app-owned deploy preparation, prefer package scripts over new
      repo-global shell helpers when the package script is clearer.
- [ ] Move webapp route validation with the webapp or Cloudflare Pages adapter.
- [ ] Update `.dagger/deploy/targets/*.yaml` `deploy_script` paths.
- [ ] Keep Dagger deploy execution generic over `deploy_script`.
- [ ] Keep provider install/env/mount configuration in target YAML.
- [ ] Add repository metadata tests that assert every target deploy script path
      exists after the move.

## Phase 4: Move Generic Deploy State Into Dagger

- [ ] Move deploy tag update behavior from `update-deploy-tag.sh` into Dagger
      deploy TypeScript.
- [ ] Update tags only after the corresponding target succeeds.
- [ ] Preserve `deploy/<environment>/<target>` naming.
- [ ] Keep tag pushing generic and independent of Cloud Run or Cloudflare.
- [ ] Remove target script responsibility for updating deploy tags.
- [ ] Add focused tests for deploy tag command planning or execution wrapper
      behavior.

## Phase 5: Remove Root CI Helper Layer

- [ ] Remove `require-envs.sh` after target scripts no longer depend on it.
- [ ] Remove obsolete Makefile CI targets that only exist for the old
      split-job workflow.
- [ ] Move any retained example-only helper scripts under `examples`.
- [ ] Keep [../scripts](../scripts) for real repository utilities, not release
      framework internals.
- [ ] Delete or archive [../scripts/ci](../scripts/ci) if no production scripts
      remain.

## Phase 6: Documentation And Examples

- [ ] Update [../docs/notes/ReleaseFlow.md](../docs/notes/ReleaseFlow.md) with
      the new script ownership boundaries.
- [ ] Update target YAML examples in task docs.
- [ ] Refresh [../examples/github/ci-release.split-jobs.yaml](../examples/github/ci-release.split-jobs.yaml)
      or mark it as legacy with self-contained assumptions.
- [ ] Update GitLab example references if they still call removed Makefile
      targets.
- [ ] Document the rule for adding a new deploy target:
      add Rush project, add package metadata, add deploy metadata, and provide
      a target/provider deploy script if needed.

## Phase 7: Validation

- [ ] Run Dagger unit tests.
- [ ] Run Dagger TypeScript typecheck.
- [ ] Run remaining script tests, if any scripts remain.
- [ ] Run the composed GitHub `ci-release` workflow.
- [ ] Run forced `deploy-server`.
- [ ] Run forced `deploy-webapp`.
- [ ] Confirm no Dagger source file invokes `scripts/ci`.
- [ ] Confirm root `scripts/ci` no longer contains project-specific or
      framework-owned release logic.

## Stop Point

- Dagger no longer shells out to [../scripts/ci](../scripts/ci).
- Root CI scripts no longer encode deploy target behavior.
- Target deploy scripts live with their project or provider module.
- Detect, build, package, deploy orchestration is testable in Dagger
  TypeScript.
- Adding a new Rush deploy target requires metadata and target-owned adapter
  code, not edits to Dagger framework internals.
