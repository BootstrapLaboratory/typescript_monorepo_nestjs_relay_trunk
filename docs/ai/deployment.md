# Deployment Guidance

This document tells AI assistants how to guide production setup and deployment
conversations for this repository.

## Purpose

Use this document when a human asks how to prepare production, configure
deployment, verify pre-deployment readiness, or run the deployment path.

The answer should stay provider-neutral at the top level, then load the
provider-specific AI deployment document for exact setup details. Do not replace
the repository deployment path with ad hoc commands unless the human explicitly
asks for manual debugging.

## Deployment Model

This repository deploys through Rush Delivery and GitHub Actions.

- Rush owns project membership, dependency-aware build ordering, package
  materialization, and deploy target metadata.
- Rush Delivery owns detect, build, package, and deploy orchestration.
- GitHub Actions is the human-facing final trigger and credential adapter.
- Provider implementations live under `deploy`.
- Rush Delivery metadata lives under `.dagger`.

Current deploy targets:

- `server`: NestJS backend deployed to Cloud Run.
- `webapp`: React/Vite frontend deployed to Cloudflare Pages.

Provider-specific AI documents:

- Cloud Run backend: [../../deploy/cloudrun/docs/ai/deployment.md](../../deploy/cloudrun/docs/ai/deployment.md)
- Cloudflare Pages frontend: [../../deploy/cloudflare-pages/docs/ai/deployment.md](../../deploy/cloudflare-pages/docs/ai/deployment.md)

Workflow files:

- Main deployment workflow: [../../.github/workflows/main-workflow.yaml](../../.github/workflows/main-workflow.yaml)
- Manual targeted server deploy wrapper: [../../.github/workflows/force-deploy-server.yaml](../../.github/workflows/force-deploy-server.yaml)
- Manual targeted webapp deploy wrapper: [../../.github/workflows/force-deploy-webapp.yaml](../../.github/workflows/force-deploy-webapp.yaml)

## Provider Document Loading

Load this document first for production setup, deployment, and pre-deployment
questions. Then load provider-specific AI documents as follows:

- Read `deploy/cloudrun/docs/ai/deployment.md` when the task touches Cloud Run,
  backend production setup, server deployment, server GitHub deployment
  variables, Google Cloud infrastructure, Secret Manager, backend runtime
  secrets, production migrations, Cloud Run monitoring, or backend production
  troubleshooting.
- Read `deploy/cloudflare-pages/docs/ai/deployment.md` when the task touches
  Cloudflare Pages, frontend production setup, webapp deployment, Cloudflare
  deployment secrets, Pages project configuration, Vite production GraphQL
  endpoints, SPA route validation, or frontend production troubleshooting.
- Read both provider documents for a full production rollout, custom domain
  rollout, auth-cookie production setup, CORS changes, GraphQL HTTP/WS endpoint
  changes, or any task where the frontend and backend deployment settings must
  agree.

Provider-specific AI documents should be self-contained enough to answer the
human without requiring non-AI deployment docs. Keep them aligned with the
provider scripts and human runbooks, but prefer the AI documents as the active
assistant guidance layer.

Keep provider loading order in this document or in `AGENTS.md`. Do not add
markdown links from scoped provider AI deployment documents to parent or sibling
AI documents.

## How To Answer Humans

When asked how to deploy or prepare production, answer as a checklist that ends
with running the CI deployment workflow. The final action should be one of:

- push to `main`, which runs `main-workflow`
- manually run `force-deploy-server`
- manually run `force-deploy-webapp`

Prefer this answer shape:

1. Confirm the intended providers and target environment.
2. List required provider resources.
3. List required GitHub secrets and variables.
4. List app-specific production settings that must agree with each other.
5. List local or CI validation checks.
6. End with the GitHub Actions workflow to run.
7. Explain where to verify the deployed server and webapp URLs.

Do not tell the human that deployment is complete after local commands. Local
commands can validate or debug, but the production deployment path is CI.

## Production Readiness Checklist

Use this checklist as the high-level deployment preparation path.

- Choose providers for each target. The current provider pair is Cloud Run for
  `server` and Cloudflare Pages for `webapp`.
- Prefer checked-in preparation automation over ad hoc commands. The current
  guided scenario under `deploy/scenarios/cloudrun-cloudflare-neon-upstash`,
  run through `deploy/wizard`, requires an existing, billing-enabled Google
  Cloud project ID. It can prepare the Cloud Run backend project path, collect
  Neon and Upstash connection URLs, sync backend runtime secrets into Secret
  Manager, prepare the Cloudflare Pages project, and write GitHub repository
  variables/secrets for the production workflow. The provider scripts remain
  the provider-specific fallback and repair path.
