# CI Stage Handoff Reform Plan

## Goal

Introduce provider-neutral handoff artifacts between `detect`, `build`,
`package`, and `deploy`, so the same contracts can work in:

- separate GitHub Actions jobs
- separate GitLab CI jobs
- future Dagger entrypoints such as `detect(...)`, `build(...)`,
  `package(...)`, `deploy(...)`
- a future Dagger `workflow(...)` function that naturally calls
  `detect -> build -> package -> deploy`

The central idea is:

- use gitignored files under
  [../../.dagger/runtime](../../.dagger/runtime) as the canonical cross-stage
  contract
- use CI job outputs only as a very thin provider-specific adapter derived from
  those files
- keep stage logic independent from GitHub-specific output plumbing
- keep the canonical contract owned by the Dagger-oriented workflow model, not
  by one CI provider

## Problem

Today the pipeline still relies on CI outputs as the primary handoff between
stages:

- `detect` writes planner outputs into GitHub job outputs
- downstream jobs read those outputs directly in job conditions and step logic

That works in GitHub Actions, but it is not the cleanest framework shape:

- it makes the real contract look provider-specific
- it couples stage-to-stage data flow to CI syntax
- it makes it harder to run the same stages inside Dagger later

## Target Shape

The target shape should be:

1. `detect` produces one canonical plan file:
   [../../.dagger/runtime/ci-plan.json](../../.dagger/runtime/ci-plan.json)
2. `detect` runs one small finalize step that reads `ci-plan.json` and emits
   CI-provider outputs as derived projections of that file
3. `validate`, `build`, `package`, and `deploy` consume `ci-plan.json`
4. GitHub and GitLab only adapt that file into job scheduling and artifact
   transfer
5. Dagger can later call the same stages directly using the same JSON contract

## Canonical File Contracts

Recommended `ci-plan.json` shape:

```json
{
  "mode": "pull_request",
  "pr_base_sha": "abc123",
  "affected_projects_by_deploy_target": {
    "server": ["api-contract", "server"],
    "webapp": []
  },
  "validate_targets": ["api-contract", "server"],
  "deploy_targets": []
}
```

Notes:

- `validate_targets` is the full Rush validation scope
- `deploy_targets` is the deploy/package scope
- `any_scope` should stay derived, not stored

The completed first pass did not need `package-manifest.json`, because GitHub
still owned artifact transfer and the current artifact naming convention was
stable enough for `server` and `webapp`.

The next package-stage reform should introduce
[../../.dagger/runtime/package-manifest.json](../../.dagger/runtime/package-manifest.json)
as the canonical handoff from `package` to `deploy`. That follow-up is tracked
in [REFORM_DAGGER_BUILD_PACKAGE_STAGES.md](./REFORM_DAGGER_BUILD_PACKAGE_STAGES.md).

## Design Principles

- Treat JSON handoff files as the real stage contract.
- Keep CI outputs minimal and derived from canonical JSON files.
- Keep file paths stable under [../../.dagger/runtime](../../.dagger/runtime).
- Make downstream stages read structured JSON instead of scattered job outputs.
- Keep the stage contracts reusable from both CI and Dagger.
- Introduce additional runtime manifests only at stage boundaries where they
  remove coupling, such as the planned package-to-deploy manifest.

## GitHub-Specific Constraint

GitHub Actions cannot inspect an uploaded artifact file in a downstream job
`if:` before starting the job.

So even after introducing `ci-plan.json`, GitHub should still expose a tiny
output adapter from `detect`, but that adapter should be produced by a
finalize step that reads the canonical plan file.

Recommended first-pass GitHub outputs:

- `mode`
- `has_validate_scope`
- `has_deploy_scope`

Optional convenience outputs may also be emitted from the same finalize step if
they help workflow ergonomics, for example:

- `validate_targets_json`
- `deploy_targets_json`

Those outputs should be treated only as cached projections of `ci-plan.json`
for scheduling and ergonomics. The actual stage logic should still read the
JSON file.

## Refactor Phases

## Phase 0: Define The Contracts

