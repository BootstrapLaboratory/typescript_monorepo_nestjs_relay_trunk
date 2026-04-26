# AI Architecture Notes

Rush Delivery is a Dagger framework for Rush-based release automation. The
architecture goal is to keep the framework generic and move project-specific
behavior into metadata.

## Core Shape

The framework has three layers:

- Public Dagger API: callable entrypoints such as `workflow`, `validate`, and
  `self-check`.
- Stage orchestration: source acquisition, detect, validate, build, package,
  deploy, and workflow composition.
- Metadata contracts: `.dagger/` files that describe targets, dependencies,
  providers, cache inputs, and runtime needs.

## Stage Boundaries

Source acquisition resolves a clean Dagger-owned workspace. Local development
uses `local_copy`; CI normally uses Git source mode.

Detect computes the CI plan from Rush project changes, forced target input, PR
base commits, and deploy tags.

Validate runs generic Rush validation and target validation metadata.

Build runs Rush build work for selected deploy targets.

Package materializes deploy artifacts and writes a package manifest.

Deploy reads the package manifest and target metadata, then executes targets in
service-mesh wave order.

Workflow composes those stages into one release path.

## Framework Boundaries

Rush is the project model. The framework may call Rush, but should not hardcode
project-specific package behavior.

Metadata is the extension point. Adding a deploy target should primarily mean
adding or editing `.dagger/` metadata.

Provider adapters are optional. GitHub and GHCR are adapters, not architectural
requirements.

Target runtime containers receive only explicitly allowed environment variables,
files, workspace paths, and sockets.

## Invariants

Provider-off local workflows must remain useful.

Dry-runs must not require live cloud credentials.

GitHub-specific behavior belongs in provider metadata or CI setup, not in the
core stage model.

Completed task files are archives. Do not edit files under `tasks/completed` or
`dagger/tasks/completed`; create a new task file for follow-up work.

Documentation should describe public contracts and architecture, not line-by-line
implementation details.
