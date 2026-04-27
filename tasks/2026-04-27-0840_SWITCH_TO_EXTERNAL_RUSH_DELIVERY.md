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
- `.github/workflows/ci-validate.yaml` still calls the external Dagger module
  directly at `github.com/BootstrapLaboratory/rush-delivery@v0.2.0`.
- `.github/workflows/dagger-smoke.yaml` still calls the external Dagger module
  directly at `github.com/BootstrapLaboratory/rush-delivery@v0.2.0`.
- `.github/actions/cached-install/action.yaml` is obsolete because Rush install
  caching is owned by Rush Delivery.
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
- Metadata YAML files should use hosted schema references from
  `https://bootstraplaboratory.github.io/rush-delivery/schemas/*` instead of
  local `.dagger/schemas` files.

## Phase 1: Workflow Cleanup

- [ ] Confirm `ci-release.yaml` uses the intended released action version.
- [ ] Remove any local Dagger CLI/module setup from release workflow.
- [ ] Update `ci-validate.yaml` so it no longer references `v0.2.0`.
- [ ] Decide whether `ci-validate.yaml` remains a direct external Dagger module
      call or moves to a Rush Delivery action interface.
- [ ] Remove or replace `dagger-smoke.yaml`.
- [ ] Remove `.github/actions/cached-install/action.yaml`.
- [ ] Confirm no workflows reference `.github/actions/cached-install`.
- [ ] Confirm no workflows require the embedded `dagger/` directory.

## Phase 2: Remove Embedded Framework Source

- [ ] Delete `dagger/`.
- [ ] Confirm no tracked files import or link to `dagger/src`,
      `dagger/test`, `dagger/docs`, `dagger/dagger.json`, or
      `dagger/package.json`.
- [ ] Confirm `trunk check -a` no longer scans embedded framework source.
- [ ] Confirm no stale dependency/security findings remain from
      `dagger/yarn.lock` or `dagger/node_modules`.

## Phase 3: Documentation Pass

- [ ] Update root `README.md` to describe this repo as a consumer of Rush
      Delivery.
- [ ] Update `docs/notes/ReleaseFlow.md` to show the current GitHub Action
      flow.
- [ ] Update `docs/notes/DaggerFrameworkContract.md` so it focuses on local
      `.dagger/` metadata contracts and links upstream for framework API docs.
- [ ] Update or remove `docs/notes/GitLabReleaseExample.md`; it currently
      describes old direct Dagger calls and host workspace behavior.
- [ ] Update `docs/notes/MonorepoTooling.md` if it still says Dagger source is
      owned locally.
- [ ] Update GraphQL, Cloud Run, and Cloudflare notes only where they mention
      old Dagger entrypoints or local `dagger/` commands.
- [ ] Update `examples/rush-delivery/targets/worker/README.md` so validation
      examples use the external module/action, not `cd dagger`.
- [ ] Update or remove `examples/gitlab/ci-release.gitlab-ci.yml` if it still
      assumes an embedded `dagger/` directory.
- [ ] Ensure docs use relative links for local files and external links only
      for upstream Rush Delivery docs/release references.

## Phase 4: Metadata And Editor Support

- [ ] Add or update `$schema` references in `.dagger/**/*.yaml` metadata to use
      hosted Rush Delivery schema URLs.
- [ ] Delete local `.dagger/schemas/**`.
- [ ] Confirm VS Code or schema references no longer point at local
      `.dagger/schemas`.
- [ ] Confirm hosted schemas are reachable at
      `https://bootstraplaboratory.github.io/rush-delivery/schemas/*`.
- [ ] Confirm `.dagger/runtime` remains ignored/generated only.
- [ ] Confirm target metadata uses the current Rush Delivery schema shape,
      including runtime files and provider metadata.

## Phase 5: Validation

- [ ] Run metadata validation through the external Rush Delivery version used by
      CI.
- [ ] Run a local dry-run release workflow with `source-mode=local_copy`.
- [ ] Run `trunk check -a`.
- [ ] Run real `ci-validate.yaml` on a pull request.
- [ ] Run real `ci-release.yaml` on `main` or via forced target workflow.
- [ ] Confirm deploy-server and deploy-webapp wrapper workflows still force the
      intended targets.

## Completion Criteria

- [ ] No embedded framework source remains in this repo.
- [ ] No workflow references local `dagger/`.
- [ ] No workflow references `.github/actions/cached-install`.
- [ ] No local `.dagger/schemas` directory remains.
- [ ] Metadata uses hosted Rush Delivery schemas.
- [ ] Project docs explain only this app's Rush Delivery usage and metadata.
- [ ] Framework API docs are delegated to `BootstrapLaboratory/rush-delivery`.
- [ ] Real CI is green after the cleanup.
