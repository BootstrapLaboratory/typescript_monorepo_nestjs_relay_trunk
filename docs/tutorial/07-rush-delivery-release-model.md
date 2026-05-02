# Rush Delivery Release Model

This chapter will explain why the project uses
[Rush Delivery](https://bootstraplaboratory.github.io/rush-delivery/), how the
Dagger-based release model works, and why GitHub Actions stays thin.

Rush Delivery has its own detailed tutorial:
[Rush Delivery Tutorial](https://bootstraplaboratory.github.io/rush-delivery/docs/tutorial/).
This chapter will focus on how this project applies that model.

## Chapter Intent

Cover detect, validate, build, package, and deploy as release stages. Explain
how `.dagger` metadata connects project-owned scripts and artifacts to Rush
Delivery without embedding release logic directly in GitHub Actions.

## Navigation

Previous: [Auth, Realtime, And Browser Security](06-auth-realtime-and-browser-security.md)

Next: [Deploy Targets And Provider Boundaries](08-deploy-targets-and-provider-boundaries.md)
