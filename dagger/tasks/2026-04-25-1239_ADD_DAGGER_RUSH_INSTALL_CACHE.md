# Add Dagger Rush Install Cache

## Context

The old GitHub composite action
[`cached-install`](../../.github/actions/cached-install/action.yaml) restored
Rush install cache paths, ran Rush install, and saved updated cache paths with
GitHub Actions cache.

That cache behavior should move fully into Dagger. The release workflow should
not split Rush install ownership between GitHub workflow YAML and Dagger module
code. GitHub may provide credentials for a storage provider, but Dagger should
own cache keying, restore, install, save, and how the installed Rush container
is passed to later workflow stages.

## Decision

Implement Dagger-owned Rush install caching using provider adapters.

The first CI provider is GitHub Container Registry. Dagger will publish and pull
Rush install cache images from GHCR. Local/default behavior stays provider-off
and uses Dagger cache volumes only within the current Dagger engine.

The cache must not restore host files into `/workspace/common/temp`. Dagger
should run Rush with `RUSH_TEMP_FOLDER` pointed at a Dagger-owned cache path
under the gitignored runtime area, for example
`/workspace/.dagger/runtime/rush-cache/temp`. This keeps Rush dependency
symlink targets under `/workspace` for `rush deploy`, while still avoiding the
old host-restored `common/temp/install-run` path.

## Proposed Metadata

Add provider metadata under:

```text
.dagger/rush-cache/providers.yaml
```

Initial shape:

```yaml
cache:
  version: v1
  key_files:
    - rush.json
    - common/config/rush/pnpm-lock.yaml
    - common/config/rush/pnpm-config.json
    - common/config/rush/version-policies.json
  paths:
    - /workspace/.dagger/runtime/rush-cache/temp
providers:
  github:
    kind: github_container_registry
    registry: ghcr.io
    image_namespace: rush-delivery-caches
    repository_env: GITHUB_REPOSITORY
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
```

Add a JSON schema under:

```text
.dagger/schemas/rush-cache-providers.schema.json
```

## Proposed Dagger API

Add workflow parameters:

```text
--rush-cache-provider=off|github
--rush-cache-policy=lazy
```

Default provider should be `off` so local runs and provider-independent users do
not need registry credentials.

Initial policy should be `lazy`:

- Try to pull an existing cache image.
- If the cache image exists, use it as the Rush install cache source.
- If the cache image is missing, run Rush install from a clean cache path.
- If provider is `github` and the cache image is missing, publish the resulting
  cache image after successful Rush install.
- If publish fails for provider `github`, fail the workflow so permission
  problems are visible.

## Cache Key

The Rush install cache key should be content-addressed from normalized inputs:

- Rush cache schema version.
- Rush workflow toolchain image identity/hash.
- Configured `cache.key_files` contents.
- Configured `cache.paths`.

The cache inputs should be configurable, but the cache algorithm should remain
framework-owned:

- Repositories may adjust `cache.key_files` when their Rush install behavior is
  affected by additional files.
- Repositories may adjust `cache.paths` when Rush or package-manager cache
  paths change.
- Dagger always normalizes metadata, file contents, paths, and toolchain
  identity into a deterministic hash.
- Dagger owns restore, install, and publish behavior. Do not expose custom key
  templates or per-target cache mechanics in this task.

The output tag should use the same style as toolchain images:

```text
sha256-<short-hash>
```

Default GHCR reference:

```text
ghcr.io/<owner>/<repo>/rush-delivery-caches/rush-install:<hash>
```

## Implementation Checklist

### Phase 1: Metadata And Model

- [x] Add `.dagger/rush-cache/providers.yaml`.
- [x] Add `.dagger/schemas/rush-cache-providers.schema.json`.
- [x] Add TypeScript model types for Rush cache provider metadata.
- [x] Add parser tests for provider metadata.
- [x] Validate configurable `cache.key_files` and `cache.paths`.
- [x] Include Rush cache provider metadata in self-check/schema validation.

### Phase 2: Cache Spec And Keying

- [x] Add a normalized Rush install cache spec model.
- [x] Hash configured `cache.key_files`, configured `cache.paths`, and Rush
  workflow toolchain identity.
- [x] Add tests proving hash stability and invalidation on lockfile/config
  changes.
- [x] Add tests proving configured cache path changes invalidate the cache.
- [x] Generate provider-specific cache image references.

### Phase 3: Dagger Cache Resolver

- [x] Implement provider `off` using Dagger cache volume behavior only.
- [x] Implement provider `github` using GHCR pull/build/publish.
- [x] Reuse the existing GitHub registry-auth pattern from toolchain images
  where possible.
- [x] Use a Dagger-owned `RUSH_TEMP_FOLDER` under
  `/workspace/.dagger/runtime/rush-cache/temp` for Rush commands.
- [x] Ensure no host-restored `common/temp` paths are required by Dagger.

### Phase 4: Workflow Integration

- [x] Add `rushCacheProvider` and `rushCachePolicy` parameters to public
  workflow APIs.
- [x] Make detect/build/package share the installed Rush container returned by
  the cache resolver.
- [x] Remove `.github/actions/cached-install` from `ci-release.yaml`.
- [x] Remove Node setup from `ci-release.yaml` if it is only needed by the old
  host-side cache action.
- [x] Pass GitHub credentials only through the existing Dagger deploy env file.

### Phase 5: Validation

- [x] Run Dagger unit tests.
- [x] Run Dagger typecheck.
- [x] Run `dagger call self-check --repo=..`.
- [ ] Run local provider-off workflow dry-run.
- [ ] Run GitHub CI once and confirm the cache image is published on miss.
- [ ] Run GitHub CI again and confirm the cache image is reused on hit.
- [ ] Confirm `.github/actions/cached-install` is unused by release workflow.

## Non-Goals

- Do not call GitHub Actions cache APIs from Dagger in this task.
- Do not require GitHub Actions cache for release workflow performance.
- Do not cache deploy executor toolchains here; those are handled by
  toolchain-images.
- Do not make GHCR the only possible provider. It is the first provider adapter,
  not the framework abstraction.
