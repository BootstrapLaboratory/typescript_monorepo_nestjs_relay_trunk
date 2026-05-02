# Deploy Targets And Provider Boundaries

The release model from the previous chapter explains how Rush Delivery runs
the deployment lifecycle. This chapter explains what the deployable targets are
and where provider-specific behavior belongs.

The project has two production deploy targets:

| Target   | Runtime product | Provider         | Artifact shape                  |
| -------- | --------------- | ---------------- | ------------------------------- |
| `server` | NestJS backend  | Cloud Run        | Rush deploy archive             |
| `webapp` | Vite static app | Cloudflare Pages | built `apps/webapp/dist` folder |

Those targets are intentionally different. The backend deploys as a container
with migrations, Secret Manager access, Redis-backed pub/sub, and a post-deploy
smoke test. The frontend deploys as immutable static assets whose GraphQL
endpoint configuration is baked in at build time.

The important design decision is not "use two clouds." It is "make each
provider boundary explicit enough that release automation can compose them
without hiding provider assumptions inside app code."

## Three Deployment Layers

There are three related layers that are easy to blur:

| Layer                    | Owns                                                          |
| ------------------------ | ------------------------------------------------------------- |
| Rush Delivery target     | package shape, deploy runtime shape, target ordering          |
| Provider deploy scripts  | the repeatable deploy action for a built artifact             |
| Pre-deploy provider code | infrastructure and repository setup before production deploys |

Rush Delivery does not know how to deploy to Cloud Run or Cloudflare Pages by
itself. It knows how to run a target's declared deploy script with a declared
artifact, environment, file mounts, and workspace.

Provider deploy scripts do not decide whether a target changed, how the
monorepo is installed, or how the release is ordered. They receive an artifact
and deploy it.

Pre-deploy provider code does not publish the app. It prepares cloud resources,
runtime secrets, Pages projects, and GitHub repository settings so the real
deployment workflow can run later.

That separation makes deployment boring in a good way: each layer has a narrow
job.

## Package Targets

Package targets answer one question:

```text
What artifact should this target deploy?
```

For `server`, the artifact is a Rush deploy archive:

```text
common/deploy/server
```

That is the right shape for a Node backend. The backend needs a pruned runtime
tree with the server package, its runtime dependencies, compiled output,
migration files, and Dockerfile context. It is not enough to copy the whole
repository into a deployment step; that would make the deploy script depend on
source-tree noise and unrelated packages.

For `webapp`, the artifact is:

```text
apps/webapp/dist
```

That is the right shape for a static app. Vite has already turned source files,
Relay artifacts, CSS, and assets into browser-ready files. Cloudflare Pages
does not need the monorepo. It needs the built directory.

The consequence is that each deploy target receives the smallest artifact that
matches its runtime model:

- the server receives a backend deploy tree
- the webapp receives static assets

## Build-Time Versus Deploy-Time Environment

The `webapp` target is the clearest example of why build-time and deploy-time
environment must stay separate.

Vite only exposes variables with `VITE_*` names to browser code. The app needs:

```text
VITE_GRAPHQL_HTTP
VITE_GRAPHQL_WS
```

But the repository and CI use deployment-facing names:

```text
WEBAPP_VITE_GRAPHQL_HTTP
WEBAPP_VITE_GRAPHQL_WS
```

The package target maps the deployment names into the Vite names during the
build:

```text
WEBAPP_VITE_GRAPHQL_HTTP -> VITE_GRAPHQL_HTTP
WEBAPP_VITE_GRAPHQL_WS   -> VITE_GRAPHQL_WS
```

That is a build concern, not a Cloudflare deploy concern. By the time
`deploy-webapp.sh` runs, the static files already contain the endpoint values
they were built with. The deploy script still receives the `WEBAPP_*` values
because it validates that the deployment configuration is complete and because
the workflow has a single provider-facing vocabulary.

This avoids a common bug: treating `VITE_*` values as runtime secrets or
deploy-time Cloudflare settings. They are not. They are public browser
configuration baked into the artifact.

