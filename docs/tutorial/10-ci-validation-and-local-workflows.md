# CI Validation And Local Workflows

The previous chapters described the app, contract, release model, deploy
targets, and pre-deploy scenario. This chapter ties them together from the
developer's point of view.

The main design decision is that local workflows and CI workflows should use
the same ownership boundaries:

- Rush owns install, project graph, build ordering, and repo-wide project
  commands
- project packages own their own build, lint, test, verify, codegen, and
  migration scripts
- Rush Delivery owns CI validation and release orchestration
- GitHub Actions owns triggers, permissions, and provider credentials
- Trunk owns local code QA checks

That split keeps local development convenient without making local convenience
the source of truth for CI.

## Workflow Layers

The repository has several workflow layers. They are intentionally not all the
same tool.

| Layer           | Used for                                             |
| --------------- | ---------------------------------------------------- |
| Devcontainer    | repeatable local environment with Postgres/Redis     |
| Trunk           | local code QA, formatting, lint, and security checks |
| Rush            | dependency install, project graph, build selection   |
| Project scripts | package-owned build, test, codegen, migrations       |
| Rush Delivery   | PR validation, package, deploy, release state        |
| GitHub Actions  | CI trigger, permissions, secrets, provider auth      |

The consequence is that each workflow has a job, and the repo avoids a single
giant command that hides too much behavior.

## Local Development Loop

The normal local loop starts in the devcontainer:

```text
npm run dev
```

That command is intentionally optimized for people. It uses a tiny Nx wrapper
to start the long-running development processes for:

- `api-contract`
- `webapp`
- `server`

Nx is used here because it gives a pleasant multi-process terminal experience.
It is not the repository's package manager, build system, or CI orchestrator.

The local process shape is:

- `api-contract` runs the server schema generator in watch mode
- `webapp` runs Relay compiler in watch mode and starts Vite
- `server` starts Nest in development watch mode

The devcontainer provides local PostgreSQL and Redis, so normal development
does not need cloud resources.

There is also a plain Rush-flavored development command:

```text
npm run dev:rush
```

That runs the Rush `dev` bulk command directly. It is useful when someone wants
to see the same project-script shape without the Nx terminal UI.

## Rush Command Wrappers

The repository root intentionally does not act like an application package with
its own `node_modules`. Root scripts call the checked-in Rush launcher under
`common/scripts`.

The important commands are:

```text
npm run rush:install
npm run rush:update
npm run rush -- verify
npm run rush -- lint
npm run rush -- test
npm run rush:build
```

`rush:install` follows the committed lockfile. `rush:update` changes the
lockfile. The custom bulk commands under `common/config/rush/command-line.json`
run project scripts:

- `verify` runs `npm run verify --if-present`
- `lint` runs `npm run lint --if-present`
- `test` runs `npm run test --if-present`
- `dev` runs `npm run start:dev`

That means adding a new Rush project does not require editing a central CI
script just to make lint or tests work. The project exposes the scripts it
supports, and Rush runs them through the graph-aware command surface.

## Local Code QA With Trunk

Local code QA uses Trunk:

```text
trunk check -a -y
```

The devcontainer puts the Trunk launcher on `PATH`, so agents and humans should
call `trunk` directly. If `command -v trunk` fails, the local QA environment is
not ready and the right response is to fix that environment rather than
silently replacing Trunk with a different checker.

Trunk is a local quality gate. It complements Rush validation, but it is not a
replacement for project tests, GraphQL contract checks, or release validation.

## GraphQL Contract Workflow

GraphQL codegen has a strict source-of-truth rule:

```text
server decorators -> libs/api/schema.gql -> Relay artifacts
```

The server owns the schema generator:

```text
npm --prefix apps/server run graphql:schema
```

That writes the committed contract:

```text
libs/api/schema.gql
```

The server `verify` script runs `graphql:check-contract`. It regenerates the
schema and fails if `libs/api/schema.gql` has an uncommitted diff. That catches
the common mistake where backend GraphQL code changes but the shared contract
is stale.

The webapp owns Relay generation:

```text
npm --prefix apps/webapp run relay
```

The webapp build encodes the clean-checkout order:

```text
relay -> tsc -b -> vite build
```

The consequence is clear: server changes update the committed schema, webapp
changes regenerate Relay artifacts from that schema, and CI fails when the
contract boundary drifts.

## Migration Workflow

Database schema changes belong to the server project.

The important local migration commands are:

```text
npm --prefix apps/server run migration:show
npm --prefix apps/server run migration:create
npm --prefix apps/server run migration:generate
npm --prefix apps/server run migration:run
npm --prefix apps/server run migration:revert
```

Committed migrations are treated as immutable once they may have been applied.
Follow-up schema changes should create new migrations instead of editing old
ones.

CI and deployment use migrations differently:

- validation runs migrations against an ephemeral PostgreSQL service
- production deploy runs compiled migrations from the packaged backend before
  deploying the new Cloud Run revision

