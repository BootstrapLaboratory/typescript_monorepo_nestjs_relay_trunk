# Deploy Targets And Provider Boundaries

This chapter will explain package targets, deploy targets, deploy mesh ordering,
build-time versus deploy-time environment, Cloud Run, Cloudflare Pages, and
provider script boundaries.

## Chapter Intent

Cover why `server` and `webapp` have different package shapes, why `webapp`
deploys after `server`, and why provider-specific deployment behavior lives
under `deploy` instead of inside application code.

## Navigation

Previous: [Rush Delivery Release Model](07-rush-delivery-release-model.md)

Next: [Pre-Deploy Scenarios And Provider Functions](09-predeploy-scenarios-and-provider-functions.md)
