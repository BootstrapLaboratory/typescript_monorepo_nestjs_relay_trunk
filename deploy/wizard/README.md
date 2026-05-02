# Deploy Wizard App

This package is the execution host for deployment scenarios. It depends on the
generic scenario engine and on concrete scenario packages, then exposes runnable
interfaces for humans.

Today it provides a CLI command:

```sh
npm --prefix deploy/wizard run cloudrun-cloudflare-neon-upstash
```

Scenario registration lives in `src/scenarios.mjs`. The CLI imports that
registry and passes it to the generic engine CLI runtime.

The same boundary can host a future web wizard. A web entrypoint should import
the same scenario registry, render each step's `title`, `guide`, and `inputs`
as pages/forms, persist progress through a browser or backend store, and call
the same engine/runtime APIs. Provider-specific steps stay in scenario packages;
generic execution behavior stays in `deploy/scenario-engine`.
