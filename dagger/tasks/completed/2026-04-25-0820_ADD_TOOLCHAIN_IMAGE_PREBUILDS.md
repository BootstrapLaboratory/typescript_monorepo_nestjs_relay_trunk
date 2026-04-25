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
- Optimize deploy executor toolchains first, then extend the same mechanism to
  the shared Rush workflow toolchain after the deploy path proves the model.
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
    image_namespace: rush-delivery-toolchains
    repository_env: GITHUB_REPOSITORY
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
```

Provider metadata location: `.dagger/toolchain-images/providers.yaml`.

## Current Runtime Inventory

- `stages/deploy/execute-target.ts`: deploy executor runtime from target
  metadata. First optimization candidate because it repeats target-specific
  toolchain installation.
- `rush/container.ts`: shared Rush helper runtime used by detect, build,
  package, and validation flows. Second optimization candidate after deploy
  executor toolchains prove the model.
- `stages/build-stage/build-deploy-targets.ts`: standalone Rush build runtime.
  Should reuse `rush/container.ts` so it gets the same toolchain behavior.
- `stages/package-stage/package-deploy-targets.ts`: standalone Rush package
  runtime. Should reuse `rush/container.ts` so it gets the same toolchain
  behavior.
- `stages/detect/detect.ts`: lightweight detect runtime. Not a first-slice
  candidate, but can reuse the shared Rush helper once that helper is
  toolchain-aware.
- `stages/validate/validation-runner.ts`: validation service containers are
  workload dependencies, not reusable framework toolchains.
- `self-check/self-check.ts`: framework health-check runtime. Not part of the
  release/deploy workflow optimization path.

## Implementation Checklist

### Phase 1: Lazy Deploy Toolchain Images

- [x] Inventory every current Dagger container/runtime setup path and identify
      which ones are toolchain-image candidates.
- [x] Define `ToolchainImageSpec` and its normalized/hashable representation.
- [x] Add unit tests for stable hash generation and hash changes when toolchain
      inputs change.
- [x] Add a provider-neutral image reference model.
- [x] Implement `off` behavior with the current container construction path.
- [x] Add provider metadata parsing and validation.
- [x] Implement the GitHub Container Registry provider adapter.
- [x] Add tests for GHCR image reference generation without contacting GitHub.
- [x] Wire deploy executor stages to resolve toolchain images lazily.

### Phase 2: Follow-Up Toolchain Image Operations

- [x] Extend toolchain image specs beyond deploy executors with a generic Rush
      workflow toolchain kind.
- [x] Wire `rush/container.ts` through the same provider/policy resolution path.
- [x] Reuse the Rush helper from standalone detect/build/package/validate stage
      entrypoints instead of keeping separate image/install definitions.
- [x] Confirm GitHub CI can build and push the Rush workflow toolchain image.
- [x] Confirm re-running GitHub CI reuses the Rush workflow toolchain image.
- [x] Shrink the deploy-server toolchain by replacing `docker.io` with the
      Docker CLI-only package.
- [x] Move optional prewarm, scheduled workflow, documentation, and retention
      follow-ups into a dedicated future task.

## GitHub Actions Follow-Up

- [x] Add `packages: write` only to workflows that publish prebuilt images.
- [x] Pass `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, and `GITHUB_ACTOR` only when
      the GitHub provider is selected.
- [x] Defer scheduled prewarm workflow and hash-tag retention guidance to the
      future prewarm task.

## Validation

- [x] Local workflow still works with image provider disabled.
- [x] GitHub CI can pull an existing GHCR toolchain image.
- [x] GitHub CI can build and push a missing GHCR toolchain image.
- [x] Re-running CI after publish reuses deploy executor prebuilt images.
- [x] The deploy-server Docker CLI-only install path provides both `docker` and
      `gcloud`.
- [x] Stage behavior and outputs are unchanged compared with the current
      container construction path.
