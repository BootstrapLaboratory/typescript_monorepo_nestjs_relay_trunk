# Switch To External Rush Delivery

## Goal

Remove the embedded `dagger/` framework source from this application repository
and make this repo a clean Rush Delivery consumer.

The application repo should keep only project-specific Rush Delivery metadata,
provider scripts, and workflow wiring. Shared Dagger framework source,
framework tests, and framework docs now live in
`BootstrapLaboratory/rush-delivery`.

## Current Shape

- Production Rush Delivery version is
  `BootstrapLaboratory/rush-delivery@v0.3.2`.
- `.github/workflows/ci-release.yaml` should use
  `BootstrapLaboratory/rush-delivery@v0.3.2`.
- `.github/workflows/ci-validate.yaml` calls the external Dagger module
  directly at `github.com/BootstrapLaboratory/rush-delivery@v0.3.2`.
- `.github/workflows/dagger-smoke.yaml` was obsolete and has been removed.
- `.github/actions/cached-install/action.yaml` was obsolete and has been
  removed because Rush install caching is owned by Rush Delivery.
- The root `.dagger/` metadata directory is still required and must stay.
- Local `.dagger/schemas/**` are obsolete. Schemas are published by Rush
  Delivery at `https://bootstraplaboratory.github.io/rush-delivery/schemas/*`.
- The embedded `dagger/` directory is framework source and should be removed
  after docs and workflows no longer reference it.

## Keep

- `.dagger/deploy/**`
- `.dagger/package/**`
- `.dagger/validate/**`
- `.dagger/rush-cache/**`
- `.dagger/toolchain-images/**`
- Provider scripts under `deploy/**`
- Project docs that explain how this app uses Rush Delivery metadata and
  workflows.

## Remove

- Embedded framework source directory: `dagger/`
- Obsolete GitHub cache action: `.github/actions/cached-install/action.yaml`
- Local metadata schemas: `.dagger/schemas/**`
- Empty parent directories left behind by the removal.
- Documentation that explains local framework internals now owned by
  `BootstrapLaboratory/rush-delivery`.

## Decisions

- Release workflow should use the GitHub Action:
  `BootstrapLaboratory/rush-delivery@v0.3.2`.
- Validation workflow should not use the old local module. Either:
  - update it to the latest external module reference, or
  - switch to a Rush Delivery GitHub Action mode if the external project adds a
    validation action interface.
- Smoke workflow should be reconsidered. Prefer deleting it if `ci-release` and
  `ci-validate` fully cover integration, or rename it away from
  `dagger-smoke` and make it use the external package only.
- Application docs should link to upstream Rush Delivery docs for framework API
  details instead of duplicating them here.
- Editor/schema tooling should map metadata YAML files to hosted schema
  references from `https://bootstraplaboratory.github.io/rush-delivery/schemas/*`
  instead of local `.dagger/schemas` files. Do not add unsupported `$schema`
  keys to the metadata YAML files themselves.

## Phase 1: Workflow Cleanup

- [x] Confirm `ci-release.yaml` uses the intended released action version.
- [x] Remove any local Dagger CLI/module setup from release workflow.
- [x] Update `ci-validate.yaml` so it no longer references `v0.2.0`.
- [x] Decide whether `ci-validate.yaml` remains a direct external Dagger module
      call or moves to a Rush Delivery action interface.
- [x] Remove or replace `dagger-smoke.yaml`.
- [x] Remove `.github/actions/cached-install/action.yaml`.
- [x] Confirm no workflows reference `.github/actions/cached-install`.
- [x] Confirm no workflows require the embedded `dagger/` directory.

## Phase 2: Remove Embedded Framework Source

- [x] Delete `dagger/`.
- [x] Confirm no tracked files import or link to `dagger/src`,
      `dagger/test`, `dagger/docs`, `dagger/dagger.json`, or
      `dagger/package.json`.
- [x] Confirm `trunk check -a` no longer scans embedded framework source.
- [x] Confirm no stale dependency/security findings remain from
      `dagger/yarn.lock` or `dagger/node_modules`.

## Phase 3: Documentation Pass

- [x] Update root `README.md` to describe this repo as a consumer of Rush
      Delivery.
- [x] Update `docs/notes/ReleaseFlow.md` to show the current GitHub Action
      flow.
- [x] Update `docs/notes/DaggerFrameworkContract.md` so it focuses on local
      `.dagger/` metadata contracts and links upstream for framework API docs.
- [x] Update or remove `docs/notes/GitLabReleaseExample.md`; it currently
      describes old direct Dagger calls and host workspace behavior.
- [x] Update `docs/notes/MonorepoTooling.md` if it still says Dagger source is
      owned locally.
- [x] Update GraphQL, Cloud Run, and Cloudflare notes only where they mention
      old Dagger entrypoints or local `dagger/` commands.
- [x] Update `examples/rush-delivery/targets/worker/README.md` so validation
      examples use the external module/action, not `cd dagger`.
- [x] Update or remove `examples/gitlab/ci-release.gitlab-ci.yml` if it still
      assumes an embedded `dagger/` directory.
- [x] Ensure docs use relative links for local files and external links only
      for upstream Rush Delivery docs/release references.

## Phase 4: Metadata And Editor Support

- [x] Add or update editor/schema associations for `.dagger/**/*.yaml`
      metadata to use hosted Rush Delivery schema URLs without adding
      unsupported metadata fields.
- [x] Delete local `.dagger/schemas/**`.
- [x] Confirm VS Code or schema references no longer point at local
      `.dagger/schemas`.
- [x] Confirm hosted schemas are reachable at
      `https://bootstraplaboratory.github.io/rush-delivery/schemas/*`.
- [x] Confirm `.dagger/runtime` remains ignored/generated only.
- [x] Confirm target metadata uses the current Rush Delivery schema shape,
      including runtime files and provider metadata.

## Phase 5: Validation

- [x] Run metadata validation through the external Rush Delivery version used by
      CI.
- [x] Run a local dry-run release workflow with `source-mode=local_copy`.
- [x] Run `trunk check -a`.
- [ ] Run real `ci-validate.yaml` on a pull request.
- [ ] Run real `ci-release.yaml` on `main` or via forced target workflow.
- [ ] Confirm deploy-server and deploy-webapp wrapper workflows still force the
      intended targets.

## Completion Criteria

- [x] No embedded framework source remains in this repo.
- [x] No workflow references local `dagger/`.
- [x] No workflow references `.github/actions/cached-install`.
- [x] No local `.dagger/schemas` directory remains.
- [x] Metadata uses hosted Rush Delivery schemas.
- [x] Project docs explain only this app's Rush Delivery usage and metadata.
- [x] Framework API docs are delegated to `BootstrapLaboratory/rush-delivery`.
- [ ] Real CI is green after the cleanup.