- [x] Finalize the exact schema for `ci-plan.json`.
- [x] Decide the minimal GitHub job outputs needed for scheduling.
- [x] Add or confirm `.dagger/runtime/` in `.gitignore`.
- [x] Record that GitHub outputs are derived from `ci-plan.json`, not treated
      as the primary contract.
- [x] Record the first-pass scheduling outputs:
      `mode`,
      `has_validate_scope`,
      and `has_deploy_scope`.
- [x] Record that no `package-manifest.json` is needed in the first pass.
- [x] Record that any optional convenience outputs remain derived projections
      of `ci-plan.json`, not an independent contract.
- [x] Record that a later package-stage reform may introduce
      `package-manifest.json` as a package-to-deploy handoff.

## Phase 1: Make `detect` Produce `ci-plan.json`

- [x] Add a thin writer owned by the Dagger-oriented workflow layer that
      serializes the existing planning result to
      [../../.dagger/runtime/ci-plan.json](../../.dagger/runtime/ci-plan.json).
- [x] Keep the initial planner able to write GitHub outputs during the
      split-job migration.
- [x] Add a finalize step that reads `ci-plan.json` and emits the minimal
      GitHub outputs derived from it.
- [x] If needed, emit optional convenience outputs from the same finalize step
      rather than from the planning core directly.
- [x] Add tests for the JSON file writer and schema shape.
- [x] Keep the current planning semantics unchanged.

## Phase 2: Use Artifacts Between GitHub Jobs

- [x] Upload `ci-plan.json` from `detect` as a GitHub artifact.
- [x] Download `ci-plan.json` in `validate`, `package`, and `deploy`.
- [x] Standardize the restored file path back to
      [../../.dagger/runtime/ci-plan.json](../../.dagger/runtime/ci-plan.json)
      after checkout.
- [x] Keep only the derived scheduling outputs in GitHub job outputs.
- [x] Treat any optional convenience outputs as secondary projections, not the
      stage-to-stage contract.
- [x] Skip `validate` when `has_validate_scope == false`.
- [x] Skip `package` and `deploy` when `has_deploy_scope == false`.

## Phase 3: Make `validate` Read The Plan File

- [x] Stop treating GitHub job outputs as the primary validation contract.
- [x] Read `validate_targets` and `pr_base_sha` from `ci-plan.json`.
- [x] Keep PR validation behavior unchanged.
- [x] Verify that library-only changes still trigger validation.

## Phase 4: Make `package` Read The Plan File

- [x] Read `deploy_targets` from `ci-plan.json`.
- [x] Stop treating GitHub job outputs as the primary package contract.
- [x] Keep package selection behavior unchanged.
- [x] Verify that packaging still only runs on deployable targets.

## Phase 5: Make `deploy` Read The Plan File

- [x] Download and restore `ci-plan.json`.
- [x] Read deploy scope from `ci-plan.json`.
- [x] Keep deploy behavior unchanged.
- [x] Continue using target metadata and stable artifact naming conventions for
      artifact locations.

## Phase 6: Prepare For Dagger Stage Entry Points

- [x] Expose a first Dagger `detect(...)` slice that returns canonical
      `ci-plan.json` content.
- [x] Switch the GitHub `detect` job to call Dagger `detect(...)` as the
      canonical plan producer.
- [x] Define future Dagger `build(...)` input in terms of `ci-plan.json`.
- [x] Define future Dagger `package(...)` input in terms of `ci-plan.json`.
- [x] Define future Dagger `deploy(...)` input in terms of `ci-plan.json`,
      `package-manifest.json`, and deploy target metadata.
- [x] Define a future `workflow(...)` function that can call the same stages
      internally without changing their contracts.

## Stop Point

- `detect`, `validate`, `build`, `package`, and `deploy` exchange one
  canonical plan file under
  [../../.dagger/runtime](../../.dagger/runtime).
- GitHub outputs are reduced to a very thin scheduling adapter derived from
  that plan file.
- any optional convenience outputs are still only projections of that plan
  file, not a second contract.
- downstream stage logic reads structured JSON instead of many job outputs.
- the next package-stage reform can promote package artifact locations into a
  dedicated package-to-deploy manifest.
- the same contract is ready for both split CI jobs and a future single Dagger
  `workflow(...)` implementation.