- Also explain the manual equivalent when the human is using a restricted
  environment, debugging automation, or only adopting part of the deployment
  stack.
- Provision backend infrastructure: Google Cloud project, Artifact Registry,
  Cloud Run service, runtime service account, Workload Identity, Secret
  Manager, database, and Redis.
- Provision frontend infrastructure: Cloudflare account, Pages project, and
  API token for direct uploads.
- Configure database URLs. Runtime should use the pooled low-privilege
  `DATABASE_URL`; migrations should use `DATABASE_URL_DIRECT`.
- Configure Redis with `REDIS_URL` when production should use distributed
  pub/sub and multi-instance subscription fanout.
- Configure server auth. Use a strong `AUTH_ACCESS_TOKEN_SECRET`, keep browser
  refresh flow on HttpOnly cookie transport, and align cookie/CORS settings.
- Configure CORS. Production `CORS_ORIGIN` should be the real webapp origin,
  not wildcard CORS.
- Configure webapp GraphQL endpoints. `WEBAPP_VITE_GRAPHQL_HTTP` and
  `WEBAPP_VITE_GRAPHQL_WS` should point to the deployed backend GraphQL HTTP
  and WS endpoints. Guided setup may resolve these from the live Cloud Run
  service URL after the backend service has been deployed at least once, or
  accept explicit endpoint overrides.
- Confirm `GRAPHQL_PATH`, server refresh cookie path, and webapp GraphQL
  endpoint paths all agree.
- Configure GitHub repository variables and secrets for both providers.
- Run repository validation before deployment when possible:
  `npm run rush -- verify`.
- Commit and push configuration or code changes.
- Run the CI workflow or targeted force-deploy workflow.
- Verify backend health, GraphQL HTTP, GraphQL WS subscriptions, and webapp SPA
  routes from the deployed URLs.

## Required GitHub Configuration

The exact provider docs are the source of truth, but deployment answers should
expect these boundaries.

Backend Cloud Run variables:

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `GCP_ARTIFACT_REGISTRY_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT`
- `CLOUD_RUN_CORS_ORIGIN`

Cloudflare Pages variables and secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `WEBAPP_VITE_GRAPHQL_HTTP`
- `WEBAPP_VITE_GRAPHQL_WS`

Runtime secrets expected by the server deployment:

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `REDIS_URL`

## Auth And Security Pre-Deployment Notes

For browser production, the preferred auth setup is:

- memory-only access tokens in the webapp
- HttpOnly refresh token cookie from the server
- exact production `CORS_ORIGIN`
- `AUTH_REFRESH_TOKEN_TRANSPORT=cookie`
- `AUTH_REFRESH_COOKIE_SECURE=true`
- `AUTH_REFRESH_COOKIE_SAME_SITE=lax` unless cross-site cookies require
  `none`

Avoid recommending local storage for access or refresh tokens in browser
production. The webapp may store a non-secret session hint for first paint, but
that hint is not an auth credential and cannot restore a session by itself.

Use `AUTH_REFRESH_TOKEN_TRANSPORT=response_body` mainly for non-browser
clients, tests, CLI tools, or native clients that intentionally own refresh
token storage.

## How To Know Where The Project Is Deployed

Server:

- The Cloud Run service name comes from `CLOUD_RUN_SERVICE`.
- The region defaults through workflow configuration and current docs to
  `europe-west4`.
- The generated backend URL is visible in the Cloud Run service and deployment
  logs.
- A custom backend domain, if added later, must be reflected in
  `WEBAPP_VITE_GRAPHQL_HTTP` and `WEBAPP_VITE_GRAPHQL_WS`.

Webapp:

- The Cloudflare Pages project name comes from `CLOUDFLARE_PAGES_PROJECT_NAME`.
- The generated frontend URL is
  `https://<CLOUDFLARE_PAGES_PROJECT_NAME>.pages.dev`.
- A custom frontend domain, if added later, must be reflected in backend
  `CORS_ORIGIN`.

The webapp talks to the backend through the built Vite variables
`VITE_GRAPHQL_HTTP` and `VITE_GRAPHQL_WS`, usually supplied to deployment as
`WEBAPP_VITE_GRAPHQL_HTTP` and `WEBAPP_VITE_GRAPHQL_WS`.

## Adding More Providers

Future providers should add their own implementation under `deploy/<provider>`
and their own Rush Delivery target metadata under `.dagger` as needed.

Keep this document as the high-level AI guidance layer. Provider-specific
resource creation, credentials, scripts, and manual troubleshooting should live
in the provider directory.
