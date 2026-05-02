# Deploy Scenario Engine

This project contains the thin scenario DSL and runner spike for deployment
preparation flows. Scenario authors use project-owned interfaces (`scenario`,
`step`, `text`, `secret`) while the default runner compiles that model to
XState internally.

The demo executable path is intentionally fake. It proves the CLI runtime, JSON
state store, resume/fresh behavior, and secret redaction. Concrete production
scenarios and execution hosts live outside this package and call into the
generic runtime.

Scenarios can expose structured `completionSections`. The CLI renders them
after the generic known-values list, and future UIs can render the same
metadata as scenario handoff cards.

Provider-specific step adapters live with concrete scenarios. For example,
`deploy/scenarios/cloudrun-cloudflare-neon-upstash/steps` owns the Cloud Run
and Cloudflare Pages adapters that translate scenario inputs into provider
function calls. Execution hosts live outside the engine; `deploy/wizard`
currently provides the CLI host for production scenarios. The engine package
should not depend on provider or scenario packages.

## Production Scenarios

Production scenario packages live outside this engine. They may depend on
provider packages, build provider SDK clients, and define provider-specific step
adapters. Execution hosts also live outside this engine; `deploy/wizard` is the
current host for human-facing CLI commands and is the intended boundary for a
future web wizard.

## Shell Helper

Scenario step adapters or provider compatibility layers can use `runShell` to
call existing scripts without moving their behavior into TypeScript
immediately:

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

When a step's declared outputs are already present in the state store, the
runner treats that step as completed and moves to the next incomplete step.

Secrets supplied through `secret()` inputs are available to later steps in the
same run, but are removed from persisted XState snapshots and from the CLI
completion summary. Input values are not saved to the JSON state file unless a
step intentionally returns them as provider outputs.
