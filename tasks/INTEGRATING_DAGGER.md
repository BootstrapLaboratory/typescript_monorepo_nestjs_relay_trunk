# Dagger Integration Plan

## Goal

Move release deploy orchestration out of GitHub-specific workflow logic and into portable Dagger code, while keeping the migration incremental and reversible.

Target behavior:

- GitHub Actions remains the trigger and outer CI shell.
- `detect` continues deciding scope.
- packaging stays stable while deploy orchestration moves into Dagger.
- selected targets are filtered first, then deployment order is computed from the service mesh.
- `webapp`-only releases do not require `server`.
- `server` deploys before services that list it in `deploy_after`.
- independent services in the same wave deploy in parallel.

## Principles

- Keep each phase shippable on its own.
- Rename confusing terminology before introducing Dagger concepts.
- Do not rewrite validation/package unless Dagger migration needs it.
- Keep target-specific deploy implementations separate.
- Prefer one source of orchestration truth.

## Phase 0: Terminology Cleanup

Purpose: rename the current release-scope output before Dagger planning begins.

- [x] Rename `deploy_targets_json` to `release_targets_json` in `scripts/ci/compute-rush-plan.mjs`.
- [x] Rename `deploy_targets_json` to `release_targets_json` in `.github/workflows/ci-release.yaml`.
- [x] Rename `DEPLOY_TARGETS_JSON` to `RELEASE_TARGETS_JSON` in the `Makefile`.
- [x] Rename `DEPLOY_TARGETS_JSON` to `RELEASE_TARGETS_JSON` in `scripts/ci/run-release-targets.sh`.
- [x] Update any manual wrapper workflows that pass or consume the release target list.
- [x] Verify no logic changes are introduced during the rename.
- [x] Verify `validate_targets_json` remains unchanged.

Stop point:

- CI behaves exactly as before, but the release-scope variable is now named `release_targets_json`.

## Phase 1: Extract Portable Deploy Executors

Purpose: make deploy implementations callable outside GitHub-specific job orchestration.

- [ ] Identify the minimum stable input contract for every deploy target.
- [ ] Define a portable executor contract for each target:
  - target name
  - artifact location
  - commit SHA
  - environment name
  - required secrets/env vars
- [ ] Extract backend deploy logic into a dedicated callable entrypoint.
- [ ] Extract webapp deploy logic into a dedicated callable entrypoint.
- [ ] Replace GitHub-only action assumptions with CLI/API/script equivalents where needed.
- [ ] Keep executor implementations target-specific; do not force a shared deploy script.
- [ ] Ensure each target executor can be invoked independently for local or CI dry-runs.

Notes:

- This is the phase where `google-github-actions/*` and `cloudflare/wrangler-action` usage must be reviewed carefully.
- Dagger should orchestrate target executors, not reintroduce GitHub job logic internally.

Stop point:

- We have stable target deploy entrypoints that Dagger can call later.

## Phase 2: Bootstrap Dagger in the Repo

Purpose: introduce Dagger without cutting over deploys yet.

- [ ] Choose the Dagger SDK language.
- [ ] Recommended default: TypeScript, to match the existing Node-based CI helpers.
- [ ] Initialize the Dagger module in the repository.
- [ ] Add a minimal Dagger function that can run successfully in local development.
- [ ] Add a minimal GitHub Actions job or step that can call a Dagger function successfully.
- [ ] Decide whether Dagger Cloud is used for observability or kept disabled.
- [ ] Keep this phase free-compatible by running Dagger on standard GitHub runners only.

Stop point:

- Dagger is installed and callable in the repo, but deploy orchestration is still unchanged.

## Phase 3: Add the Service Mesh and Release Planner

Purpose: move deployment-order logic into portable code.

- [ ] Add a service mesh document, recommended path: `deploy/services-mesh.yaml`.
- [ ] Use `deploy_after` as the dependency field name.
- [ ] Start with the current known targets:
  - `server`
  - `webapp`
