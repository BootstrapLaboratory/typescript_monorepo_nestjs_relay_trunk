# Release Flow Notes

This repository uses GitHub Actions as the outer CI shell and Dagger as the
release orchestrator.

## Entry Points

- Automatic releases run through
  [ci-release.yaml](../../.github/workflows/ci-release.yaml) on pushes to
  `main`.
- Manual target-scoped releases use the wrapper workflows:
  - [deploy-server.yaml](../../.github/workflows/deploy-server.yaml)
  - [deploy-webapp.yaml](../../.github/workflows/deploy-webapp.yaml)

Both wrapper workflows call the same reusable release workflow with different
`force_targets_json` inputs.

Example invocation from another CI provider:

- [GitLabReleaseExample.md](./GitLabReleaseExample.md)
- [../../examples/gitlab/ci-release.gitlab-ci.yml](../../examples/gitlab/ci-release.gitlab-ci.yml)

## Job Graph

The current GitHub Actions release graph is:

1. `detect`
2. `package`
3. `deploy`

Responsibilities by job:

- `detect` computes the canonical
  [../../.dagger/runtime/ci-plan.json](../../.dagger/runtime/ci-plan.json)
  handoff file by calling Dagger `detect`, then derives thin GitHub scheduling
  outputs from that file.
- `validate` restores `ci-plan.json` after checkout and reads validation scope
  from the file instead of treating GitHub job outputs as its primary contract.
- `package` calls Dagger to build and package selected deploy targets, exports
  the packaged workspace, and uploads deploy artifacts after restoring
  `ci-plan.json`.
- `deploy` restores `ci-plan.json`, downloads the packaged artifacts, prepares
  cloud configuration and credentials, writes one flat deploy env file, and
  calls `deploy-release`. Dagger computes and logs the deployment plan
  internally before executing it.

## Deploy Artifacts

- `server` is packaged into
  [common/deploy/server](../../common/deploy/server) and uploaded as an archive
  before deployment.
- `webapp` is packaged as the prebuilt
  [apps/webapp/dist](../../apps/webapp/dist) directory.

Dagger owns build and package materialization. GitHub Actions remains the
provider-specific artifact upload adapter.

## Dagger Responsibilities

[dagger/src/index.ts](../../dagger/src/index.ts) exposes the deploy-flow
entrypoints:

- `build-deploy-targets` reads `ci-plan.json` and runs the generic Rush
  verify/lint/test/build stage for selected deploy targets.
- `package-deploy-targets` reads `ci-plan.json`, materializes deploy artifacts
  from `.dagger/package` metadata, and writes `package-manifest.json`.
- `build-and-package-deploy-targets` composes those two stages for CI so the
  packaged workspace can be exported once.
- `deploy-release` executes the release through one generic target runtime
  path. Planning stays internal to `deploy-release`, which computes and logs
  deployment waves before executing them.

The Dagger build and package entrypoints return a workspace `Directory`.
GitHub exports the packaged workspace before using provider-specific artifact
upload steps.

Deployment order comes from
[.dagger/deploy/services-mesh.yaml](../../.dagger/deploy/services-mesh.yaml), so
target ordering stays in one canonical place.

Target-specific deploy metadata comes from:

- [.dagger/deploy/targets/server.yaml](../../.dagger/deploy/targets/server.yaml)
- [.dagger/deploy/targets/webapp.yaml](../../.dagger/deploy/targets/webapp.yaml)

Those target YAML files define:

- `deploy_script`
- runtime image/toolchain preparation
- env pass-through and static env
- file mounts
- dry-run defaults and host-env requirements

Deploy artifact locations come from the package-stage handoff file
`.dagger/runtime/package-manifest.json`. `deploy-release` reads the manifest
and sets `ARTIFACT_PATH` from each artifact's `deploy_path`.

## Runtime Contract

`deploy-release` still calls the portable target scripts directly:

- [scripts/ci/deploy-server.sh](../../scripts/ci/deploy-server.sh)
- [scripts/ci/deploy-webapp.sh](../../scripts/ci/deploy-webapp.sh)

GitHub passes release runtime values through one flat `KEY=VALUE` file:

- `dagger-deploy.env`

That file carries:

- 1:1 runtime env values such as `CLOUD_RUN_REGION`
- host-side mount sources such as `GOOGLE_GHA_CREDS_PATH`

For file-backed mounts, the workflow also passes `--host-workspace-dir` to
`deploy-release`. That lets Dagger strip the checked-out workspace prefix from
absolute host file paths and mount them from the repository context with
`repo.file(...)` instead of requiring CI-side path rewriting.

Docker socket handling is a shared special case instead of target YAML
metadata. The wrapper passes
`--docker-socket=/var/run/docker.sock` directly to `deploy-release`.

Current target behavior:

- `server` runs dist migrations, builds and pushes the backend image, deploys
  Cloud Run, runs post-deploy smoke tests, and updates the deploy tag.
- `webapp` publishes the prebuilt frontend with Wrangler, validates the
  deployed routes, and updates the deploy tag.

Dry-run is generic for every target. Instead of target-specific dry-run code,
the Dagger runtime prints a summary of:

- target name
- deploy script path
- artifact path
- runtime image
- install commands
- env keys being exposed
- file mounts being attached
- whether the shared Docker socket is attached

## Operational Notes

- The committed GraphQL contract is enforced during the Dagger build stage by
  the server project's Rush `verify` script.
- The reusable
  [ci-release.yaml](../../.github/workflows/ci-release.yaml) workflow is the
  operational source of truth for GitHub releases.
- GitHub Actions remains the trigger, artifact upload adapter, and credentials
  boundary. Dagger owns deploy-target build/package materialization,
  deployment ordering, and release execution.
