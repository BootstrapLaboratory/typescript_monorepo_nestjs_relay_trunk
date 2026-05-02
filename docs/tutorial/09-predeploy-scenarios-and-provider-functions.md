# Pre-Deploy Scenarios And Provider Functions

Deployment is not only the final act of publishing artifacts. Before the
release workflow can deploy `server` and `webapp`, the target environment must
exist:

- Google Cloud must have the Cloud Run prerequisites
- Secret Manager must contain backend runtime secrets
- Cloudflare Pages must have a suitable project
- GitHub must have the variables and secrets the workflow reads
- frontend and backend endpoint values must agree

This project keeps that preparation work separate from production deployment.
The pre-deploy scenario prepares the environment. Rush Delivery deploys into
that environment later.

That gives the repository two different verbs:

```text
prepare = create/configure provider resources and repository settings
deploy  = validate, package, and publish built artifacts
```

The distinction is the main architectural point of this chapter.

## Why Scenarios Exist

Production setup crosses providers. Cloud Run, Secret Manager, Neon, Upstash,
Cloudflare Pages, and GitHub repository settings all participate in the first
rollout. Doing that as a single shell script would work for one happy path, but
it would be hard to resume, hard to test, and risky around secrets.

The scenario layer gives setup work a more deliberate shape:

- each setup step has a title, guide text, inputs, outputs, and a runner
- secret inputs are marked as secrets instead of ordinary text
- step outputs are persisted so completed steps can be skipped on resume
- scenario completion can print structured handoff sections
- provider calls live behind package-owned functions
- the same scenario definition can be hosted by a CLI now and a web wizard
  later

The consequence is that setup becomes a guided workflow instead of tribal
knowledge hidden in a terminal transcript.

## Scenario Engine Boundary

The generic engine lives in:

```text
deploy/scenario-engine
```

It owns the small project-specific scenario DSL:

```text
scenario()
step()
text()
secret()
```

That DSL is intentionally plain. It describes the shape of a preparation flow;
it does not know anything about Google Cloud, Cloudflare, GitHub, Neon, or
Upstash.

A step has:

- an `id`, used for resume and event names
- a `title`, used by human-facing UIs
- `guide` text, used to explain what the human should do
- declared inputs
- declared outputs
- a `run` function

The engine also owns generic runtime behavior:

- collect missing inputs
- skip a step when its outputs already exist
- persist outputs
- redact secret values from persisted snapshots and summaries
- render CLI completion summaries
- expose a JSON state store

That is the correct level of abstraction for a shared engine. Provider logic
would make it less reusable.

## XState As The Default Runner

The default runner compiles the scenario model to an XState machine.

For each step, the machine follows the same lifecycle:

```text
checking -> collecting -> running -> done
```

The `checking` state decides whether the step can be skipped because all of its
declared outputs are already known. The `collecting` state prompts for missing
inputs. The `running` state calls the step's provider adapter. The `done` state
moves to the next step.

XState is useful here because setup flows are naturally stateful. A user may
start a scenario, enable billing in a browser, return later, rerun the command,
or resume after a failure. A state machine makes those transitions explicit
instead of scattering resume logic through step code.

The engine still keeps a plain runner as a reference/fallback path. That keeps
the DSL independent from XState even though XState is the current default.

## State And Resume

The CLI runtime stores scenario progress in a JSON file. By default, the
production scenario uses a state path under:

```text
~/.config/beltapp/deploy-scenarios
```

The state file has two jobs:

- remember step outputs that are safe to persist
- remember a sanitized active machine snapshot while a scenario is running

When a scenario resumes, stored outputs are loaded first. If a step's outputs
already exist, that step is treated as complete and the runner advances to the
next incomplete step.

This design is friendly to provider setup because many setup actions are
idempotent but slow. If Cloud Run bootstrap completed yesterday, the next run
should not ask the user to repeat it just because a later GitHub configuration
step failed.

`--fresh` intentionally ignores saved progress. That gives the user a clean
run when they want to test the whole flow again or recover from a bad state
file.

## Secret Handling

The engine distinguishes `text()` inputs from `secret()` inputs.

