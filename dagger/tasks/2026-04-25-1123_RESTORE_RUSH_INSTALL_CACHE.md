# Restore Rush Install Cache

## Context

The old GitHub composite action
[`cached-install`](../../.github/actions/cached-install/action.yaml) restored
and saved the Rush install cache with GitHub Actions cache. It cached exactly:

- `common/temp/install-run`
- `common/temp/node_modules`
- `common/temp/pnpm-store`

The Dagger implementation had mounted Dagger cache volumes over Rush cache
paths. That helps only when the Dagger Engine cache survives long enough. On
standard GitHub-hosted runners, the Dagger Engine is effectively fresh for a
new workflow run, so these volumes do not reproduce the old cross-run cache hit
behavior.

## References

- Dagger built-in caching: `https://docs.dagger.io/features/caching/`
- Dagger cache volumes: `https://docs.dagger.io/extending/cache-volumes/`
- Dagger Directory host export behavior:
  `https://docs.dagger.io/getting-started/types/directory/`
- Dagger and GitHub stock runner cache limitation:
  `https://dagger.io/blog/dagger-and-depot/`

## Findings

- The existing composite action already does the complete GitHub cache cycle:
  restore, run Rush install, and save on cache miss.
- Dagger cache volumes alone are not enough for the current GitHub-hosted runner
  path because the engine cache does not persist between workflow runs.
- Mounting empty Dagger cache volumes over `common/temp` can hide the
  host-restored Rush cache and make the GitHub cache ineffective.
- GitHub CI confirmed `common/temp` is visible to Dagger, but importing the
  host-restored Rush bootstrap cache caused Rush to fail with an `EXDEV`
  cross-device rename when cleaning `common/temp/install-run`.
- Dagger should preserve host-restored dependency cache paths, but drop
  `common/temp/install-run` and `common/temp/rush-recycler` from its workspace
  so Rush can recreate bootstrap state inside the container layer.
- Toolchain prebuilt images should not carry Rush install cache data. Toolchain
  images are for OS/runtime tools; Rush install caches are project lockfile
  state and should remain cache data.

## Goal

Restore the old cross-run Rush install cache behavior by running the existing
GitHub composite cache action before the Dagger workflow, while keeping Dagger's
Rush install path free of non-persistent cache-volume mounts.

## Proposed Design

Use the existing GitHub adapter shape:

1. Restore `rush-bootstrap-*` and `rush-deps-*` with `actions/cache/restore`.
2. Run `node common/scripts/install-run-rush.js install --max-install-attempts
   1` on the host.
3. Save cache entries on misses with `actions/cache/save`.
4. Call the normal Dagger `workflow`.

This keeps GitHub-specific cache storage in workflow YAML and avoids putting
GitHub cache APIs inside the Dagger framework.

## Non-Goals

- Do not store Rush dependency caches in GHCR toolchain images.
- Do not require GitHub Actions cache for local development.
- Do not make Dagger depend on GitHub-specific cache APIs internally.
- Do not solve self-hosted runner persistent Dagger cache in this task; that is
  a separate runner infrastructure task.
- Do not introduce a new Dagger `installRushCached` API until we know we need
  Dagger to own cache restore/save directly.

## Implementation Checklist

### Phase 1: Restore GitHub Cache Adapter

- [x] Re-add Node setup before the Dagger workflow.
- [x] Re-add `.github/actions/cached-install` before the Dagger workflow.
- [x] Keep cache restore/save behavior in the existing composite action.

### Phase 2: Remove Non-Persistent Dagger Cache Mounts

- [x] Remove Rush Dagger cache-volume mounts from `rush/container.ts`.
- [x] Keep `installRush` as the single Dagger-side Rush install command.
- [x] Confirm Dagger receives the host-warmed `common/temp` paths in GitHub CI.
- [x] Strip host-restored Rush bootstrap/recycler state from Dagger Rush
  containers.

### Phase 3: Validation

- [x] Run Dagger unit tests.
- [x] Run Dagger typecheck.
- [x] Run `dagger call self-check --repo=..`.
- [x] Run a local Dagger host-directory probe for `common/temp`.
- [x] Run a local Dagger workflow dry-run with host `common/temp` present.
- [ ] Run GitHub CI once and confirm cache restore/save works without `EXDEV`.
- [ ] Run GitHub CI again and confirm Rush install cache hits reduce runtime.
