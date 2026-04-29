# Rush Delivery Metadata Contract

This repository consumes the external Rush Delivery framework from
`BootstrapLaboratory/rush-delivery`. The shared Dagger module lives upstream;
this app repo owns only project-specific metadata, provider scripts, and
workflow wiring.

Run the metadata contract validator before changing target metadata:

```bash
dagger -m github.com/BootstrapLaboratory/rush-delivery@v0.4.1 call validate-metadata-contract --repo=.
```

The same validation runs before the release and validation workflows do
expensive work.

## Core Assumption

Every Rush Delivery target name should match a Rush `packageName` in
[rush.json](../../rush.json).

That naming convention keeps the framework generic:

- Rush owns dependency-aware project selection and build ordering.
- `.dagger` metadata describes how a Rush project participates in package,
  deploy, or validation stages.
- Adding a target should mean adding metadata and provider/project scripts,
  not editing framework TypeScript.

## Metadata Roots

- Deploy graph metadata:
  [.dagger/deploy/services-mesh.yaml](../../.dagger/deploy/services-mesh.yaml)
- Deploy target metadata:
  [.dagger/deploy/targets](../../.dagger/deploy/targets)
- Package target metadata:
  [.dagger/package/targets](../../.dagger/package/targets)
- Validation target metadata:
  [.dagger/validate/targets](../../.dagger/validate/targets)
- Rush install cache provider metadata:
  [.dagger/rush-cache/providers.yaml](../../.dagger/rush-cache/providers.yaml)
- Toolchain image provider metadata:
  [.dagger/toolchain-images/providers.yaml](../../.dagger/toolchain-images/providers.yaml)

Runtime handoff files are generated under `.dagger/runtime` during Rush
Delivery runs. They are not source metadata.

## Editor Schemas

Rush Delivery publishes metadata schemas at versioned URLs such as:

```text
https://bootstraplaboratory.github.io/rush-delivery/schemas/v0.4.1/*
```

Each `.dagger/**/*.yaml` metadata file declares its schema with a
`# yaml-language-server: $schema=...` comment. This keeps metadata files
self-describing without adding unsupported `$schema` data fields.

Schemas catch file-shape mistakes while editing. The Rush Delivery metadata
contract validator remains the source of truth for cross-file checks such as
Rush project membership, deploy graph dependencies, script existence, and
package/deploy target pairing.

## Deploy Graph

`services-mesh.yaml` declares deployable targets and their deployment ordering:

```yaml
services:
  server:
    deploy_after: []

  webapp:
    deploy_after:
      - server
```

Rules:

- every key under `services` is a deploy target name
- every target name should match a Rush `packageName`
- every `deploy_after` entry must reference another mesh target
- cycles are invalid
- deployment waves are computed from this graph

## Package Metadata

Each deploy target needs a matching package metadata file:

```yaml
name: server

artifact:
  kind: rush_deploy_archive
  project: server
  scenario: server
  output: common/deploy/server
```

Supported artifact kinds:

- `directory`: Rush Delivery expects an already-built directory and exposes it
  in the package manifest.
- `rush_deploy_archive`: Rush Delivery runs `rush deploy`, archives the output,
  and exposes the archive in the package manifest.

Rules:

- `name` must match the metadata filename and Rush project name
- `directory.path` must be repository-relative
- `rush_deploy_archive.project` must be a Rush project
- `rush_deploy_archive.output` must be repository-relative

## Deploy Metadata

Each deploy target also needs a matching deploy metadata file:

```yaml
name: server
deploy_script: deploy/cloudrun/scripts/deploy-server.sh

runtime:
  image: node:24-bookworm-slim
  workspace:
    dirs:
      - common/deploy/server
      - deploy/cloudrun/scripts
    files:
      - apps/server/Dockerfile

  install:
    - apt-get update
    - apt-get install -y --no-install-recommends ca-certificates curl git

  pass_env:
    - CLOUD_RUN_REGION

  dry_run_defaults:
    CLOUD_RUN_REGION: europe-west4
```

Rules:

- `name` must match the metadata filename and Rush project name
- `deploy_script` must be repository-relative and must exist
- `runtime.image` defines the target executor container image
- `runtime.workspace` limits which repo paths are mounted into the executor
- `runtime.install` prepares target-specific tooling
- `runtime.pass_env` is a 1:1 host env to executor env allowlist
- every `pass_env` key must have a `dry_run_defaults` value
- `runtime.env` defines static executor env literals
- `runtime.required_host_env` validates host env needed for live runs
- runtime file mounts reference files prepared by the CI adapter or local caller

Docker socket access is intentionally not target metadata. It is a shared
entrypoint argument because the Docker socket is a host capability, not a
service property.

## Validation Metadata

Validation metadata is optional for Rush projects. If a project has no
validation metadata, Rush `verify`, `lint`, `test`, and `build` are the full
validation path for that project.

When metadata exists, Rush Delivery runs it generically:

```yaml
name: server

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - 5432

steps:
  - name: smoke
    command: npm
    args: [--prefix, apps/server, run, ci:smoke]
```

Rules:

- `name` must match the metadata filename and Rush project name
- backing services are declared in YAML
- command steps run in order
- service steps register foreground services for later command steps
- per-service and per-step env is declared in metadata

## Adding A Deploy Target

1. Add the project to [rush.json](../../rush.json) with a stable
   `packageName`.
2. Add package metadata under `.dagger/package/targets/<target>.yaml`.
3. Add the target to `.dagger/deploy/services-mesh.yaml`.
4. Add deploy metadata under `.dagger/deploy/targets/<target>.yaml`.
5. Put project-specific behavior in the owning project, usually package scripts
   under `apps/<project>`.
6. Put provider-specific deploy behavior under `deploy/<provider>/scripts`.
7. Run the metadata contract validator from the repository root.

If validation passes, Rush Delivery should be able to detect, build, package,
deploy, and optionally validate the new target without target-specific
framework changes.

A copyable example target pack is available under
[examples/rush-delivery/targets/worker](../../examples/rush-delivery/targets/worker).

## Validator Guarantees

The metadata validator checks:

- `rush.json` has a valid project list
- Rush project folders and package files exist
- service mesh target dependencies are valid and acyclic
- deploy targets referenced by the mesh have deploy metadata
- deploy targets referenced by the mesh have package metadata
- target metadata names match filenames
- target metadata names match Rush package names
- deploy scripts exist
- repository paths stay repository-relative
- package artifact Rush projects exist
- validation metadata targets match Rush package names
- unsupported YAML fields fail early

## Not Guaranteed

The validator does not prove that:

- cloud credentials are valid
- provider CLIs can authenticate
- a deploy script succeeds against a live provider
- generated build outputs already exist before build/package runs
- external services such as Cloud Run, Cloudflare, npm, or container registries
  are reachable

Those checks belong to the actual Rush Delivery workflow, provider scripts, and
live CI runs.
