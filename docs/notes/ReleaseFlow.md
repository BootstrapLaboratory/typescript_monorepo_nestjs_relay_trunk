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
3. `plan-deploy`
4. `deploy`

Responsibilities by job:

- `detect` computes `validate_targets_json` and `release_targets_json`.
- `package` installs dependencies, verifies the committed GraphQL contract when
  `server` is in scope, builds the selected targets, and uploads deploy
  artifacts.
- `plan-deploy` prepares the Dagger module and calls `plan-release` against
  [.dagger/deploy/services-mesh.yaml](../../.dagger/deploy/services-mesh.yaml).
- `deploy` downloads the packaged artifacts, prepares cloud configuration and
  credentials, writes one flat deploy env file, and calls `deploy-release`.

The `plan-deploy -> deploy` split keeps deployment planning and execution
separate in workflow logs and job boundaries.

## Release Artifacts

- `server` is packaged into
  [common/deploy/server](../../common/deploy/server) and uploaded as an archive
  before deployment.
- `webapp` is packaged as the prebuilt
  [apps/webapp/dist](../../apps/webapp/dist) directory.

GitHub Actions currently owns packaging. Dagger consumes those packaged outputs
during deployment.

## Dagger Responsibilities

[dagger/src/index.ts](../../dagger/src/index.ts) exposes the release entrypoints:

- `plan-release` computes deployment waves from the selected targets and the
  services mesh.
- `deploy-release` executes those waves through one generic target runtime path.

Deployment order comes from
[.dagger/deploy/services-mesh.yaml](../../.dagger/deploy/services-mesh.yaml), so
target ordering stays in one canonical place.

Target-specific deploy metadata comes from:

- [.dagger/deploy/targets/server.yaml](../../.dagger/deploy/targets/server.yaml)
- [.dagger/deploy/targets/webapp.yaml](../../.dagger/deploy/targets/webapp.yaml)

Those target YAML files define:

- `deploy_script`
- `artifact_path`
- runtime image/toolchain preparation
- env pass-through and static env
- file/socket mounts
- dry-run defaults and host-env requirements

## Runtime Contract

`deploy-release` still calls the portable target scripts directly:

- [scripts/ci/deploy-server.sh](../../scripts/ci/deploy-server.sh)
- [scripts/ci/deploy-webapp.sh](../../scripts/ci/deploy-webapp.sh)

GitHub passes release runtime values through one flat `KEY=VALUE` file:

- `dagger-deploy.env`

That file carries:

- 1:1 runtime env values such as `CLOUD_RUN_REGION`
- host-side mount sources such as `GOOGLE_GHA_CREDS_PATH`
- wrapper-specific runtime paths such as `DOCKER_SOCKET_FILE`

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
- file and socket mounts being attached

## Operational Notes

- The committed GraphQL contract is enforced during `package` whenever `server`
  is in the release scope.
- The reusable
  [ci-release.yaml](../../.github/workflows/ci-release.yaml) workflow is the
  operational source of truth for GitHub releases.
- GitHub Actions remains the trigger, packaging host, and credentials boundary.
  Dagger owns deployment ordering and release execution.
