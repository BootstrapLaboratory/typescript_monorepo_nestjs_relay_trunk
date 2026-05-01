# Deploy Scenario Engine

This project contains the thin scenario DSL and runner spike for deployment
preparation flows. Scenario authors use project-owned interfaces (`scenario`,
`step`, `text`, `secret`) while the default runner compiles that model to
XState internally.

The demo executable path is intentionally fake. It proves the CLI, JSON state
store, resume/fresh behavior, and secret redaction. A real Cloud Run bootstrap
action wrapper exists for the first production scenario, but no production
scenario is wired into the CLI yet.

## Cloud Run Bootstrap Action

`src/providers/cloudrun-bootstrap.mjs` exposes `createCloudRunBootstrapStep`.
By default it lazy-loads `deploy-provider-cloudrun` and calls
`bootstrapCloudRun(input, createGoogleCloudRunProviderDeps())`.

Build the Cloud Run provider before executing this action for real:

```sh
npm --prefix deploy/providers/cloudrun run build
```

Tests can inject a provider object into `createCloudRunBootstrapStep` so they
exercise the scenario action without initializing Google clients or making real
Google Cloud calls.

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

Secrets supplied through `secret()` inputs are removed from persisted XState
snapshots and from the CLI completion summary. Provider outputs are persisted
through the configured state store.