Secret inputs are available to later steps in the same run, but they are
removed from persisted snapshots and from the final known-values summary. This
is important for:

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `REDIS_URL`
- `CLOUDFLARE_API_TOKEN`

Those values need to flow between steps. They should not become local scenario
state.

The shell helper follows the same principle. When a step adapter or temporary
compatibility layer calls an existing shell script, it can mark environment
values for redaction. Matching secret values are removed from stdout, stderr,
returned command arguments, and thrown command errors.

The consequence is not that secrets become magically harmless. The consequence
is narrower: scenario code has a consistent place to mark sensitive values, and
the runtime avoids the most obvious accidental persistence and logging leaks.

## Wizard Host Boundary

The human-facing host currently lives in:

```text
deploy/wizard
```

The wizard imports the scenario registry and passes it to the generic CLI
runtime. Today that gives the repository this command:

```text
npm --prefix deploy/wizard run cloudrun-cloudflare-neon-upstash
```

The registry is separate from the CLI entrypoint on purpose. A future web
wizard can import the same scenario registry, render each step as a page or
form, and call the same engine/runtime APIs.

That keeps responsibilities clean:

| Part              | Owns                                               |
| ----------------- | -------------------------------------------------- |
| Scenario engine   | generic DSL, runners, state, redaction             |
| Scenario package  | concrete setup flow and provider step adapters     |
| Wizard host       | human-facing execution surface                     |
| Provider packages | typed provider operations and SDK/CLI dependencies |

The engine does not know about production providers. The wizard does not own
provider setup logic. The scenario package composes them.

## Current Production Scenario

The first production scenario lives in:

```text
deploy/scenarios/cloudrun-cloudflare-neon-upstash
```

Its job is to prepare the current provider pair:

- Cloud Run for the backend
- Cloudflare Pages for the frontend
- Neon for PostgreSQL
- Upstash for Redis
- GitHub Actions for deployment credentials and configuration

The scenario deliberately requires an existing Google Cloud project. It asks
the user for a `PROJECT_ID`, but it does not create the project. It can pause
when Google reports that billing must be enabled, give the user the billing
page, and retry after the user continues.

The broad step order is:

1. choose an existing Google Cloud project
2. bootstrap Cloud Run prerequisites
3. collect Neon database URLs
4. collect the Upstash Redis URL
5. sync Cloud Run runtime secrets
6. prepare the Cloudflare Pages project
7. configure GitHub repository variables and secrets

That order mirrors the real dependency flow. GitHub repository configuration
needs values produced by Cloud Run bootstrap and Cloudflare Pages
provisioning. Webapp GraphQL endpoints may depend on the live Cloud Run service
URL. Backend CORS may depend on the Pages URL.

## Cloud Run Provider Functions

The Cloud Run provider package lives in:

```text
deploy/providers/cloudrun
```

It contains typed provider functions such as:

```text
bootstrapCloudRun()
syncCloudRunRuntimeSecrets()
```

`bootstrapCloudRun()` prepares the Google-side deployment foundation:

- verify the existing project and read its project number
- optionally link billing when a billing account is supplied
- enable required Google APIs
- ensure an Artifact Registry Docker repository exists
- ensure deployer and runtime service accounts exist
- ensure a Workload Identity pool and GitHub OIDC provider exist
- grant IAM bindings for Cloud Run deploy, Artifact Registry push, runtime
  service account impersonation, and GitHub OIDC
- return the GitHub variables needed by the backend deploy workflow

`syncCloudRunRuntimeSecrets()` writes the backend runtime secrets:

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `REDIS_URL`

It grants the deployer service account access to all three secrets and grants
the Cloud Run runtime service account access only to the secrets needed at
runtime: `DATABASE_URL` and `REDIS_URL`.

The provider uses official Google SDKs and generated Google clients where
possible. The scenario step adapters lazy-load the built provider package, so
the scenario can be tested with injected provider functions and run with real
Google-backed dependencies after the provider package is built.

## Cloudflare Pages Provider Functions

The Cloudflare Pages provider package lives in:

```text
deploy/providers/cloudflare-pages
```

Its current job is setup, not deployment.

It can:

- ensure a Pages project exists
- set the production branch
- disable automatic Cloudflare Git deployments when the project has Git source
  deployment controls
- return the generated Pages URL

It does not upload assets. Asset upload belongs to the `webapp` deploy target
and `deploy/cloudflare-pages/scripts/deploy-webapp.sh`.

It also does not configure GitHub repository values or derive backend GraphQL
URLs. Those responsibilities belong to the GitHub provider and the scenario's
cross-provider resolution step.

## GitHub Provider Functions

The GitHub provider package lives in:

```text
deploy/providers/github
```

It writes the repository values consumed by the GitHub Actions production
workflow.

Variables include:

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `GCP_ARTIFACT_REGISTRY_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT`
- `CLOUD_RUN_CORS_ORIGIN`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `WEBAPP_VITE_GRAPHQL_HTTP`
- `WEBAPP_VITE_GRAPHQL_WS`

Secrets include:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The real dependency uses the official `gh` CLI. Secrets are sent through stdin,
not process arguments, which avoids exposing them in command-line listings.

The GitHub provider is intentionally narrow. It configures repository variables
and secrets, but it does not run workflows, manage repository permissions, or
create cloud resources.

## Endpoint Resolution And Handoff

The scenario's final GitHub repository configuration step is where
cross-provider values meet.

For backend CORS, it uses an explicit `CLOUD_RUN_CORS_ORIGIN` when supplied.
Otherwise it defaults to the Cloudflare Pages URL.

For webapp GraphQL endpoints, it uses explicit
`WEBAPP_VITE_GRAPHQL_HTTP` and `WEBAPP_VITE_GRAPHQL_WS` values when supplied.
Otherwise it asks Google Cloud for the live Cloud Run service URL and appends
`/graphql`. It derives the WebSocket endpoint from the HTTP endpoint.

That is why a brand-new environment may need a staged first rollout:

```text
prepare Cloud Run prerequisites
deploy server once
rerun repository configuration to resolve the live backend URL
deploy webapp
```

The scenario also supports `CLOUD_RUN_PUBLIC_URL` when the backend origin is
already known. That keeps custom domains and manually discovered URLs from
becoming special cases inside the deploy workflow.

At completion, the scenario prints structured handoff sections:

- Cloud Run backend GitHub variables
- Cloudflare Pages project values
- GitHub repository configuration values
- the next production deploy command

Those summaries are generated from scenario metadata, so a future UI can render
the same handoff information as cards instead of terminal text.

## Why The Scenario Does Not Deploy

When the scenario finishes, it does not trigger `main-workflow`.

That is deliberate.

The scenario runs in a local or operator-controlled setup context. It may use
Application Default Credentials, a local `gh` login, and transient pasted
secrets. The production deploy path runs in GitHub Actions with Workload
Identity, repository variables, repository secrets, Rush Delivery metadata, and
the committed source tree.

Keeping those separate gives a clearer audit boundary:

```text
scenario result = environment and repository are ready
workflow result = this commit was deployed
```

It also prevents an accidental setup run from publishing whatever happens to
be in the local working tree.

The scenario's final instruction is therefore a handoff: from a clean pushed
branch, run the deployment workflow.

## Consequences For Future Scenarios

Future setup work should follow the same ownership rules.

If a step is generic flow control, it belongs in `deploy/scenario-engine`.

If a step is specific to one production setup story, it belongs in a concrete
scenario package under `deploy/scenarios`.

If code talks to a provider API, it should live behind a provider package
function under `deploy/providers`.

If code only hosts scenarios for humans, it belongs in `deploy/wizard` or a
future host package.

If the action publishes artifacts, it probably does not belong in a pre-deploy
scenario. It belongs in Rush Delivery target metadata and provider deploy
scripts.

This keeps the setup system evolvable. New scenarios can compose existing
provider functions. Provider functions can gain tests without driving a CLI.
The wizard can change presentation without changing cloud automation. And
deployment remains the responsibility of the CI release workflow.

## Navigation

Previous: [Deploy Targets And Provider Boundaries](08-deploy-targets-and-provider-boundaries.md)

Next: [CI Validation And Local Workflows](10-ci-validation-and-local-workflows.md)
