# Deploy Scenario Engine

This project contains the thin scenario DSL and runner spike for deployment
preparation flows. Scenario authors use project-owned interfaces (`scenario`,
`step`, `text`, `secret`) while the default runner compiles that model to
XState internally.

The current executable path is intentionally fake. It proves the CLI, JSON
state store, resume/fresh behavior, and secret redaction before any real
Cloud Run or Cloudflare provider scripts are wrapped.

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
