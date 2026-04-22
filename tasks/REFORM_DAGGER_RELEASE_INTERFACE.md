# Dagger Release Interface Reform Plan

## Goal

Make the Dagger release module a clear CI-facing interface that is stable across
GitHub Actions, GitLab CI, and future wrappers, while also making the project
metadata reusable across repositories and service types.

The important direction in this plan is:

- keep the Dagger public interface thin and explicit
- keep CI wrappers responsible only for wrapper control values and host-side
  inputs
- keep string environment variables 1:1 through one flat deploy env file bridge
- move repository deploy metadata out of vendor-focused directories and into a
  Dagger/CI-owned repo layout under `.dagger/deploy/`
- remove project-specific target executors from the TypeScript codebase
- load per-target runtime metadata from YAML so adding a new target becomes a
  repository-config change, not a Dagger-code change

This work builds on the completed module-splitting refactor tracked in
[REFACTOR_DAGGER_MODULE.md](./REFACTOR_DAGGER_MODULE.md).

## Target Public Interface

The deploy entrypoint should stay a thin explicit interface:

```ts
export async function deployRelease(
  repo: Directory,
  gitSha: string,
  releaseTargetsJson: string = "[]",
  environment: string = "prod",
  dryRun: boolean = true,
  deployEnvFile?: File,
): Promise<string>
```

Notes:

- `repo` should use a contextual default path so wrapper CI usually does not
  need to pass it explicitly
- `deployEnvFile` should stay a flat `KEY=VALUE` file containing runtime env
  values and any host-side path sources needed by mounts
- wrapper shell env should stay a wrapper concern, not an implicit Dagger
  module input

## Core Principles

- Treat the CI wrapper as the source of truth for runtime values.
- Keep string environment variables 1:1 from CI into the flat deploy env file
  and then into executor runtime handling.
- Keep repository deploy metadata under `.dagger/deploy/`, not under
  vendor-oriented deployment directories.
- Keep the service mesh focused on release graph and ordering.
- Keep target-specific runtime metadata declarative in YAML companion files.
- Expose only explicitly whitelisted values and mounts to executor containers.
- Keep file and socket handling declarative and separate from plain env
  pass-through.
- Keep dry-run behavior generic and common for all targets.
- Make adding a new target a repository-config task:
  service mesh entry + target YAML + deploy script/artifact preparation.

## Desired Flow

The target data flow is:

1. CI defines environment variables and any needed host-side path sources.
2. CI writes one flat deploy env file with those values.
3. `dagger call deploy-release` is invoked with explicit control arguments plus
   the deploy env file.
4. Dagger loads `.dagger/deploy/services-mesh.yaml` to determine release graph
   and target order.
5. Dagger loads `.dagger/deploy/targets/<target>.yaml` for each target being
   deployed.
6. Generic runtime handling applies env, mounts, toolchain preparation, and
   dry-run behavior from the target YAML.
7. Executor containers receive only the values and mounts that their target
   YAML declares.

This keeps the interface explicit enough for Dagger sandboxing while moving the
remaining target-specific behavior out of the TypeScript codebase.

## Source Of Truth

### CI Wrapper

CI should provide:

- explicit Dagger call arguments such as `gitSha`, `releaseTargetsJson`,
  `environment`, and `dryRun`
- plain string values such as `CLOUD_RUN_REGION` and
  `CLOUDFLARE_PAGES_PROJECT_NAME`
- host-side path values such as `GOOGLE_GHA_CREDS_PATH`
- host-side socket path values such as `DOCKER_SOCKET_FILE`

Those values should be written into one flat deploy env file using the same env
names the target YAML expects.

### Repository Deploy Metadata

Repository-owned deploy metadata should live under:

```text
.dagger/
  deploy/
    services-mesh.yaml
    targets/
      server.yaml
      webapp.yaml
```

This keeps Dagger module source under [../dagger](../dagger) while keeping
repository deploy metadata in a Dagger/CI-owned configuration area.

### Service Mesh

The service mesh should stay responsible for:

- target names
- deployment order

Example:

```yaml
services:
  server:
    deploy_after: []

  webapp:
    deploy_after:
      - server
```

### Target YAML

Each target YAML should define target-specific deploy metadata and runtime
exposure rules.

Recommended direction:

