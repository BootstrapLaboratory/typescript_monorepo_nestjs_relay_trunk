# Deploy Wizard App

This package is the execution host for deployment scenarios. It depends on the
generic scenario engine and on concrete scenario packages, then exposes runnable
interfaces for humans.

Today it provides a CLI command:

```sh
npm --prefix deploy/wizard run cloudrun-cloudflare-neon-upstash
```

The same boundary can host a future web wizard without moving provider-specific
steps into `deploy/scenario-engine` or execution-specific code into scenario
definition packages.
