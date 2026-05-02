# Rush Delivery Release Model

This project uses [Rush Delivery](https://bootstraplaboratory.github.io/rush-delivery/)
to turn a Rush monorepo into a repeatable release system. Rush already knows
which projects exist and how project commands run. Rush Delivery adds the
release lifecycle around that graph: detect, validate, build, package, and
deploy.

Rush Delivery has its own detailed tutorial:
[Rush Delivery Tutorial](https://bootstraplaboratory.github.io/rush-delivery/docs/tutorial/).
This chapter will focus on how this project applies that model.

## Why Add Rush Delivery

The repository has more than one deployable target:

- `server`, deployed to Cloud Run
- `webapp`, deployed to Cloudflare Pages

Those targets share a monorepo, a GraphQL contract, CI validation, provider
credentials, package artifacts, deploy ordering, and release tags. Encoding all
of that directly in GitHub Actions would make the workflow file the release
framework.

Rush Delivery avoids that. GitHub Actions becomes the caller. Rush Delivery
owns the release model. Project-specific behavior lives in metadata and scripts
inside the repository.

The consequence is a cleaner split:

| Layer | Owns |
| --- | --- |
| Rush | project graph, dependency installation, bulk commands |
| Project scripts | build, lint, test, schema generation, deploy scripts |
| `.dagger` metadata | target packaging, deploy runtime shape, deploy ordering, validation |
| GitHub Actions | trigger, permissions, provider authentication, input values |
| Rush Delivery | release stages, Dagger isolation, target detection, orchestration |

That keeps CI from becoming a long procedural script.

## The Release Lifecycle

The normal release path calls the Rush Delivery `workflow` entrypoint. In broad
terms, that composition does this:

```text
resolve source
  -> validate metadata
  -> detect selected or affected targets
  -> run validation/build work
  -> package deploy artifacts
  -> deploy targets in mesh order
  -> update deploy state
```

The exact implementation belongs to Rush Delivery. This repository contributes
the metadata and scripts that say what `server` and `webapp` mean.

The stage model is useful because each step has a different responsibility:

- detect decides which deploy targets participate
- validate checks selected projects and target-specific validation metadata
- build runs Rush project build behavior with explicit build-time environment
- package materializes deploy artifacts
- deploy runs target-specific scripts in target-specific runtime containers

If a future CI provider needs split jobs, Rush Delivery exposes stage-level
entrypoints. This repository currently prefers the single `workflow` entrypoint
because it keeps handoff simple.

## Dagger Isolation

Rush Delivery runs through Dagger. That means release work happens in
containerized, declared environments instead of depending on whatever happens
to be installed on a CI runner.

This matters most for deploy targets. Each target declares its runtime shape in
metadata:

- base image
- install commands
- mounted workspace paths
- allowed environment variables
- static environment values
- runtime file mounts
- dry-run defaults

The `server` target installs Docker and Google Cloud CLI tooling because its
deploy script builds and publishes a Cloud Run image. The `webapp` target only
needs Node and Git because it uploads a built static directory through the
Cloudflare Pages deploy script.

That difference belongs in target metadata, not in a shared CI image.

## `.dagger` As The Extension Contract

Rush Delivery treats `.dagger` as this repository's release contract.

The important metadata groups are:

| Path | Purpose |
| --- | --- |
| `.dagger/package/targets` | how each deploy artifact is materialized |
| `.dagger/deploy/targets` | how each deploy target runs |
| `.dagger/deploy/services-mesh.yaml` | deploy ordering between targets |
| `.dagger/validate/targets` | target-specific validation services and steps |
| `.dagger/rush-cache/providers.yaml` | reusable Rush install cache providers |
| `.dagger/toolchain-images/providers.yaml` | reusable toolchain image providers |

Metadata stays framework-generic. It does not say "run this one GitHub job."
It says what the target needs: package shape, deploy script, runtime
environment, files, and ordering.

That makes the metadata usable from GitHub Actions, local Dagger runs, or a
future CI provider.

## Package Targets

Package targets describe deploy artifacts.

The server package target uses a Rush deploy archive. That is appropriate for a
Node backend because the deployable server needs a pruned runtime tree.

The webapp package target uses the already-built directory:

```text
apps/webapp/dist
```

That is appropriate for a static frontend because Vite has already produced the
assets Cloudflare Pages will serve.

Package metadata can also declare build-time environment. This is how the
webapp maps deployment-facing endpoint variables into Vite's build-time names:

```text
WEBAPP_VITE_GRAPHQL_HTTP -> VITE_GRAPHQL_HTTP
WEBAPP_VITE_GRAPHQL_WS   -> VITE_GRAPHQL_WS
```

This mapping belongs to the package/build phase. The deploy phase should not
need build-only `VITE_*` names.

## Deploy Targets

Deploy targets describe runtime execution for deployment scripts.

Each target allowlists what it can see. Environment variables are not passed
through by accident. Runtime files, such as Google Cloud credentials, are
mounted explicitly. Workspace paths are mounted explicitly.

That explicitness prevents two common release bugs:

- a deploy script works only because the CI runner had untracked state
- a deploy script accidentally receives more secrets or files than it needs

The deploy mesh then orders target execution:

```text
server -> webapp
```

The webapp deploys after the server because the frontend/backend production
configuration has to agree: GraphQL endpoints, CORS origin, cookie path, and
runtime availability all meet at release time.

## Validation Targets

Rush project scripts cover generic checks like build, lint, test, and schema
contract verification. Validation target metadata covers deploy-target-specific
behavior.

The server validation target starts PostgreSQL and Redis, runs migrations,
starts the production server, and executes a smoke test. That is not just a
unit test. It proves that the production-ish runtime shape can boot with its
backing services.

The design principle is that validation should live near the target it
validates. Rush Delivery provides the runner, but the repository owns the
target-specific steps.

## GitHub Actions Stays Thin

The main release workflow does a small amount of GitHub-specific work:

- sets workflow-level defaults such as region, tag prefix, cache provider, and
  toolchain provider
- authenticates to Google Cloud when a server deploy may run
- passes provider variables and secrets through `deploy-env`
- passes generated credential files through `runtime-file-map`
- calls `BootstrapLaboratory/rush-delivery@v0.5.0`

It does not manually decide how to build the server, package the webapp, run
target validation, or deploy in waves. Those decisions live in Rush Delivery
and `.dagger` metadata.

The force-deploy workflows are also thin. They call the main workflow with a
forced target list:

```text
["server"]
["webapp"]
```

That means a manual targeted deploy still uses the same release model as a
normal push to `main`.

## Pull Request Validation

Pull requests use the Rush Delivery `validate` entrypoint. That path validates
the changed source without granting release-level permissions.

Provider-backed toolchain images and Rush caches can be pulled when available,
but PR validation does not need the authority to publish production deploys.

The consequence is a safer CI model:

- pull requests prove the project can validate
- pushes to `main` run the release workflow
- manual force deploys reuse the release workflow with explicit targets

## Dry Runs And Local Debugging

Rush Delivery can run against a local working tree with dry-run mode. Dry-runs
use `dry_run_defaults` from package and deploy metadata, so a developer can
exercise release composition without real provider credentials.

That is valuable because release bugs are often metadata bugs. A local dry run
can catch missing target metadata, invalid service mesh configuration, missing
package targets, or incorrect environment mapping before CI.

For metadata-only edits, Rush Delivery also exposes a metadata contract check.
This project uses that when changing `.dagger` files because it is much faster
than running a full deployment path.

## Cache And Toolchain Providers

The repository declares GitHub Container Registry providers for:

- Rush install cache
- reusable Rush Delivery toolchain images

These are performance features, not product behavior. They are still metadata
because the release framework needs to know where it may read or publish
artifacts.

For local experiments or restricted CI environments, providers can be turned
off. The release model still works; it just builds more from scratch.

## What Rush Delivery Does Not Own

Rush Delivery does not replace application architecture. It does not decide how
NestJS modules are structured, how Relay operations are written, or how provider
SDK functions prepare infrastructure.

It also does not replace pre-deployment scenarios. Scenarios prepare cloud
resources and repository settings before release. Rush Delivery performs the
repeatable release after those settings exist.

That distinction keeps the mental model clean:

```text
scenario = prepare environment and repository settings
workflow = validate, package, and deploy selected targets
```

## Design Consequences

This release model makes deployment explicit:

- target names match Rush project names
- deploy ordering is metadata, not workflow branching
- build-time and deploy-time environment are separately declared
- deploy scripts run with target-specific files and environment
- CI provider details stay at the edge
- local dry runs can exercise the same release model

The cost is that release behavior has several named files. The benefit is that
each file has a narrow purpose, and CI no longer hides the architecture inside a
large YAML script.

## Navigation

Previous: [Auth, Realtime, And Browser Security](06-auth-realtime-and-browser-security.md)

Next: [Deploy Targets And Provider Boundaries](08-deploy-targets-and-provider-boundaries.md)
