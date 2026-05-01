# Deploy Scenario Engine

This project contains the thin scenario DSL and runner spike for deployment
preparation flows. Scenario authors use project-owned interfaces (`scenario`,
`step`, `text`, `secret`) while the default runner compiles that model to
XState internally.

The demo executable path is intentionally fake. It proves the CLI, JSON state
store, resume/fresh behavior, and secret redaction. The first production
scenario skeleton is wired into the CLI and currently collects Google Cloud
project details, runs the real Cloud Run bootstrap action, and collects Neon
database plus Upstash Redis URLs as transient secrets before syncing them into
Google Secret Manager.

Scenarios can expose structured `completionSections`. The CLI renders them
after the generic known-values list, and future UIs can render the same
metadata as scenario handoff cards.

## Cloud Run Bootstrap Action

`src/providers/cloudrun-bootstrap.mjs` exposes `createCloudRunBootstrapStep`.
By default it lazy-loads `deploy-provider-cloudrun` and calls
`bootstrapCloudRun(input, createGoogleCloudRunProviderDeps())`.

Build the Cloud Run provider before executing this action for real:

```sh
npm --prefix deploy/providers/cloudrun run build
```

Authenticate Google SDK calls with Application Default Credentials. Fresh
project scenarios should avoid copying the current `gcloud` project into ADC as
a quota project, because that local quota setting is not the deployment target:

```sh
gcloud auth application-default login --disable-quota-project
```

If ADC already points at a deleted or stale quota project, recreate it:

```sh
gcloud auth application-default revoke
gcloud auth application-default login --disable-quota-project
```

Tests can inject a provider object into `createCloudRunBootstrapStep` so they
exercise the scenario action without initializing Google clients or making real
Google Cloud calls.

When Google reports that billing is not enabled for the target project, the CLI
action pauses for manual billing enablement and retries the same bootstrap step
after the user presses Enter.

The Cloud Run bootstrap action persists `GITHUB_REPOSITORY` with the provider
outputs so later scenario steps and handoff summaries can reuse the repository
target without prompting again.

## Cloud Run Runtime Secrets Action

`src/providers/cloudrun-runtime-secrets.mjs` exposes
`createCloudRunRuntimeSecretsStep`. By default it lazy-loads
`deploy-provider-cloudrun` and calls
`syncCloudRunRuntimeSecrets(input, createGoogleCloudRunProviderDeps())`.

The action validates `DATABASE_URL` and `DATABASE_URL_DIRECT` as PostgreSQL
URLs, validates `REDIS_URL` as a Redis URL, and writes all three values to
Google Secret Manager. The secret values remain transient inputs; the scenario
state only records `CLOUD_RUN_RUNTIME_SECRETS_SYNCED=true`.

## Shell Helper

Provider wrappers can use `runShell` to call existing scripts without moving
their behavior into TypeScript immediately:

```js
await runShell("bash", {
  args: ["deploy/cloudrun/scripts/sync-secrets.sh"],
  env: {
    DATABASE_URL: input.DATABASE_URL,
    PROJECT_ID: input.PROJECT_ID,
  },
  redact: ["DATABASE_URL"],
});
```

`redact` entries can name variables from `env`. Matching values are removed
from captured stdout, stderr, streamed logs, returned command args, and thrown
`ShellCommandError` instances.

## Demo

Run the tiny fake scenario interactively:

```sh
npm --prefix deploy/scenario-engine run demo
```

Run the first production scenario skeleton:

```sh
npm --prefix deploy/providers/cloudrun run build
npm --prefix deploy/scenario-engine run cloudrun-cloudflare-neon-upstash
```

Run it non-interactively:

```sh
npm --prefix deploy/scenario-engine run demo -- \
  --state /tmp/tiny-cloud.json \
  --var ADMIN_TOKEN=secret-token \
  --var PROJECT_ID=demo \
  --var REGION=europe-west4
```

The CLI resumes from the saved state by default. Use `--fresh` to ignore saved
progress and start from the first step:

```sh
npm --prefix deploy/scenario-engine run demo -- --fresh
```

When a step's declared outputs are already present in the state store, the
runner treats that step as completed and moves to the next incomplete step.

Secrets supplied through `secret()` inputs are available to later steps in the
same run, but are removed from persisted XState snapshots and from the CLI
completion summary. Input values are not saved to the JSON state file unless a
step intentionally returns them as provider outputs.
