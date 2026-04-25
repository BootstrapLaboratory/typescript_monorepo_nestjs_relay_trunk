# Rush Plan Target Mapping Reform Plan

## Goal

Make the Rush deploy-target planning logic generic enough to serve as a
framework building block, instead of hardcoding `server` and `webapp` as the
only supported deploy targets.

The important direction in this plan is:

- stop hardcoding deploy target names in the Rush planning module
- keep deploy target graph and deploy runtime metadata under
  [../../.dagger/deploy](../../.dagger/deploy)
- treat target YAML `name` as the canonical deploy target id
- use the naming convention that deploy target `name` equals the Rush project
  name for this phase
- preserve current behavior for `server` and `webapp` while the refactor lands

## Problem

The current planning script is doing more than one job:

- validating which deploy targets are supported
- mapping changed Rush projects to deploy targets
- deriving deploy tag names for release comparisons

Today that logic is hardcoded around `server` and `webapp`, because the current
project happens to use:

- deploy target names equal to Rush package names
- deploy tags named `deploy/prod/<target>`
- CI output names that still use release-oriented names even though the script
  is currently computing deployable targets, not a broader release model

That works for the current repository, but it does not scale as a reusable
framework base.

## Current Hardcoded Coupling

Original hardcoded assumptions in the Rush planning logic:

- supported deploy targets come from a constant list
- PR affected-project checks explicitly look for `server` and `webapp`
- release deploy-tag checks explicitly resolve `deploy/prod/server` and
  `deploy/prod/webapp`
- deploy decisions assume one Rush project directly maps to one deploy target

## Target Shape

The target shape should be:

1. load deploy target names dynamically from
   [../../.dagger/deploy/services-mesh.yaml](../../.dagger/deploy/services-mesh.yaml)
2. load target identities from [../../.dagger/deploy/targets](../../.dagger/deploy/targets)
3. treat target YAML `name` as the canonical deploy target id
4. use the convention that target YAML `name` also equals the Rush project
   name for this phase
5. decide target impact by metadata and convention, not by hardcoded target
   names

This keeps the model explicit:

- service mesh owns target graph and ordering
- target YAML `name` owns canonical deploy target identity
- target YAML `name` also maps to the Rush project name by convention
- the Rush planning module only interprets repository metadata plus that
  naming convention

## Design Principles

- Treat deploy targets as repository metadata, not script constants.
- Treat target YAML `name` as canonical, instead of deriving identity from
  filenames or Rush package names.
- Prefer naming convention over duplicate metadata when the mapping is 1:1.
- Rename current planning outputs so they describe deploy targets, not release
  targets.
- Avoid deriving deploy targets directly from
  [../../rush.json](../../rush.json) alone, because not every Rush project should
  automatically become a deploy target.
- Keep deploy tag naming configurable through metadata or one centralized rule,
  not scattered target-specific conditionals.

## Proposed Metadata Changes

Keep target YAML minimal and rely on `name`:

```yaml
name: server
```

If a future project needs one deploy target to map to different Rush project
names, then we can introduce explicit planning metadata later. For this phase,
the convention is:

```yaml
deploy target name == Rush project name
```

Deploy tag naming can still stay centralized as `DEPLOY_TAG_PREFIX/<target>`.

## Refactor Phases

## Phase 0: Lock Current Behavior

- [x] Add focused tests for the current `server` and `webapp` planning
      behavior before changing logic.
- [x] Cover both pull request mode and release mode.
- [x] Cover forced target selection validation.

## Phase 1: Clarify Target Naming Convention

- [x] Treat `name` in each target YAML as the canonical deploy target id.
- [x] Define and document that target YAML `name` is also the Rush project name
      for this phase.
- [x] Keep target YAML free of duplicate planning metadata when the mapping is
      already 1:1.
- [x] Validate that target YAML `name` values are unique.

## Phase 2: Load Targets Dynamically

- [x] Refactor Rush planning to load target names from
      [../../.dagger/deploy/services-mesh.yaml](../../.dagger/deploy/services-mesh.yaml).
- [x] Refactor target loading so deploy target identity comes from target YAML
      `name`, not just filenames.
- [x] Remove the hardcoded supported target list.
- [x] Validate forced targets against loaded metadata instead of a constant
      array.

## Phase 3: Replace Hardcoded Project Checks

- [x] Replace direct `server` and `webapp` project checks with generic
      evaluation against target YAML `name`.
- [x] Make pull request validation target selection generic.
- [x] Make release deployment target selection generic.

## Phase 4: Keep Release Tag Behavior Stable

- [x] Keep deploy tag comparison behavior stable for the current targets.
- [x] Decide whether `deploy_tag` needs to become explicit per target or can
      remain derived from `DEPLOY_TAG_PREFIX/<target>`.
- [x] If derivation stays sufficient, document that rule clearly instead of
      hardcoding target-specific logic.

## Phase 5: Keep CI Outputs Stable

- [x] Rename deploy-facing outputs from release-oriented names to
      deploy-oriented names.
- [x] Replace `affected_projects_by_target_json` with
      `affected_projects_by_deploy_target_json`.
- [x] Replace `release_targets_json` with `deploy_targets_json`.
- [x] Keep `validate_targets_json` as the validation-oriented output name,
      because it represents affected Rush validation scope rather than deploy
      scope.
- [x] Update the GitHub workflow to consume the renamed deploy-oriented
      outputs.
- [x] Preserve the current output set shape and meaning for:
      `affected_projects_by_deploy_target_json`,
      `validate_targets_json`,
      `deploy_targets_json`,
      `any_scope`,
      `mode`,
      and `pr_base_sha`.
- [x] Verify that only output names change, not planning semantics.

## Phase 6: Prepare For Dagger Migration

- [x] Separate script logic into smaller units or a loadable helper so moving
      it under Dagger later is straightforward.
- [x] Keep repository metadata loading independent from GitHub-specific output
      writing.
- [x] Make the final planning core easy to call from Dagger without rewriting
      target-mapping logic a second time.

## Stop Point

- Rush planning no longer hardcodes `server` and `webapp` as the
  only supported deploy targets.
- target support comes from
  [../../.dagger/deploy/services-mesh.yaml](../../.dagger/deploy/services-mesh.yaml)
  plus per-target YAML metadata.
- target YAML `name` is the canonical deploy target id.
- Rush project impact is mapped to deploy targets through the naming convention
  that target YAML `name` equals the Rush project name.
- deploy-oriented CI output names clearly describe deploy targets instead of a
  broader future release concept.
- the planning logic is ready to move under Dagger later without reintroducing
  target-specific hardcoding.