Production prefers `DATABASE_URL_DIRECT` for migrations while runtime traffic
uses the runtime database URL. That keeps migration authority separate from the
connection shape used by the running app.

## Pull Request Validation

Pull requests run:

```text
.github/workflows/pr-validate.yaml
```

That workflow calls:

```text
BootstrapLaboratory/rush-delivery@v0.5.0
entrypoint: validate
```

The validation workflow has read-only repository permissions plus package read
access. It does not receive production deploy secrets. It does not authenticate
to Google Cloud. It does not upload assets to Cloudflare.

Rush Delivery validation is responsible for:

- computing the changed/affected Rush project scope
- running Rush project validation work
- running project builds
- running optional `.dagger/validate` target scenarios

For this project, the server validation target is the important extra runtime
check. It starts PostgreSQL and Redis, runs migrations, starts the production
server, and runs the Cloud Run smoke test against that local production-shaped
service.

That catches failures a simple unit-test pass would miss:

- migration/runtime config mismatch
- production server boot errors
- Redis pub/sub wiring problems
- GraphQL HTTP and WS smoke-test failures

## Main Release Workflow

Pushes to `main` run:

```text
.github/workflows/main-workflow.yaml
```

This workflow is the production release entrypoint. It sets the release
defaults, authenticates to Google Cloud when a server deploy may run, passes
provider values through `deploy-env`, passes the Google credentials file
through `runtime-file-map`, and calls Rush Delivery.

Rush Delivery then owns the release lifecycle:

```text
detect -> validate/build -> package -> deploy
```

The workflow-level environment supplies release policy:

- deploy tag prefix
- deploy artifact prefix
- Rush cache provider and policy
- toolchain image provider and policy
- Cloud Run region

The workflow does not hardcode server build steps, webapp build steps, deploy
waves, or provider script internals. Those stay in project scripts and
`.dagger` metadata.

## Forced Target Workflows

Manual target workflows live at:

```text
.github/workflows/force-deploy-server.yaml
.github/workflows/force-deploy-webapp.yaml
```

They are thin wrappers around the main workflow. The only significant input is
the forced target list:

```text
["server"]
["webapp"]
```

This is important. A forced deploy is not a separate deployment system. It is
the same release workflow with a narrower target selection.

That prevents drift between "normal deploy" and "manual repair deploy."

## Production Build Checks

Some local checks are useful before pushing when a change touches production
configuration.

For a production-style webapp build, use the Pages helper with real Vite
endpoint values:

```text
npm run webapp:build:pages
```

That helper requires `VITE_GRAPHQL_HTTP` and `VITE_GRAPHQL_WS`, rejects
placeholder production endpoints, runs a Rush install unless told not to, and
builds the `webapp` project. Because the graph is
`docs -> docs-site -> webapp`, documentation content is part of the selected
build chain and the Docusaurus output is copied into `apps/webapp/dist/docs`.

For documentation-only work, the focused local commands are:

```text
npm run docs:dev
npm run docs:build
```

For local backend image validation, the root script:

```text
npm run server:image:build:local
```

builds the server through Rush, materializes the Rush deploy output, and builds
the Cloud Run Docker image locally. It depends on the devcontainer's Docker
compatible socket setup.

These checks are focused. They do not replace the GitHub release workflow, but
they are useful when the change is specifically about production package or
container shape.

## What To Run Before Deployment

Before deployment-oriented changes, the useful local sequence is:

```text
trunk check -a -y
npm run rush -- verify
npm run rush:build
```

When the change touches GraphQL:

```text
npm --prefix apps/server run graphql:schema
npm --prefix apps/webapp run relay
```

When the change touches database shape:

```text
npm --prefix apps/server run migration:generate
npm --prefix apps/server run migration:run
```

When the change touches production webapp endpoints, run a production-style
webapp build with real `VITE_GRAPHQL_HTTP` and `VITE_GRAPHQL_WS` values.

When the change touches the published docs site, run `npm run docs:build` or a
full `npm run rush -- build --to webapp` to verify that the docs still compose
into the Cloudflare Pages artifact.

When the change touches Rush Delivery metadata, run the metadata contract
validator before relying on the full workflow.

The point is not that every change needs every command. The point is that each
local command maps to a specific ownership boundary.

## Design Consequences

This workflow design gives the project a layered safety model:

- local dev stays fast and interactive
- local QA catches formatting, lint, and static issues
- Rush project scripts catch package-owned failures
- GraphQL contract verification catches schema drift
- validation metadata catches production-shaped backend runtime failures
- PR validation runs without production credentials
- `main` releases use the full deploy credential boundary
- forced deploys reuse the same production workflow

The cost is that there are several commands to learn. The benefit is that the
commands have names that match the architecture: app behavior in project
scripts, provider behavior in deploy scripts, release behavior in Rush
Delivery, and CI permissions in GitHub Actions.

## Navigation

Previous: [Pre-Deploy Scenarios And Provider Functions](09-predeploy-scenarios-and-provider-functions.md)

Next: [How To Evolve The Project](11-how-to-evolve-the-project.md)
