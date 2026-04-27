# Release Flow Notes

This repository uses GitHub Actions as the outer CI shell and the external Rush
Delivery Dagger module as the release and validation orchestrator.

## Entry Points

- Automatic releases run through
  [ci-release.yaml](../../.github/workflows/ci-release.yaml) on pushes to
  `main`.
- Pull-request validation runs through
  [ci-validate.yaml](../../.github/workflows/ci-validate.yaml).
- Manual target-scoped releases use the wrapper workflows:
  - [deploy-server.yaml](../../.github/workflows/deploy-server.yaml)
  - [deploy-webapp.yaml](../../.github/workflows/deploy-webapp.yaml)

Both wrapper workflows call the same reusable release workflow with different
`force_targets_json` inputs.

The GitHub release workflow uses:

```yaml
uses: BootstrapLaboratory/rush-delivery@v0.3.2
```

The pull-request validation workflow calls the same released module directly:

```bash
dagger -m github.com/BootstrapLaboratory/rush-delivery@v0.3.2 call validate
```

Framework implementation details live upstream in
`BootstrapLaboratory/rush-delivery`. This repository owns the `.dagger`
metadata and provider scripts that describe this app.

## Job Graph

The current GitHub Actions release graph is:

1. `dagger-workflow`

Responsibilities:

- GitHub authenticates to Google Cloud when server deployment may be needed.
- The Rush Delivery action prepares runtime files, writes the deploy env file,
  installs the Dagger CLI, and invokes the external module.
- Rush Delivery acquires the source, validates metadata, computes the CI plan,
  builds selected deploy targets, materializes deploy artifacts, writes the
  package manifest, computes the deployment plan, and executes it.

The current GitHub Actions validation graph is:

1. `dagger-validate`

Responsibilities:

- GitHub checks out the repository so the validation command can pass `--repo=.`
  to the external module.
- Rush Delivery computes affected Rush projects for pull requests, runs Rush
  `verify`, `lint`, `test`, and `build` for those projects, and executes
  optional validation metadata under `.dagger/validate`.
- The validation workflow intentionally avoids deploy credentials, provider
  secrets, deploy env files, and Docker socket setup.

## Deploy Artifacts

- `server` is materialized with `rush deploy` into
  [common/deploy/server](../../common/deploy/server), archived as a package
  artifact, and exposed to deploy through `.dagger/runtime/package-manifest.json`.
- `webapp` is packaged as the prebuilt
  [apps/webapp/dist](../../apps/webapp/dist) directory and exposed through the
  same package manifest.

Rush Delivery owns build and package materialization. GitHub Actions remains
the provider-specific bootstrap and credentials adapter.

## Rush Delivery Responsibilities

Rush Delivery exposes reusable Dagger entrypoints upstream:

- `workflow` composes detect, build, package, and deploy in one Dagger
  invocation.
- `build-deploy-targets`, `package-deploy-targets`, and
  `build-and-package-deploy-targets` remain available for focused debugging.
- `deploy-release` executes a release through generic target runtime metadata.
- `validate` runs Dagger-owned pull-request validation for affected Rush
  projects and optional repository-owned validation scenarios.
- `validate-metadata-contract` validates the cross-file Rush and `.dagger`
  metadata contract before expensive workflow stages run.

Deployment order comes from
[.dagger/deploy/services-mesh.yaml](../../.dagger/deploy/services-mesh.yaml), so
target ordering stays in one canonical place.

The local metadata contract is documented in
[DaggerFrameworkContract.md](./DaggerFrameworkContract.md). Use it when adding
or changing deploy, package, or validation targets.

Target-specific deploy metadata comes from:

- [.dagger/deploy/targets/server.yaml](../../.dagger/deploy/targets/server.yaml)
- [.dagger/deploy/targets/webapp.yaml](../../.dagger/deploy/targets/webapp.yaml)

Those target YAML files define:

- `deploy_script`
- runtime image/toolchain preparation
- workspace files mounted into the runtime
- env pass-through and static env
- runtime file mounts
- dry-run defaults and host-env requirements

Deploy artifact locations come from the package-stage handoff file
`.dagger/runtime/package-manifest.json`. `deploy-release` reads the manifest
and sets `ARTIFACT_PATH` from each artifact's `deploy_path`.

## Runtime Contract

`deploy-release` calls the portable target scripts directly:

- [deploy/cloudrun/scripts/deploy-server.sh](../../deploy/cloudrun/scripts/deploy-server.sh)
- [deploy/cloudflare-pages/scripts/deploy-webapp.sh](../../deploy/cloudflare-pages/scripts/deploy-webapp.sh)

GitHub passes release runtime values through the Rush Delivery action's
`deploy-env` input. The action turns that multiline `KEY=VALUE` block into the
flat env file consumed by the module.

Credential files are passed through `runtime-file-map`. In this app the Google
credentials file is copied to `gcp-credentials.json`, and server deploy
metadata mounts that runtime file into the server executor.

Docker socket handling is a shared special case instead of target YAML
metadata. The action passes `/var/run/docker.sock` to the workflow by default,
and Rush Delivery forwards it to deploy execution when needed.

Current target behavior:

- `server` runs dist migrations, builds and pushes the backend image, deploys
  Cloud Run, and runs post-deploy smoke tests.
- `webapp` publishes the prebuilt frontend with Wrangler and validates the
  deployed routes.
- Rush Delivery updates `deploy/<environment>/<target>` after the corresponding
  target script succeeds.

Dry-run is generic for every target. Instead of target-specific dry-run code,
the runtime prints a summary of:

- target name
- deploy tag
- deploy script path
- artifact path
- runtime image
- install commands
- env keys being exposed
- runtime file mounts being attached
- whether the shared Docker socket is attached

## Pull-Request Validation

Pull-request validation is intentionally separate from release execution:

- [ci-validate.yaml](../../.github/workflows/ci-validate.yaml) runs on
  `pull_request` with `contents: read`.
- It passes `github.event.pull_request.base.sha` to Rush Delivery so the Rush
  affected project list is computed inside the reusable module.
- It does not pass deploy credentials, cloud provider secrets, deploy env files,
  or Docker socket access.

Validation target metadata lives under:

- [.dagger/validate/targets](../../.dagger/validate/targets)

If a Rush project has no validation metadata, Rush `verify`, `lint`, `test`,
and `build` are the full validation for that project. When metadata exists,
Rush Delivery runs it generically: backing services, ordered command steps,
foreground service steps, per-step environment, and service bindings are all
declared by YAML instead of hardcoded in this repository.

## Adding A Deploy Target

To add a deployable Rush project, keep the framework generic and add metadata.
The full checklist is in
[DaggerFrameworkContract.md](./DaggerFrameworkContract.md).

After editing metadata, run from the repository root:

```bash
dagger -m github.com/BootstrapLaboratory/rush-delivery@v0.3.2 call validate-metadata-contract --repo=.
```

## Operational Notes

- The committed GraphQL contract is enforced during the Rush Delivery build
  stage by the server project's Rush `verify` script.
- The reusable
  [ci-release.yaml](../../.github/workflows/ci-release.yaml) workflow is the
  operational source of truth for GitHub releases.
- GitHub Actions remains the trigger, cloud credentials, and host-runtime
  boundary. Rush Delivery owns source acquisition, deploy-target detection,
  build/package materialization, deployment ordering, and release execution.
- Pull-request validation is Dagger-owned through
  [ci-validate.yaml](../../.github/workflows/ci-validate.yaml) instead of a
  split-job GitHub artifact handoff.
