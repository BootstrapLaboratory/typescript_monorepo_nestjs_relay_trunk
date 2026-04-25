# Add Toolchain Image Prebuilds

## Context

Several Dagger workflow stages create containers with repeated toolchain setup:
base image selection, OS package installation, CLI installation, and other
stage runtime preparation. Dagger caching already helps, but CI still pays for
some repeated setup and the workflow becomes slower when caches are cold.

We want reusable prebuilt toolchain images without making the Dagger framework
depend on GitHub. GitHub Container Registry should be one provider adapter,
while local development and other CI providers can use different adapters or
plain Dagger caching.

GitHub Container Registry is a viable first remote provider for GitHub Actions:
GitHub's documentation currently says Container Registry image storage and
bandwidth are free, and GitHub Actions can publish repository-associated
packages with `GITHUB_TOKEN` when workflow permissions include `packages:
write`.

## Goal

Add a provider-neutral toolchain image system that can lazily reuse, build, and
optionally publish prebuilt images for Dagger stage runtimes.

## Non-Goals

- Do not bake repository source, Rush build outputs, deploy artifacts, or
  secrets into prebuilt images.
- Do not make GitHub Container Registry part of the core framework model.
- Do not require remote image publishing for local development.

## Proposed Model

Introduce a normalized `ToolchainImageSpec` derived from stage/runtime metadata:

- base image
- ordered install commands
- static toolchain environment values that are safe to bake into the image
- framework version or schema version

The framework computes a stable content hash from the normalized spec. The hash
becomes the image tag, so image invalidation follows metadata/toolchain changes
instead of mutable names.

Provider behavior should be selected separately from stage metadata:

- `off`: always use the current Dagger container construction path.
- `github`: pull/build/push through GitHub Container Registry.
- future providers: generic OCI registry, GitLab registry, Google Artifact
  Registry, or other adapters.

Policy should be separate from provider:

- `lazy`: resolve an image only when a workflow stage needs it.
- `prewarm`: build or publish all known toolchain images before stages run.
- future cron/scheduled workflow: call prewarm periodically to keep images hot.

## Decisions

- Start with lazy resolution only.
- Start with `off` and `github` providers only.
- Store provider metadata under `.dagger/toolchain-images/providers.yaml`.
- Generate image specs from existing runtime metadata first; do not duplicate
  target toolchain configuration into new metadata.
- Use content-hash tags in the shape `sha256-<short-hash>`, derived from the
  normalized base image, install commands, and framework/schema version.
- Make image names configurable by provider metadata, with a default shape like
  `ghcr.io/<owner>/<repo>/rush-delivery-toolchains/<stage-or-target>:<hash>`.
- Optimize deploy executor toolchains first. Build/package toolchains can be
  added later after the deploy path proves the model.
- Require explicit opt-in for GHCR. No workflow should publish images unless it
  selects the GitHub provider.
- In `github` lazy mode, pull first. If the image is missing, build and push it
  during the normal workflow run. If push fails, fail the workflow so permission
  or registry configuration problems are visible.
- With provider `off`, keep the current local behavior and do not contact a
  registry.

## Proposed API Shape

Workflow-level parameters:

```ts
workflow({
  toolchainImageProvider: "github",
  toolchainImagePolicy: "lazy",
})
```

Provider metadata example:

```yaml
providers:
  github:
    kind: github_container_registry
    registry: ghcr.io
    namespace_env: GITHUB_REPOSITORY_OWNER
    repository_env: GITHUB_REPOSITORY
    token_env: GITHUB_TOKEN
```

Provider metadata location: `.dagger/toolchain-images/providers.yaml`.

## Implementation Checklist

### Phase 1: Lazy Deploy Toolchain Images

- [ ] Inventory every current Dagger container/runtime setup path and identify
      which ones are toolchain-image candidates.
- [ ] Define `ToolchainImageSpec` and its normalized/hashable representation.
- [ ] Add unit tests for stable hash generation and hash changes when toolchain
      inputs change.
- [ ] Add a provider-neutral image reference model.
- [ ] Implement `off` behavior with the current container construction path.
- [ ] Add provider metadata parsing and validation.
- [ ] Implement the GitHub Container Registry provider adapter.
- [ ] Add tests for GHCR image reference generation without contacting GitHub.
- [ ] Wire deploy executor stages to resolve toolchain images lazily.

### Phase 2: Follow-Up Toolchain Image Operations

- [ ] Add an optional `prewarm-images` Dagger entrypoint.
- [ ] Add docs for local usage, GitHub Actions usage, required permissions, and
      future cron prewarm usage.

## GitHub Actions Follow-Up

- [ ] Add `packages: write` only to workflows that publish prebuilt images.
- [ ] Pass `GITHUB_TOKEN`, `GITHUB_REPOSITORY_OWNER`, and `GITHUB_REPOSITORY`
      only when the GitHub provider is selected.
- [ ] Add a scheduled prewarm workflow after lazy usage is proven stable.
- [ ] Confirm image cleanup/retention strategy for old hash-tagged images.

## Validation

- [ ] Local workflow still works with image provider disabled.
- [ ] GitHub CI can pull an existing GHCR toolchain image.
- [ ] GitHub CI can build and push a missing GHCR toolchain image.
- [ ] Re-running CI after publish reuses the prebuilt image.
- [ ] Stage behavior and outputs are unchanged compared with the current
      container construction path.