The server has the opposite shape. Its runtime values, such as database,
Redis, CORS, and Cloud Run service account settings, are not compiled into the
app. They are provided to Cloud Run or read from Secret Manager during
deployment and runtime.

## Deploy Targets

Deploy targets answer a different question:

```text
How should this artifact be deployed?
```

The `server` deploy target runs:

```text
deploy/cloudrun/scripts/deploy-server.sh
```

Its Rush Delivery metadata gives that script a runtime container with the
tools it needs:

- Node, because the packaged server runs migrations with npm
- Docker CLI, because the deploy builds and pushes a backend image
- Google Cloud CLI, because it reads secrets, configures Artifact Registry,
  deploys Cloud Run, and resolves the deployed service URL
- an explicit Google credentials file mount
- only the workspace directories and files needed for backend deployment

The `webapp` deploy target runs:

```text
deploy/cloudflare-pages/scripts/deploy-webapp.sh
```

Its runtime is smaller:

- Node, because Wrangler is invoked through `npx`
- Git, because some Node tooling expects it
- the built `apps/webapp/dist` directory
- the Cloudflare Pages deploy scripts
- only the Cloudflare and webapp endpoint values needed for upload and
  validation

The deploy target metadata is the permission boundary for release execution.
If a script needs an environment variable, file, or directory, it must be
declared. That makes deployment failures more honest: a missing value is a
metadata or setup problem, not a hidden dependency on CI runner state.

## Server Deployment Boundary

The Cloud Run deploy script owns the repeatable backend deployment action.

In order, it:

1. requires Cloud Run and Google project environment values
2. verifies the packaged backend artifact exists
3. verifies Secret Manager entries for `DATABASE_URL`, `DATABASE_URL_DIRECT`,
   and `REDIS_URL`
4. reads `DATABASE_URL_DIRECT` for migrations
5. runs production migrations from the packaged backend
6. configures Docker authentication for Artifact Registry
7. builds and pushes the backend container image
8. deploys the image to Cloud Run
9. injects runtime values and Secret Manager bindings
10. runs the post-deploy smoke test
11. emits the Cloud Run service URL and image name

That script does not create the Google Cloud project. It does not create Neon
or Upstash resources. It does not configure GitHub repository variables. Those
are preparation concerns.

This boundary matters because the deploy script should be safe to run every
time a release happens. It assumes the deployment environment already exists
and then updates the running service to match the current artifact.

## Webapp Deployment Boundary

The Cloudflare Pages deploy script owns the repeatable frontend deployment
action.

It:

1. requires Cloudflare account, API token, Pages project, webapp URL, and
   GraphQL endpoint variables
2. verifies the built artifact directory exists
3. uploads the static assets with `wrangler pages deploy`
4. validates deployed SPA routes
5. emits the deployed webapp URL

It does not build the webapp. It does not derive backend GraphQL endpoints. It
does not create or configure the Pages project. Those concerns happen earlier:
build-time endpoint mapping happens in the package target, and Pages project
setup belongs to pre-deploy provider code.

This keeps the Cloudflare deploy action small. Given a built directory and
provider credentials, it uploads exactly that artifact.

## Deploy Mesh Ordering

The deploy mesh says:

```text
server -> webapp
```

That does not mean the frontend code depends on backend source files. It means
the production frontend deployment depends on backend deployment state.

The webapp needs stable GraphQL endpoint values:

- `WEBAPP_VITE_GRAPHQL_HTTP`
- `WEBAPP_VITE_GRAPHQL_WS`

The server needs a CORS origin that matches the deployed webapp:

- `CLOUD_RUN_CORS_ORIGIN`

Both sides must agree on the GraphQL path:

- server `GRAPHQL_PATH`
- server `AUTH_REFRESH_COOKIE_PATH`
- webapp GraphQL endpoint paths

Deploying the server first gives the release flow a natural place to validate
that the backend can boot, run migrations, serve `/health`, answer GraphQL
HTTP, and deliver GraphQL subscription events before the frontend is uploaded.

