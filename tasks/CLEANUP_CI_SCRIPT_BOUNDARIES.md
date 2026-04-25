# Cleanup CI Script Boundaries

## Goal

Remove the former root `scripts/ci` helper layer and move its remaining mixed
responsibilities into the owners that match the reusable Rush plus Dagger
framework.

The target architecture is:

- Dagger owns reusable CI/release framework behavior.
- Rush is the only project-layout assumption hardcoded into Dagger.
- `.dagger` metadata tells Dagger which targets exist and how to package or
  deploy them.
- Project or provider modules own service-specific deploy and validation
  scripts.
- GitHub Actions stays a thin bootstrap layer for checkout, credentials, and
  one Dagger call.

## Original Problem

The former root `scripts/ci` folder mixed several categories:

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

| Script                                                                                                                       | Phase                 | Current callers                                        | Recommended owner                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Deleted root detect script layer                                                                                             | detect                | formerly Dagger detect and legacy split-job adapters   | Dagger TypeScript now owns CI plan schema, Rush planning, and target metadata loading.                  |
| Deleted split-job GitHub example                                                                                             | legacy GitHub adapter | formerly a preserved GitHub split-job workflow example | Removed after the composed Dagger workflow was validated in real CI.                                    |
| Deleted root GraphQL drift helper                                                                                            | build verify          | formerly `apps/server` Rush `verify` script            | Replaced by server-owned package scripts in [../apps/server/package.json](../apps/server/package.json). |
| Deleted root server migration helper                                                                                         | validate              | legacy split-job example                               | Replaced by `apps/server` package script `ci:migration:run`.                                            |
| Deleted root server start helper                                                                                             | validate              | legacy split-job example                               | Replaced by `apps/server` package script `ci:start:prod-smoke`.                                         |
| [../deploy/cloudrun/scripts/deploy-server.sh](../deploy/cloudrun/scripts/deploy-server.sh)                                   | deploy                | `.dagger/deploy/targets/server.yaml`                   | Provider-owned Cloud Run deploy adapter.                                                                |
| [../deploy/cloudflare-pages/scripts/deploy-webapp.sh](../deploy/cloudflare-pages/scripts/deploy-webapp.sh)                   | deploy                | `.dagger/deploy/targets/webapp.yaml`                   | Provider-owned Cloudflare Pages deploy adapter.                                                         |
| [../deploy/cloudflare-pages/scripts/validate-webapp-routes.sh](../deploy/cloudflare-pages/scripts/validate-webapp-routes.sh) | deploy smoke          | `deploy-webapp.sh`                                     | Cloudflare Pages route validation colocated with the webapp deploy adapter.                             |
| Deleted root deploy tag helper                                                                                               | deploy state          | formerly target deploy scripts                         | Replaced by Dagger deploy orchestration as a generic post-target success step.                          |
| Deleted root env helper                                                                                                      | shell helper          | formerly legacy Makefile checks                        | Replaced by self-contained example checks; root Makefile removed.                                       |

Detect planner tests moved to Dagger tests. Example-only adapters should stay
self-contained under `examples`, not keep production tests in a root CI script
folder.

## Phase 0: Lock The Boundary

- [x] Confirm `scripts/ci` is not treated as a reusable framework API.
- [x] Keep Rush as the only Dagger framework assumption.
- [x] Keep deploy target names loaded from `.dagger` metadata only.
- [x] Decide whether provider deploy scripts live under `deploy/*/scripts` or
      under `apps/*/scripts/deploy`.
- [x] Decide whether the split-job GitHub example should be refreshed, kept, or
      removed. It was removed to reduce confusion.

## Phase 1: Move Detect Planning Into Dagger

- [x] Port CI plan schema helpers into Dagger TypeScript.
- [x] Port Rush planning core into Dagger TypeScript.
- [x] Reuse Dagger deploy metadata loaders instead of
      the old root metadata helper.
- [x] Replace `dagger/src/stages/detect/detect.ts` shell-out to
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
- [x] Convert project-owned shell helpers into `package.json` scripts whenever
      that makes the command simpler and keeps behavior inside the owning Rush
      project.
- [x] Keep Rush `verify` as the generic build-stage command.
- [x] Move or retire server local migration and start-server validation helpers
      from the legacy split-job path.
- [x] Update tests/docs that reference the old root script paths.

## Phase 3: Move Target Deploy Adapters

- [x] Move the server deploy adapter out of root `scripts/ci`.
- [x] Move the webapp deploy adapter out of root `scripts/ci`.
- [x] For app-owned deploy preparation, prefer package scripts over new
      repo-global shell helpers when the package script is clearer.
- [x] Move webapp route validation with the webapp or Cloudflare Pages adapter.
- [x] Update `.dagger/deploy/targets/*.yaml` `deploy_script` paths.
- [x] Keep Dagger deploy execution generic over `deploy_script`.
- [x] Keep provider install/env/mount configuration in target YAML.
- [x] Add repository metadata tests that assert every target deploy script path
      exists after the move.

## Phase 4: Move Generic Deploy State Into Dagger

- [x] Move deploy tag update behavior from `update-deploy-tag.sh` into Dagger
      deploy TypeScript.
- [x] Update tags only after the corresponding target succeeds.
- [x] Preserve `deploy/<environment>/<target>` naming.
- [x] Keep tag pushing generic and independent of Cloud Run or Cloudflare.
- [x] Remove target script responsibility for updating deploy tags.
- [x] Add focused tests for deploy tag command planning or execution wrapper
      behavior.

## Phase 5: Remove Root CI Helper Layer

- [x] Remove `require-envs.sh` after legacy Makefile checks no longer depend on
      it.
- [x] Remove obsolete Makefile CI targets that only exist for the old
      split-job workflow.
- [x] Move any retained example-only helper scripts under `examples`.
- [x] Keep [../scripts](../scripts) for real repository utilities, not release
      framework internals.
- [x] Delete or archive `scripts/ci` if no production scripts
      remain.

## Phase 6: Documentation And Examples

- [x] Update [../docs/notes/ReleaseFlow.md](../docs/notes/ReleaseFlow.md) with
      the new script ownership boundaries.
- [x] Update target YAML examples in task docs.
- [x] Remove the legacy GitHub split-job example to keep the supported release
      path clear.
- [x] Update GitLab example references if they still call removed Makefile
      targets.
- [x] Document the rule for adding a new deploy target:
      add Rush project, add package metadata, add deploy metadata, and provide
      a target/provider deploy script if needed.

## Phase 7: Validation

- [x] Run Dagger unit tests.
- [x] Run Dagger TypeScript typecheck.
- [x] Run shell syntax checks for moved deploy scripts.
- [ ] Run remaining script tests, if any scripts remain.
- [x] Run the composed GitHub `ci-release` workflow.
- [x] Run forced `deploy-server`.
- [x] Run forced `deploy-webapp`.
- [x] Confirm no Dagger source file invokes `scripts/ci`.
- [x] Confirm root `scripts/ci` no longer contains project-specific or
      framework-owned release logic.

## Stop Point

- Dagger no longer shells out to the former root `scripts/ci` layer.
- Root CI scripts no longer encode deploy target behavior.
- Target deploy scripts live with their project or provider module.
- Detect, build, package, deploy orchestration is testable in Dagger
  TypeScript.
- Adding a new Rush deploy target requires metadata and target-owned adapter
  code, not edits to Dagger framework internals.