```yaml
name: server
deploy_script: scripts/ci/deploy-server.sh
artifact_path: /workspace/common/deploy/server

runtime:
  image: node:24-bookworm-slim
  install:
    - apt-get update
    - apt-get install -y ca-certificates curl gnupg git docker.io

  pass_env:
    - GCP_PROJECT_ID
    - GCP_ARTIFACT_REGISTRY_REPOSITORY
    - CLOUD_RUN_SERVICE
    - CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT
    - CLOUD_RUN_CORS_ORIGIN
    - CLOUD_RUN_REGION

  env:
    DOCKER_HOST: unix:///var/run/docker.sock
    GOOGLE_APPLICATION_CREDENTIALS: /tmp/gcp-credentials.json
    CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE: /tmp/gcp-credentials.json
    GOOGLE_GHA_CREDS_PATH: /tmp/gcp-credentials.json

  dry_run_defaults:
    CLOUD_RUN_REGION: europe-west4
    CLOUD_RUN_SERVICE: server

  required_host_env:
    - GOOGLE_GHA_CREDS_PATH
    - DOCKER_SOCKET_FILE

  file_mounts:
    - source_var: GOOGLE_GHA_CREDS_PATH
      target: /tmp/gcp-credentials.json

  socket_mounts:
    - source_var: DOCKER_SOCKET_FILE
      target: /var/run/docker.sock
```

This keeps the model clear:

- `pass_env`: 1:1 deploy env file entry to container env
- `env`: static container env literals
- `file_mounts`: host file path source to container target
- `socket_mounts`: host socket path source to container target
- `required_host_env`: validation for any host env keys the target depends on

This also removes the need for target-specific TypeScript modules such as
`deploy_server.ts` and `deploy_webapp.ts`.

## Generic Runtime Behavior

The runtime should converge on one generic target executor path in TypeScript.

That generic path should:

- load one target YAML
- prepare the container from `runtime.image` and `runtime.install`
- apply generic `pass_env`, `env`, `file_mounts`, and `socket_mounts`
- run the declared `deploy_script`
- handle dry-run in one common way for all targets

Dry-run should not be target-specific. A good generic dry-run should print a
clear execution summary, for example:

- target name
- deploy script path
- artifact path
- runtime image
- install commands
- env keys being exposed
- file mounts and socket mounts being attached

That gives predictable behavior without reintroducing service-specific dry-run
code into the module.

## CI Shape

The workflow should keep the same thin wrapper shape:

```yaml
- name: Write Dagger deploy env file
  run: |
    cat > "${RUNNER_TEMP}/dagger-deploy.env" <<EOF
    GCP_PROJECT_ID=${{ vars.GCP_PROJECT_ID }}
    GCP_ARTIFACT_REGISTRY_REPOSITORY=${{ vars.GCP_ARTIFACT_REGISTRY_REPOSITORY }}
    CLOUD_RUN_SERVICE=${{ vars.CLOUD_RUN_SERVICE }}
    CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT=${{ vars.CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT }}
    CLOUD_RUN_CORS_ORIGIN=${{ vars.CLOUD_RUN_CORS_ORIGIN }}
    CLOUD_RUN_REGION=${{ env.CLOUD_RUN_REGION }}
    CLOUDFLARE_API_TOKEN=${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID=${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    CLOUDFLARE_PAGES_PROJECT_NAME=${{ vars.CLOUDFLARE_PAGES_PROJECT_NAME }}
    WEBAPP_VITE_GRAPHQL_HTTP=${{ vars.WEBAPP_VITE_GRAPHQL_HTTP }}
    WEBAPP_VITE_GRAPHQL_WS=${{ vars.WEBAPP_VITE_GRAPHQL_WS }}
    WEBAPP_URL=https://${{ vars.CLOUDFLARE_PAGES_PROJECT_NAME }}.pages.dev
    GOOGLE_GHA_CREDS_PATH=${{ steps.auth.outputs.credentials_file_path }}
    DOCKER_SOCKET_FILE=/var/run/docker.sock
    EOF

- name: Execute deployment plan
  working-directory: dagger
  env:
    DAGGER_NO_NAG: "1"
  run: |
    dagger call deploy-release \
      --git-sha="${GITHUB_SHA}" \
      --release-targets-json="${{ needs.detect.outputs.release_targets_json }}" \
      --environment=prod \
      --dry-run=false \
      --deploy-env-file="${RUNNER_TEMP}/dagger-deploy.env"
```

That keeps provider wiring explicit but small, while Dagger owns runtime
interpretation from repository metadata and the flat env bridge.

## Phases

## Phase 0: Keep The Thin Runtime Interface

- [x] Keep a thin explicit `deployRelease(...)` entrypoint.
- [x] Keep one flat deploy env file as the runtime bridge from CI into Dagger.
- [x] Keep the runtime contract explicit for live runs versus dry runs.

## Phase 1: Keep The Generic Runtime Model

