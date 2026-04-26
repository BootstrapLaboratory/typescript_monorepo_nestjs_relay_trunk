# Provider Adapters

Rush Delivery keeps provider behavior behind explicit adapters. Local use works
with providers off; CI can opt into adapters by passing provider names and
credentials.

## Source Providers

`sourceMode=local_copy` copies the caller-provided `repo` directory into a
Dagger-owned workspace. This is the default for local development and requires
no source credential.

`sourceMode=git` clones or fetches the source from provider-neutral coordinates:

- `sourceRepositoryUrl`
- `sourceRef`
- `gitSha`
- `prBaseSha` when validating pull requests
- `sourceAuthTokenEnv` when private source access is required

The token value is read from the deploy environment file, not printed in logs.

## Toolchain Image Providers

`toolchainImageProvider=off` builds toolchain containers inside the current
Dagger run.

`toolchainImageProvider=github` uses GitHub Container Registry as an OCI image
store for content-addressed toolchain images. Image references are derived from
normalized runtime specs and provider metadata.

Use `toolchainImagePolicy=lazy` to pull an existing image or build and publish a
missing one.

## Rush Cache Providers

`rushCacheProvider=off` keeps Rush install behavior local to the current Dagger
engine.

`rushCacheProvider=github` stores a compressed Rush install cache archive in a
GHCR image. Cache keys are derived from configured metadata, key file contents,
cache paths, and the Rush workflow toolchain identity.

Use `rushCachePolicy=lazy` to restore an existing cache or publish a missing
cache after a successful install.

## Deploy Providers

Deploy providers are target-level concerns. A target runtime decides what
environment variables, file mounts, static env values, workspace paths, and
tooling it needs through deploy target metadata.

The framework only passes allowlisted data into each target runtime.

## CI Provider Responsibilities

A CI provider should provide:

- Dagger CLI availability.
- Source coordinates for Git source mode.
- A deploy environment file with provider credentials and project settings.
- Optional Docker socket for targets that build container images.
- Permissions for any selected provider adapters.

The CI provider should not compute deploy plans, package artifacts, update
deploy tags, or encode target-specific behavior.