- [ ] Reserve the shape for future targets such as `mobile`.
- [ ] Add artifact and executor metadata only if the planner needs it immediately.
- [ ] Implement a Dagger-side planner that:
  - reads `release_targets_json`
  - filters the mesh to selected targets first
  - computes deployment waves
  - fails on cycles
- [ ] Define the planner output contract.
- [ ] Recommended shape:
```json
{
  "waves": [
    [{ "target": "server", "executor": "server" }],
    [{ "target": "webapp", "executor": "webapp" }]
  ]
}
```
- [ ] Add planner tests for:
  - `["webapp"] -> [["webapp"]]`
  - `["server", "webapp"] -> [["server"], ["webapp"]]`
  - a future parallel case like `["server", "webapp", "mobile"] -> [["server"], ["webapp", "mobile"]]`
  - cycle detection

Stop point:

- Release planning is now portable, deterministic, and independent from GitHub DAG semantics.

## Phase 4: Add Dagger Release Deploy Orchestration

Purpose: let Dagger own deploy ordering and parallel wave execution.

- [ ] Add a Dagger function such as `deploy-release`.
- [ ] Input contract for `deploy-release`:
  - `release_targets_json`
  - commit SHA
  - environment name
  - artifact locations or artifact root
- [ ] Make `deploy-release`:
  - load the service mesh
  - compute the plan
  - execute each wave in order
  - execute targets inside a wave in parallel
- [ ] Keep executor dispatch target-specific:
  - `server` -> backend deploy executor
  - `webapp` -> webapp deploy executor
- [ ] Emit readable logs for:
  - selected targets
  - computed waves
  - start/finish of each target deploy
- [ ] Make wave failure stop the remaining plan.
- [ ] Define how deploy tags are updated on success per target.

Stop point:

- Dagger can perform the full ordered release deploy locally or from CI, using the same service mesh.

## Phase 5: Integrate Dagger into GitHub Actions

Purpose: make GitHub call Dagger, while keeping GitHub as the outer CI entrypoint.

- [ ] Keep `detect` as the source of:
  - `validate_targets_json`
  - `release_targets_json`
- [ ] Keep the `package` job initially.
- [ ] Replace separate deploy orchestration jobs with a single `deploy` job.
- [ ] In that `deploy` job:
  - download required artifacts
  - set up required secrets/env vars
  - call `dagger` to run `deploy-release`
- [ ] Remove GitHub-specific ordering logic from `.github/workflows/ci-release.yaml`.
- [ ] Remove `always()` / skipped-job orchestration workarounds once Dagger is authoritative.
- [ ] Keep manual release entrypoints, but make them feed the Dagger-backed release path.

Stop point:

- GitHub Actions is now only the trigger/shell, and Dagger owns deployment ordering.

## Phase 6: Cleanup and Portability Hardening

Purpose: finish the migration and reduce CI vendor coupling.

- [ ] Remove obsolete GitHub-only deploy orchestration code.
- [ ] Remove dead Makefile targets or helper scripts that were only needed for GitHub job wiring.
- [ ] Update operational docs to describe the Dagger-backed deploy flow only.
- [ ] Add one example of invoking the same Dagger release function from another CI provider.
- [ ] Add a follow-up task for GitLab wrapper integration if desired.

Stop point:

- Deploy orchestration is portable, and GitHub-specific logic is reduced to thin wrapper CI.

## Suggested Implementation Order

- [x] Phase 0
- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
- [ ] Phase 4
- [ ] Phase 5
- [ ] Phase 6

## Open Decisions

- [ ] Confirm Dagger SDK language.
- [ ] Confirm whether Dagger Cloud is used or intentionally skipped.
- [ ] Decide whether packaging remains GitHub-owned long-term or also moves into Dagger later.
- [ ] Decide whether deploy artifacts remain GitHub artifacts or move to a storage backend later.