- [x] Add a runtime model that supports `passEnv`, `env`, `dryRunDefaults`,
      `requiredHostEnv`, `fileMounts`, and `socketMounts`.
- [x] Add explicit types for file and socket mount specs.
- [x] Parse and normalize the flat deploy env file in one dedicated runtime
      helper.
- [x] Resolve file and socket mounts generically from runtime data instead of
      target-specific Dagger function parameters.

## Phase 2: Keep CI Wrapper Wiring Thin

- [x] Replace the old target-shaped deploy config JSON with one flat deploy env
      file.
- [x] Keep the deploy step arguments thin: `gitSha`, `releaseTargetsJson`,
      `environment`, `dryRun`, and `deployEnvFile`.
- [x] Keep the final deploy invocation explicit, but small.

## Phase 3: Move Repository Deploy Metadata To `.dagger/deploy/`

- [x] Move the canonical services mesh to
      [../.dagger/deploy/services-mesh.yaml](../.dagger/deploy/services-mesh.yaml).
- [x] Keep `.dagger/deploy/services-mesh.yaml` focused on target graph and
      ordering only.
- [x] Add
      [../.dagger/deploy/targets](../.dagger/deploy/targets)
      as the canonical location for per-target deploy metadata.
- [x] Update Dagger runtime loading code to read repository deploy metadata from
      `.dagger/deploy/`.
- [x] Update tests to use the new repository metadata paths.

## Phase 4: Move Target Specs From TypeScript To YAML

- [x] Move the former TypeScript target specs into
      [../.dagger/deploy/targets/server.yaml](../.dagger/deploy/targets/server.yaml)
      and
      [../.dagger/deploy/targets/webapp.yaml](../.dagger/deploy/targets/webapp.yaml).
- [x] Add YAML parsing and validation for target runtime metadata.
- [x] Keep the target YAML model equivalent to the current spec model:
      `deploy_script`, `artifact_path`, `runtime.image`, `runtime.install`,
      `runtime.pass_env`, `runtime.env`, `runtime.dry_run_defaults`,
      `runtime.required_host_env`, `runtime.file_mounts`, and
      `runtime.socket_mounts`.
- [x] Add tests that load every target YAML referenced by the real service
      mesh.

## Phase 5: Remove Target-Specific TypeScript Executors Entirely

- [x] Remove target-specific TypeScript executors from the Dagger module.
- [x] Replace target-specific executor loading with one generic runtime path
      driven by target YAML.
- [x] Ensure adding a new target no longer requires adding a target-specific
      TypeScript executor module.

## Phase 6: Make Dry-Run Common For All Targets

- [x] Replace any remaining target-specific dry-run behavior with one generic
      dry-run summary path.
- [x] Make dry-run output show target name, deploy script, artifact path,
      runtime image, install commands, env keys, and mounts.
- [x] Keep dry-run behavior non-invasive: log/print only, with no
      service-specific side effects.

## Phase 7: Keep Safety Tests Strong After YAML Externalization

- [x] Add tests that fail when a required `passEnv` key is missing in a live
      runtime scenario.
- [x] Add tests that fail when a required `requiredHostEnv` key is missing in a
      live runtime scenario.
- [x] Add tests that fail when a required `sourceVar` for a file or socket
      mount is missing in a live runtime scenario.
- [x] Add tests that validate target YAML schema requirements.
- [x] Add tests that validate real target YAML deploy scripts still exist.
- [x] Add tests that validate every service-mesh target has a matching target
      YAML file.

## Phase 8: Update Wrapper Docs

- [ ] Update the GitHub release docs to describe `.dagger/deploy/` as the
      repository metadata source of truth.
- [ ] Update the GitHub release docs to describe the flat deploy env file
      bridge and the thin explicit deploy call.
- [ ] Update the GitLab example to follow the same interface and repository
      metadata layout.
- [ ] Remove stale references to `deploy/services-mesh.yaml`,
      `dagger/src/deploy/executor-specs/*.ts`, and target-specific TypeScript
      executors from repository docs once the refactor is complete.

## Stop Point

- `dagger call deploy-release` keeps a stable thin explicit interface.
- CI wrappers provide plain env values and host-side mount source paths through
  one flat deploy env file.
- `.dagger/deploy/services-mesh.yaml` defines target graph and ordering.
- `.dagger/deploy/targets/*.yaml` define target deploy metadata and runtime
  exposure rules.
- No project-specific target executor modules remain in the TypeScript codebase.
- Dry-run behavior is common and generic for all targets.
- Adding a new target is a repository-config task, not a Dagger-code task.
