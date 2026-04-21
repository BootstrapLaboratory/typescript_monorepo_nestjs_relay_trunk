# Dagger Integration Plan

## Goal

Move release deploy orchestration out of GitHub-specific workflow logic and into portable Dagger code, while keeping the migration incremental and reversible.

Target behavior:

- GitHub Actions remains the trigger and outer CI shell.
- `detect` continues deciding scope.
- packaging stays stable while deploy orchestration moves into Dagger.
- GitHub Actions release flow becomes `detect -> package -> plan-deploy -> deploy`.
- selected targets are filtered first, then deployment order is computed from the service mesh.
- `webapp`-only releases do not require `server`.
- `server` deploys before services that list it in `deploy_after`.
- independent services in the same wave deploy in parallel.

Expected final GitHub Actions job graph:

- pull request: `detect -> validate`
- release: `detect -> package -> plan-deploy -> deploy`

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

- [x] Identify the minimum stable input contract for every deploy target.
- [x] Define a portable executor contract for each target:
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

### Phase 1 Deliverable: Concrete Executor Contract

The portable contract should be storage-agnostic and CI-vendor-agnostic. The executor should receive materialized inputs and credentials/capabilities from the caller instead of assuming GitHub-specific job primitives.

Base executor contract for every target:

- `target`: logical release target name such as `server` or `webapp`
- `artifact_path`: local filesystem path to the prepared release artifact or build output
- `git_sha`: release commit SHA to deploy and tag
- `environment`: deployment environment name, initially `prod`
- `deploy_tag_prefix`: deploy tag namespace, currently `deploy/prod`
- `repo_root`: repository root if the executor still needs repo-local files/scripts
- `capabilities`: authenticated access prepared by the caller, for example cloud auth, registry auth, or API token availability

Expected executor behavior for every target:

- validate required inputs and credentials up front
- deploy the target artifact
- run target-specific post-deploy verification
- update the deploy tag only after a successful deploy
- return structured result data if useful for later orchestration or reporting

Recommended portable output contract:

- `target`
- `status`
- `deployed_ref` such as image name or deploy identifier
- optional `service_url` for targets that expose one

Current concrete target mapping:

#### `server` executor

Required portable inputs:

- `target=server`
- `artifact_path=common/deploy/server` after extracting `deploy-target-server.tgz`
- `git_sha`
- `environment=prod`
- `deploy_tag_prefix`
- `cloud_run_region`
- `gcp_project_id`
- `gcp_artifact_registry_repository`
- `cloud_run_service`
- `cloud_run_runtime_service_account`
- `cloud_run_cors_origin`

Required credentials/capabilities:

- authenticated Google Cloud access
- ability to read Secret Manager secrets:
  - `DATABASE_URL`
  - `DATABASE_URL_DIRECT`
  - `REDIS_URL`
- ability to push container images to Artifact Registry
- ability to update Git deploy tags in the origin repository

Current side effects and steps to preserve:

- extract the packaged backend artifact
- verify required Google Cloud configuration
- load `DATABASE_URL_DIRECT`
- run dist migrations from `common/deploy/server/apps/server`
- build and push the backend image
- deploy Cloud Run service
- smoke test the deployed service URL
- update `deploy/prod/server`

Current GitHub-specific pieces that should be replaced or wrapped portably:

- `google-github-actions/auth@v3`
- `google-github-actions/setup-gcloud@v3`
- `google-github-actions/deploy-cloudrun@v3`

Portable direction:

- caller prepares cloud authentication before invoking the executor, or the executor performs CLI auth itself
- executor uses `gcloud` and `docker` directly instead of relying on GitHub-only action wrappers

#### `webapp` executor

Required portable inputs:

- `target=webapp`
- `artifact_path=apps/webapp/dist` after materializing the packaged frontend artifact
- `git_sha`
- `environment=prod`
- `deploy_tag_prefix`
- `cloudflare_pages_project_name`
- `webapp_url` for route validation, currently `https://<project>.pages.dev`

Required credentials/capabilities:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- ability to update Git deploy tags in the origin repository

Current environment/config checks still present in CI:

- `WEBAPP_VITE_GRAPHQL_HTTP`
- `WEBAPP_VITE_GRAPHQL_WS`

Note:

- these Vite variables are currently validated in the deploy job even though the release artifact is already built
- Phase 1 should preserve current behavior first, then later decide whether those checks belong in packaging instead of deployment

Current side effects and steps to preserve:

- materialize the packaged frontend artifact
- verify required Cloudflare configuration
- deploy the built frontend to Cloudflare Pages
- validate deployed routes
- update `deploy/prod/webapp`

Current GitHub-specific piece that should be replaced or wrapped portably:

- `cloudflare/wrangler-action@v3`

Portable direction:

- executor installs or receives `wrangler` and runs `wrangler pages deploy ...` directly
- route validation stays as a portable shell or Node step

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
- The repository has enough planner functionality to back a first-class `plan-deploy` CI job.

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
- [ ] Add a first-class `plan-deploy` job after `package`.
- [ ] Make `plan-deploy`:
  - call Dagger planning
  - emit or persist the computed deployment plan
  - fail fast if the service mesh or selected targets are invalid
- [ ] Replace separate deploy orchestration jobs with a single `deploy` job that depends on `plan-deploy`.
- [ ] In that `deploy` job:
  - download required artifacts
  - set up required secrets/env vars
  - call `dagger` to run `deploy-release`
- [ ] Keep the deploy job focused on execution, not planning.
- [ ] Remove GitHub-specific ordering logic from `.github/workflows/ci-release.yaml`.
- [ ] Remove `always()` / skipped-job orchestration workarounds once Dagger is authoritative.
- [ ] Keep manual release entrypoints, but make them feed the Dagger-backed release path.

Stop point:

- GitHub Actions now exposes `detect -> package -> plan-deploy -> deploy`, and Dagger owns deployment ordering.

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
