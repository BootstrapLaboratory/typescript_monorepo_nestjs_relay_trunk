# Dagger Module Refactor Plan

## Goal

Split the Dagger module into smaller source files so planning, model parsing,
target metadata, and target execution are easier to navigate and extend.

This plan covers the Dagger release module centered around
[../dagger/src/index.ts](../dagger/src/index.ts) and the extracted planning and
deploy support modules under [`../dagger/src`](../dagger/src).

## Refactor Principles

- Keep [../dagger/src/index.ts](../dagger/src/index.ts) thin and focused on the
  Dagger API surface.
- Keep pure planning and parsing code independent from container execution.
- Keep deployment behavior in action-oriented executor modules.
- Keep static executor behavior declarative where possible so adding a new
  executor mostly means adding configuration, not editing TypeScript control
  flow.
- Make static target metadata model-driven instead of hardcoded in `switch`
  statements.
- Use explicit executor names such as `deploy_server` and `deploy_webapp`
  instead of reusing target names as executor identifiers.
- Treat the service mesh as the canonical source for target relationships and
  target execution metadata.
- Keep deploy config focused on environment-specific values and secrets.
- Keep build and validation concerns separate from deploy execution so future
  Rush-based packaging and validation work does not distort the deploy layout.
- Keep the service mesh focused on target graph and target metadata, and prefer
  companion executor-spec files for reusable executor runtime configuration.

## Recommended Service Mesh Shape

Add static target metadata to
[../deploy/services-mesh.yaml](../deploy/services-mesh.yaml) so the runtime does
not need target-name switches for script paths or default artifact locations.

Recommended shape:

```yaml
services:
  server:
    executor: deploy_server
    deploy_after: []
    deploy_script: scripts/ci/deploy-server.sh
    artifact_path: /workspace/common/deploy/server

  webapp:
    executor: deploy_webapp
    deploy_after:
      - server
    deploy_script: scripts/ci/deploy-webapp.sh
    artifact_path: /workspace/apps/webapp/dist
```

With this shape:

- adding a new target that reuses an existing executor can be done entirely in
  the service mesh
- adding a new executor kind requires one new target module plus one registry
  entry
- executor names stay readable and action-oriented even when targets and
  executors stop being one-to-one
- deployment planning remains independent from how build artifacts were produced

## Proposed Layout

```text
dagger/src/
  index.ts
  model/
    deploy-config.ts
    deployment-plan.ts
    service-mesh.ts
  planning/
    parse-release-targets.ts
    parse-services-mesh.ts
    build-deployment-plan.ts
  deploy/
    deploy-release.ts
    execute-deployment-plan.ts
    execute-target.ts
    executor-specs/
      deploy_server.ts
      deploy_webapp.ts
    executors/
      load-executor-spec.ts
      registry.ts
      deploy_server.ts
      deploy_webapp.ts
  build/
    rush/
  validate/
```

Recommended responsibilities:

- `index.ts`: `ReleaseOrchestrator` only
- `model/`: shared types only
- `planning/`: JSON/YAML parsing plus deployment-wave planning
- `deploy/`: deployment orchestration and execution flow
- `deploy/executor-specs/`: declarative executor definitions keyed by executor id
- `deploy/executors/`: executor-specific deploy behavior
- `build/`: future build orchestration such as Rush-driven packaging
- `validate/`: future validation orchestration that is not part of deployment

Initial executor mapping:

- `deploy_server` -> `deploy/executors/deploy_server.ts`
- `deploy_webapp` -> `deploy/executors/deploy_webapp.ts`

## Recommended Executor-Spec Shape

Keep the service mesh responsible for choosing the executor id:

```yaml
services:
  server:
    executor: deploy_server
```

Move reusable executor runtime details into companion executor-spec files such
as [`../dagger/src/deploy/executor-specs`](../dagger/src/deploy/executor-specs).

Recommended direction:

```ts
export const spec: DeployExecutorSpec = {
  image: "node:24-bookworm-slim",
  dryRunPreparationCommand: "mkdir -p ${artifact_path}/apps/server",
  install: [
    "apt-get update",
    "apt-get install -y ca-certificates curl gnupg git docker.io",
  ],
  passEnv: [
    "CLOUD_RUN_REGION",
    "CLOUD_RUN_SERVICE",
    "CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT",
  ],
  dryRunDefaults: {
    CLOUD_RUN_REGION: "europe-west4",
    CLOUD_RUN_SERVICE: "server",
  },
  requiredInputs: ["dockerSocket", "gcpCredentialsFile"],
  socketMounts: [
    {
      source: "dockerSocket",
      target: "/var/run/docker.sock",
      env: {
        DOCKER_HOST: "unix:///var/run/docker.sock",
      },
    },
  ],
  fileMounts: [
    {
      source: "gcpCredentialsFile",
      target: "/tmp/gcp-credentials.json",
      env: {
        GOOGLE_APPLICATION_CREDENTIALS: "/tmp/gcp-credentials.json",
        CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE: "/tmp/gcp-credentials.json",
        GOOGLE_GHA_CREDS_PATH: "/tmp/gcp-credentials.json",
      },
    },
  ],
}
```

Why this shape is preferable to pushing everything into the service mesh:

- the service mesh stays readable and target-oriented
- executor runtime behavior remains reusable across multiple targets
- adding a new executor becomes "add a new companion spec file" instead of
  editing central registry logic
- real-mesh tests can verify that every referenced executor id resolves to a
  valid executor spec and runnable script path
- GitHub job env, deploy config env, and executor container env can stay 1:1,
  which makes the end-to-end data flow easier to understand and debug

Preferred deploy-config direction:

```json
{
  "server": {
    "env": {
      "CLOUD_RUN_REGION": "europe-west4",
      "CLOUD_RUN_SERVICE": "api"
    }
  }
}
```

This keeps the path simple:

- GitHub Actions defines the env var
- the workflow writes the same env var name into `dagger-deploy-config.json`
- Dagger passes the same env var name into the executor container

Only non-env inputs such as files and sockets need special handling.

## Phase 0: Enrich the Domain Model

- [x] Add `deploy_script` to the service mesh model.
- [x] Add `artifact_path` to the service mesh model.
- [x] Parse and validate the new service mesh fields.
- [x] Introduce a resolved service definition type that the runtime can consume
      directly.
- [x] Keep deploy config as overrides for environment-specific values only.

## Phase 1: Split Shared Types

- [x] Move deployment plan types into
      [../dagger/src/model/deployment-plan.ts](../dagger/src/model/deployment-plan.ts).
- [x] Move service mesh types into
      [../dagger/src/model/service-mesh.ts](../dagger/src/model/service-mesh.ts).
- [x] Move deploy config types into
      [../dagger/src/model/deploy-config.ts](../dagger/src/model/deploy-config.ts).
- [x] Update imports so planning and runtime code consume shared model files.

## Phase 2: Extract Planning Code

- [x] Move release-target JSON parsing into
      [../dagger/src/planning/parse-release-targets.ts](../dagger/src/planning/parse-release-targets.ts).
- [x] Move service mesh YAML parsing into
      [../dagger/src/planning/parse-services-mesh.ts](../dagger/src/planning/parse-services-mesh.ts).
- [x] Move wave construction into
      [../dagger/src/planning/build-deployment-plan.ts](../dagger/src/planning/build-deployment-plan.ts).
- [x] Remove target-specific assumptions from planning code beyond the service
      mesh model.
- [x] Remove the temporary planner shim once imports are updated to the
      extracted planning modules.

## Phase 3: Extract Deploy Executor Code

- [x] Add [../dagger/src/deploy/executors/deploy_server.ts](../dagger/src/deploy/executors/deploy_server.ts)
      for backend-specific deploy execution.
