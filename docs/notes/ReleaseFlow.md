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

1. `dagger-workflow`

Responsibilities:

- GitHub checks out the repository, fetches deploy tags, installs the Dagger
  CLI, prepares provider credentials, writes one flat deploy env file, and
  calls Dagger `workflow`.
- Dagger `workflow` computes the CI plan, builds selected deploy targets,
  materializes deploy artifacts, writes the package manifest, computes the
  deployment plan, and executes it.

The previous split-job workflow that used GitHub artifact upload/download as
the stage handoff is preserved as
[../../examples/github/ci-release.split-jobs.yaml](../../examples/github/ci-release.split-jobs.yaml).

## Deploy Artifacts

- `server` is packaged into
  [common/deploy/server](../../common/deploy/server) and uploaded as an archive
  before deployment.
- `webapp` is packaged as the prebuilt
  [apps/webapp/dist](../../apps/webapp/dist) directory.

Dagger owns build and package materialization. GitHub Actions remains the
provider-specific bootstrap and credentials adapter.

## Dagger Responsibilities

[dagger/src/index.ts](../../dagger/src/index.ts) exposes the deploy-flow
entrypoints:

- `workflow` composes detect, build, package, and deploy in one Dagger
  invocation.
- `build-deploy-targets` reads `ci-plan.json` and runs the generic Rush
  verify/lint/test/build stage for selected deploy targets.
- `package-deploy-targets` reads `ci-plan.json`, materializes deploy artifacts
  from `.dagger/package` metadata, and writes `package-manifest.json`.
- `build-and-package-deploy-targets` composes those two stages for CI so the
  packaged workspace can be exported once.
- `deploy-release` executes the release through one generic target runtime
  path. Planning stays internal to `deploy-release`, which computes and logs
  deployment waves before executing them.

The Dagger build and package entrypoints still exist for focused local or
debugging calls. The operational GitHub release workflow now uses the composed
`workflow` entrypoint.

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

- [deploy/cloudrun/scripts/deploy-server.sh](../../deploy/cloudrun/scripts/deploy-server.sh)
- [deploy/cloudflare-pages/scripts/deploy-webapp.sh](../../deploy/cloudflare-pages/scripts/deploy-webapp.sh)

GitHub passes release runtime values through one flat `KEY=VALUE` file:

- `dagger-deploy.env`

That file carries:

- 1:1 runtime env values such as `CLOUD_RUN_REGION`
- host-side mount sources such as `GOOGLE_GHA_CREDS_PATH`

For file-backed mounts, the workflow also passes `--host-workspace-dir` to
the Dagger `workflow` entrypoint. That lets Dagger strip the checked-out
workspace prefix from absolute host file paths and mount them from the
repository context with `repo.file(...)` instead of requiring CI-side path
rewriting.

Docker socket handling is a shared special case instead of target YAML
metadata. The wrapper passes `--docker-socket=/var/run/docker.sock` directly to
the Dagger `workflow` entrypoint, which forwards it to deploy execution.

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
- GitHub Actions remains the trigger, checkout, credentials, and host-runtime
  boundary. Dagger owns deploy-target detection, build/package materialization,
  deployment ordering, and release execution.
- Pull-request validation from the previous split-job workflow is not yet part
  of the composed Dagger workflow. The preserved split-job example remains the
  reference for that older validation shape until a Dagger-owned validation
  design is added.
