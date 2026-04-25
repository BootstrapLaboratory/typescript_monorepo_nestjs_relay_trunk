# Dagger Framework Contract

This repository uses Dagger as a reusable Rush-based CI framework. The project
specifics live in Rush projects, package scripts, provider scripts, and
`.dagger` metadata. Dagger TypeScript owns the shared orchestration mechanics.

Run the contract validator before changing target metadata:

```bash
cd dagger
dagger call validate-metadata-contract --repo=..
```

The same validation also runs before the public Dagger release and validation
entrypoints do expensive work.

## Core Assumption

Every Dagger target name should match a Rush `packageName` in
[rush.json](../../rush.json).

That naming convention keeps the framework generic:

- Rush owns dependency-aware project selection and build ordering.
- `.dagger` metadata describes how a Rush project participates in package,
  deploy, or validation stages.
- Dagger does not need service-specific TypeScript when a new target is added.

## Metadata Roots

Deploy graph metadata:

- [.dagger/deploy/services-mesh.yaml](../../.dagger/deploy/services-mesh.yaml)

Deploy target metadata:

- [.dagger/deploy/targets](../../.dagger/deploy/targets)

Package target metadata:

- [.dagger/package/targets](../../.dagger/package/targets)

Validation target metadata:

- [.dagger/validate/targets](../../.dagger/validate/targets)

Runtime handoff files are generated under `.dagger/runtime` during Dagger runs.
They are not source metadata.

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

- `directory`: Dagger expects an already-built directory and exposes it in the
  package manifest.
- `rush_deploy_archive`: Dagger runs `rush deploy`, archives the output, and
  exposes the archive in the package manifest.

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
  install:
    - apt-get update
    - apt-get install -y ca-certificates curl git

  pass_env:
    - CLOUD_RUN_REGION

  dry_run_defaults:
    CLOUD_RUN_REGION: europe-west4
```

Rules:

- `name` must match the metadata filename and Rush project name
- `deploy_script` must be repository-relative and must exist
- `runtime.image` defines the target executor container image
- `runtime.install` prepares target-specific tooling
- `runtime.pass_env` is a 1:1 host env to executor env allowlist
- every `pass_env` key must have a `dry_run_defaults` value
- `runtime.env` defines static executor env literals
- `runtime.required_host_env` validates host env needed for live runs
- every file mount `source_var` must be listed in `required_host_env`

Docker socket access is intentionally not target metadata. It is a shared
Dagger entrypoint argument because the Docker socket is a host capability, not a
service property.

## Validation Metadata

Validation metadata is optional for Rush projects. If a project has no
validation metadata, Rush `verify`, `lint`, `test`, and `build` are the full
validation path for that project.

When metadata exists, Dagger runs it generically:

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
7. Run `dagger call validate-metadata-contract --repo=..`.

If validation passes, Dagger should be able to detect, build, package, and
deploy the new target without adding target-specific TypeScript.

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

Those checks belong to the actual Dagger workflow, provider scripts, and live
CI runs.