- [x] Add [../dagger/src/deploy/executors/deploy_webapp.ts](../dagger/src/deploy/executors/deploy_webapp.ts)
      for frontend-specific deploy execution.
- [x] Move server toolchain bootstrap logic into `deploy_server.ts`.
- [x] Move `server` deploy environment resolution into `deploy_server.ts`.
- [x] Move `webapp` deploy environment resolution into `deploy_webapp.ts`.
- [x] Move dry-run preparation logic into deploy executor modules.
- [x] Replace `targetScriptPath(target)` with model-driven metadata read from
      the service mesh.
- [x] Replace `resolveArtifactPath(target, deployConfig)` defaults with
      model-driven metadata read from the service mesh.

## Phase 4: Introduce an Executor Registry

- [x] Add [../dagger/src/deploy/executors/registry.ts](../dagger/src/deploy/executors/registry.ts)
      as a registry keyed by executor name.
- [x] Make runtime execution resolve target behavior through the registry rather
      than `switch` statements.
- [x] Keep support for multiple targets sharing one executor implementation.
- [x] Make unsupported executor errors reference executor names, not target
      names.

## Phase 5: Extract Runtime Orchestration

- [x] Move deploy config parsing into
      [../dagger/src/deploy/deploy-release.ts](../dagger/src/deploy/deploy-release.ts)
      or a dedicated runtime helper.
- [x] Move `executeTarget` into
      [../dagger/src/deploy/execute-target.ts](../dagger/src/deploy/execute-target.ts).
- [x] Move `executeDeploymentPlan` into
      [../dagger/src/deploy/execute-deployment-plan.ts](../dagger/src/deploy/execute-deployment-plan.ts).
- [x] Keep wave-level orchestration separate from target-level execution.
- [x] Keep runtime helpers independent from the Dagger decorator surface where
      possible.

## Phase 6: Shrink the Entry Point

- [x] Keep [../dagger/src/index.ts](../dagger/src/index.ts) limited to:
      `ReleaseOrchestrator`, imported helpers, and Dagger decorators.
- [x] Make `planRelease` call planning helpers only.
- [x] Make `deployRelease` call runtime helpers only.
- [x] Remove local type definitions and helper functions from `index.ts` once
      their dedicated modules exist.

## Phase 7: Verification

- [x] Run `dagger develop`.
- [x] Run `dagger call ping`.
- [x] Run `dagger call plan-release --repo=.. --release-targets-json='["server","webapp"]'`.
- [x] Run a dry-run `dagger call deploy-release` command for `server`.
- [x] Run a dry-run `dagger call deploy-release` command for `webapp`.
- [x] Confirm the refactor does not change the deployment plan JSON shape.
- [x] Confirm the refactor does not change the deploy-release result JSON shape.

## Phase 8: Make Deploy Executors Descriptor-Driven

The next refactor is broader than module splitting. It reforms the public Dagger
release interface so CI env becomes the source of truth and deploy executors use
companion specs plus declarative mount handling.

That work is tracked separately in
[REFORM_DAGGER_RELEASE_INTERFACE.md](./REFORM_DAGGER_RELEASE_INTERFACE.md).

## Extra Ideas

- [x] Add a `ResolvedTarget` model so the runtime receives one fully-normalized
      object per target instead of repeatedly resolving metadata from raw strings.
- [ ] Reserve [../dagger/src/build](../dagger/src/build) for future
      Rush-controlled packaging work rather than putting build logic into deploy
      executors.
- [ ] Reserve [../dagger/src/validate](../dagger/src/validate) for future
      validation work that should remain separate from build and deploy.
- [x] Add a small test file for service mesh parsing and wave planning once the
      module structure is split enough to support lightweight tests.

## Stop Point

- The Dagger module is organized by model, planning, deploy orchestration, and
  deploy executors, while future build and validation concerns have clear
  separate homes, and static target metadata comes from the service mesh instead
  of target-name switches.
