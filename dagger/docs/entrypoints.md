# Entrypoints Reference

Run commands from the [`dagger`](..) directory unless noted otherwise.

## `workflow`

The main release composition. It resolves source, validates metadata, detects
targets, builds, packages, and deploys selected targets.

Use it for normal CI release runs and local release dry-runs.

```sh
dagger call workflow \
  --repo=.. \
  --git-sha="$GIT_SHA" \
  --event-name=push \
  --dry-run=false \
  --deploy-env-file="$DEPLOY_ENV_FILE" \
  --source-mode=git \
  --source-repository-url="$SOURCE_REPOSITORY_URL" \
  --source-ref="$SOURCE_REF"
```

Returns a text deployment summary.

## `validate`

Runs Dagger-owned validation for affected Rush projects. It can also run
target-specific validation metadata such as backing services, migrations, server
startup, and smoke tests.

Use it for pull-request validation paths or local validation experiments.

```sh
dagger call validate \
  --repo=.. \
  --event-name=pull_request \
  --pr-base-sha="$PR_BASE_SHA"
```

Returns a validation summary.

## `detect`

Computes the canonical CI plan JSON. The plan includes mode, validation targets,
deploy targets, and affected projects by deploy target.

Use it when a CI provider intentionally runs split stages. The `workflow`
entrypoint already calls it internally.

```sh
dagger call detect \
  --repo=.. \
  --event-name=push \
  --force-targets-json='[]' \
  --deploy-tag-prefix=deploy/prod
```

Returns JSON intended for Dagger stage handoff.

## `build-deploy-targets`

Runs the generic Rush build stage for deploy targets selected by a CI plan file.

Use it only in split-stage workflows where build is separated from package and
deploy.

```sh
dagger call build-deploy-targets \
  --repo=.. \
  --ci-plan-file="$CI_PLAN_FILE"
```

Returns a Dagger directory containing the built workspace.

## `package-deploy-targets`

Materializes deploy artifacts for targets selected by a CI plan file. Package
behavior is driven by `.dagger/package/targets`.

Use it only in split-stage workflows after build outputs already exist.

```sh
dagger call package-deploy-targets \
  --repo=.. \
  --ci-plan-file="$CI_PLAN_FILE" \
  --artifact-prefix=deploy-target
```

Returns a Dagger directory containing packaged artifacts and a package manifest.

## `build-and-package-deploy-targets`

Runs build and package as separate logical stages, then exports the final
packaged workspace once.

Use it when a split workflow needs build and package together but deploy later.

```sh
dagger call build-and-package-deploy-targets \
  --repo=.. \
  --ci-plan-file="$CI_PLAN_FILE" \
  --artifact-prefix=deploy-target
```

Returns a Dagger directory containing packaged artifacts and a package manifest.

## `deploy-release`

Deploys selected targets from an already packaged workspace. It executes deploy
targets in service-mesh wave order and can use a package manifest to resolve
artifact paths.

Use it for split-stage workflows, deploy-only retries, or tests around deploy
metadata.

```sh
dagger call deploy-release \
  --repo=.. \
  --git-sha="$GIT_SHA" \
  --release-targets-json='["server","webapp"]' \
  --environment=prod \
  --dry-run=false \
  --deploy-env-file="$DEPLOY_ENV_FILE" \
  --package-manifest-file="$PACKAGE_MANIFEST_FILE"
```

Returns a text deployment summary.

## `self-check`

Runs the framework health check: Dagger module typecheck, unit tests, and
metadata contract validation.

Use it before changing framework source, schemas, or `.dagger/` metadata.

```sh
dagger call self-check --repo=..
```

Returns a self-check summary and metadata contract output.

## `validate-metadata-contract`

Checks cross-file metadata consistency without running release stages.

Use it when editing `.dagger/` metadata and wanting a fast contract check.

```sh
dagger call validate-metadata-contract --repo=..
```

Returns formatted metadata contract JSON.

## `describe-release-targets`

Validates and normalizes a release target JSON array.

Use it for quick checks around manual target input.

```sh
dagger call describe-release-targets --release-targets-json='["server"]'
```

Returns a short text description.

## `ping`

Returns a simple readiness marker.

Use it only to verify that the module is callable.

```sh
dagger call ping
```
