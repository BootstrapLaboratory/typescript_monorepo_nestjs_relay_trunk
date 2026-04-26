# Public Dagger API

Run commands from the [`dagger`](..) directory unless noted otherwise.

## Entrypoints

`workflow` is the normal release orchestrator. It resolves source, validates
metadata, computes the CI plan, builds selected deploy targets, packages their
artifacts, and deploys them in dependency order.

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

`self-check` is the framework health check. It runs the Dagger module
typecheck, unit tests, and metadata contract validation.

```sh
dagger call self-check --repo=..
```

`validate` runs pull-request validation for affected Rush projects and any
target-specific validation metadata.

```sh
dagger call validate \
  --repo=.. \
  --event-name=pull_request \
  --pr-base-sha="$PR_BASE_SHA"
```

See [Entrypoints reference](entrypoints.md) for every callable function,
including separate `detect`, `build`, `package`, `deploy`, metadata validation,
and diagnostic entrypoints.

## Key Inputs

`repo` is the Dagger module/repository directory. In local source mode the
framework copies it into a Dagger-owned workspace before running stages.

`gitSha` is the commit being validated or released.

`eventName`, `forceTargetsJson`, `prBaseSha`, and `deployTagPrefix` shape
detection. Forced targets are used by manual deploy wrappers.

`deployEnvFile` is a newline-delimited environment file. The framework reads it
once, then passes only target-allowed variables to runtime containers.

`sourceMode` is `local_copy` or `git`. Local mode needs no provider credential;
Git mode uses provider-neutral source coordinates.

`toolchainImageProvider` and `rushCacheProvider` are `off` by default. Provider
`github` enables GHCR-backed toolchain images or Rush install cache.

`dockerSocket` is optional. Live Cloud Run image builds need it; dry-runs and
non-Docker targets do not.

## Defaults

Local defaults favor portability: provider-off, dry-run enabled, and
`local_copy` source mode. CI should opt into provider adapters explicitly.
