# Pre-Deploy Scenarios And Provider Functions

This chapter will explain the scenario engine, wizard host, concrete
`cloudrun-cloudflare-neon-upstash` scenario, provider packages, typed provider
functions, secret redaction, resumable state, and scenario handoff values.

## Chapter Intent

Cover why pre-deployment preparation is separate from deployment, why provider
functions are package-owned TypeScript code, and why the current scenario
prepares infrastructure and repository settings without triggering the
production deploy workflow.

## Navigation

Previous: [Deploy Targets And Provider Boundaries](08-deploy-targets-and-provider-boundaries.md)

Next: [CI Validation And Local Workflows](10-ci-validation-and-local-workflows.md)
