# Add Dagger Workflow Entrypoint

## Goal

Add a single Dagger entrypoint named `workflow` that composes the deploy-flow
stages in one invocation:

```text
detect -> build -> package -> deploy
```

The GitHub workflow should become a thin provider adapter. It prepares fast
host-side context, then calls Dagger once.

## Boundary

GitHub still owns provider/bootstrap concerns:

- repository checkout
- tag fetching
- Dagger CLI installation
- Google Cloud authentication
- exposing repository variables and secrets through one flat deploy env file
- Docker socket availability

Dagger owns the portable workflow:

- deploy scope detection
- Rush verify/lint/test/build for selected deploy targets
- deploy artifact materialization
- package manifest creation
- deployment plan execution

GitHub artifact upload/download is not needed in the composed path because
Dagger carries the built and packaged `Directory` directly between stages.

## Naming Decision

The entrypoint is named `workflow`, not `deployWorkflow`, because it is the
orchestrator surface that can later grow to include package/library release
behavior. In this implementation slice, it runs the deploy-oriented workflow
only.

## PR Validation Caveat

The composed workflow focuses on push/manual release execution. Pull-request
validation with Postgres/Redis-backed server smoke tests should be added later
as a Dagger-owned validation workflow instead of reviving the old split-job
GitHub artifact handoff.

## Checklist

- [x] Remove the previous split-job GitHub workflow example after the composed
      Dagger workflow was validated in real CI.
- [x] Add a Dagger `workflow` entrypoint.
- [x] Compose `detect -> build -> package -> deploy` inside Dagger.
- [x] Replace `.github/workflows/ci-release.yaml` with one
      `dagger-workflow` job.
- [x] Keep `deploy-server.yaml` and `deploy-webapp.yaml` wrappers calling the
      reusable workflow with `force_targets_json`.
- [x] Document that GitHub remains the provider/bootstrap adapter.
- [x] Document that PR validation still needs a future Dagger-owned design.

## Validation

- [x] Run Dagger unit tests.
- [x] Validate workflow YAML syntax.
- [x] Run real GitHub `deploy-server`.
- [x] Run real GitHub `deploy-webapp`.
- [x] Run real `main` release where both deploy targets are selected.
