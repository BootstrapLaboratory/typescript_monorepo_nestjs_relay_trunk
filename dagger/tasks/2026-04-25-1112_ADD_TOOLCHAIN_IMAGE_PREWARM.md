# Add Toolchain Image Prewarm

## Context

Lazy toolchain image resolution is already working for GitHub Container
Registry and local provider-off workflows. The first workflow run that needs a
new content-hash image can build and publish it, which is the right default for
this project.

Some future framework users may still want an explicit prewarm operation before
release windows or after planned toolchain metadata changes.

## Goal

Add optional, provider-aware tooling to prebuild all known toolchain images
without changing the lazy default workflow behavior.

## Non-Goals

- Do not make prewarm required for normal release workflows.
- Do not make GitHub Container Registry mandatory for local development.
- Do not bake project source, build outputs, deploy artifacts, or secrets into
  toolchain images.

## Checklist

- [ ] Add a `prewarm-images` Dagger entrypoint that discovers known toolchain
      image specs.
- [ ] Support provider `off` as a no-op or validation-only mode.
- [ ] Support provider `github` with explicit opt-in credentials.
- [ ] Document local usage, GitHub Actions usage, and required permissions.
- [ ] Decide whether a scheduled GitHub workflow is worth adding.
- [ ] Define image cleanup or retention guidance for old hash-tagged images.