For a brand-new environment, the first deploy may still need a staged setup:
deploy the server once, resolve the Cloud Run service URL, configure webapp
GraphQL endpoint variables, then deploy the webapp. The guided pre-deploy
scenario supports that by accepting explicit backend endpoint overrides or by
resolving the live Cloud Run URL when it already exists.

## Cross-Provider Values

Most provider values should stay inside their provider boundary. A Google
service account value should not leak into the Cloudflare deploy script. A
Cloudflare API token should not be visible to the Cloud Run deploy script.

Only a small set of values intentionally cross the backend/frontend boundary:

| Value                           | Used by   | Why it crosses                                     |
| ------------------------------- | --------- | -------------------------------------------------- |
| `CLOUD_RUN_CORS_ORIGIN`         | server    | allows browser requests from the deployed frontend |
| `WEBAPP_VITE_GRAPHQL_HTTP`      | webapp    | points browser HTTP GraphQL calls at the backend   |
| `WEBAPP_VITE_GRAPHQL_WS`        | webapp    | points browser subscription traffic at the backend |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | CI/webapp | derives the production `*.pages.dev` frontend URL  |

This is why the production setup flow has to coordinate Cloud Run and
Cloudflare Pages. The providers are separate, but browser security and GraphQL
connectivity join them at the edge.

## Provider Scripts Versus Provider Packages

The repository has two kinds of provider-owned code.

Provider deploy scripts live under:

```text
deploy/cloudrun/scripts
deploy/cloudflare-pages/scripts
```

These scripts are part of production deployment. Rush Delivery calls them from
deploy target metadata. They are repeatable release steps.

Provider packages live under:

```text
deploy/providers/cloudrun
deploy/providers/cloudflare-pages
deploy/providers/github
```

These packages are pre-deploy automation. They prepare or configure provider
resources:

- Cloud Run bootstrap and Secret Manager sync
- Cloudflare Pages project provisioning
- GitHub repository variables and secrets

They are package-owned TypeScript code because provider APIs are easier to
test and evolve behind typed functions than behind large shell scripts. The
GitHub provider still shells out to the official `gh` CLI for repository
configuration, but it keeps secret values out of process arguments.

The consequence is a two-phase deployment story:

```text
provider packages and scenarios = prepare the environment
Rush Delivery workflow          = deploy artifacts into that environment
```

## GitHub Actions As The Credential Adapter

GitHub Actions is the production trigger and credential adapter.

The main workflow:

- authenticates to Google Cloud when the server may deploy
- passes the generated Google credentials file as a runtime file
- passes Cloud Run variables from GitHub repository variables
- passes Cloudflare secrets and variables from GitHub repository settings
- constructs `WEBAPP_URL` from the Pages project name
- invokes Rush Delivery

The workflow does not upload Cloudflare assets itself. It does not build the
Cloud Run image itself. It does not manually branch over target-specific
logic. That work belongs to Rush Delivery metadata and provider scripts.

The force-deploy workflows keep the same boundary. They only call the main
workflow with a forced target list:

```text
["server"]
["webapp"]
```

So a targeted deploy still uses the same credentials, metadata, package
targets, deploy scripts, and deploy mesh rules.

## Consequences For Future Changes

When adding deployment behavior, first decide which boundary owns it.

If the change affects what artifact is produced, update package metadata or
the project build.

If the change affects how an existing artifact is deployed every release,
update the provider deploy script and deploy target metadata.

If the change prepares external resources before release, add or update a
provider package function and wire it through a scenario.

If the change adds a new deployable product, add a Rush project if needed,
package target metadata, deploy target metadata, deploy mesh ordering, and CI
repository settings.

This discipline keeps deployment logic discoverable. The app code describes
application behavior. Provider scripts describe repeatable deployment.
Provider packages describe setup automation. Rush Delivery connects them
without becoming provider-specific.

## Navigation

Previous: [Rush Delivery Release Model](07-rush-delivery-release-model.md)

Next: [Pre-Deploy Scenarios And Provider Functions](09-predeploy-scenarios-and-provider-functions.md)
