# Metadata Contracts

Project-specific behavior lives under [`.dagger`](../../.dagger). The Dagger
module treats those files as the public extension contract.

Exact field validation is defined by JSON schemas under
[`../../.dagger/schemas`](../../.dagger/schemas).

## Deploy Services Mesh

[`../../.dagger/deploy/services-mesh.yaml`](../../.dagger/deploy/services-mesh.yaml)
defines deploy target ordering:

- `services.<target>.deploy_after` lists targets that must finish first.
- Targets with no dependency can run in the same deploy wave.
- Service names must match deploy target metadata names.

## Deploy Targets

Deploy targets live in
[`../../.dagger/deploy/targets`](../../.dagger/deploy/targets).

Each target declares:

- `name`: target name. It should match the metadata filename and Rush package.
- `deploy_script`: repository-relative script executed by the target runtime.
- `runtime.image`: base image for the executor container.
- `runtime.install`: toolchain preparation commands.
- `runtime.pass_env`: allowed 1:1 host-to-container environment variables.
- `runtime.env`: static container environment values.
- `runtime.dry_run_defaults`: safe defaults used during dry-runs.
- `runtime.required_host_env`: host environment keys required for live runs.
- `runtime.file_mounts`: files sourced from host env paths and mounted into the
  runtime container.
- `runtime.workspace`: directories and files mounted under `/workspace`.

If `runtime.workspace.mode` is `full`, the whole prepared repository is mounted.
If mode is omitted, only listed `dirs` and `files` are mounted.

Schema:
[`../../.dagger/schemas/deploy-target.schema.json`](../../.dagger/schemas/deploy-target.schema.json)

## Package Targets

Package targets live in
[`../../.dagger/package/targets`](../../.dagger/package/targets).

Supported artifact types:

- `directory`: an already-built repository directory.
- `rush_deploy_archive`: a Rush deploy output packaged for a deploy target.

Schema:
[`../../.dagger/schemas/package-target.schema.json`](../../.dagger/schemas/package-target.schema.json)

## Validation Targets

Validation targets live in
[`../../.dagger/validate/targets`](../../.dagger/validate/targets).

They declare optional backing services and ordered validation steps. This keeps
target-specific smoke checks in metadata while the runner stays generic.

Schema:
[`../../.dagger/schemas/validation-target.schema.json`](../../.dagger/schemas/validation-target.schema.json)

## Toolchain Images

Toolchain image provider metadata lives in
[`../../.dagger/toolchain-images/providers.yaml`](../../.dagger/toolchain-images/providers.yaml).

It declares optional registry providers for reusable framework toolchain images.
Provider `off` needs no metadata. Provider `github` uses GHCR with environment
keys for repository, username, and token.

Schema:
[`../../.dagger/schemas/toolchain-image-providers.schema.json`](../../.dagger/schemas/toolchain-image-providers.schema.json)

## Rush Cache

Rush cache metadata lives in
[`../../.dagger/rush-cache/providers.yaml`](../../.dagger/rush-cache/providers.yaml).

The `cache` section defines:

- `version`: user-controlled cache salt.
- `key_files`: files whose contents invalidate the cache.
- `paths`: repository-relative Rush install cache paths restored into the
  Dagger-owned source.

The `providers` section declares optional storage adapters.

Schema:
[`../../.dagger/schemas/rush-cache-providers.schema.json`](../../.dagger/schemas/rush-cache-providers.schema.json)
