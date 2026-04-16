# Migration To Cloud Run Production

## Goal

Deploy this project as one exact production stack:

- Frontend: Cloudflare Pages
- Backend: Google Cloud Run
- Database: Neon PostgreSQL
- Shared pub/sub: Redis
- CI/CD: GitHub Actions

The target outcome is a production-ready setup that:

- keeps the current NestJS + GraphQL + React/Relay + PostgreSQL architecture
- removes the current single-instance requirement caused by in-memory pub/sub
- uses proper database migrations instead of runtime schema sync
- supports public HTTPS GraphQL queries, mutations, and subscriptions
- can scale to multiple Cloud Run instances without sticky-session dependency

## Locked Decisions

These choices are fixed for this migration plan:

- Frontend host: `Cloudflare Pages`
- Backend host: `Google Cloud Run`
- Database: `Neon PostgreSQL`
- Shared pub/sub for production: `Redis`
- CI/CD provider: `GitHub Actions`
- Primary Cloud Run region: `europe-west4` (Netherlands)
- Primary Neon region: `aws-eu-central-1` (Frankfurt)
- Future custom domains:
  - `app.example.com`
  - `api.example.com`

## Non-Negotiable Compatibility Requirement

This migration must not break local development.

Mandatory rule:

- after all production changes, the project must still work in the devcontainer as a full local development environment

That means:

- local development must continue working without requiring cloud resources
- the existing devcontainer workflow must remain supported
- environment-based configuration must allow local and production behavior to differ safely
- production-only infrastructure choices must not force the devcontainer to depend on managed cloud services

Required local behavior:

- the current local PostgreSQL flow must keep working
- local Redis must run in the devcontainer setup for production parity
- `npm run dev` from the repo root must keep working in the devcontainer
- the client and server must continue to run together locally
- local GraphQL queries, mutations, and subscriptions must still work

Required local strategy:

- production uses `Redis`
- local devcontainer development also uses `Redis`
- the primary dev and prod pub/sub path should be the same
- `memory` pub/sub may remain only as an optional fallback for tests or emergency local debugging, not as the standard development path

## Current Repo Constraints

These are the repo details that directly affect the migration:

- Backend subscriptions are enabled in [apps/server/src/app.module.ts](/workspace/apps/server/src/app.module.ts:26).
- Subscription events are currently process-local because of `const pubSub = new PubSub()` in [apps/server/src/modules/chat/chat.resolver.ts](/workspace/apps/server/src/modules/chat/chat.resolver.ts:8).
- Database credentials and database name are hard-coded in [apps/server/src/app.module.ts](/workspace/apps/server/src/app.module.ts:38).
- `synchronize: true` is enabled in [apps/server/src/app.module.ts](/workspace/apps/server/src/app.module.ts:46), which is not safe for production.
- CORS currently allows all origins in [apps/server/src/main.ts](/workspace/apps/server/src/main.ts:14).
- The client production config assumes same-origin `/api/graphql` in [apps/client/.env.production](/workspace/apps/client/.env.production:1).
- The client production WebSocket URL builder assumes `VITE_GRAPHQL_WS` is a path, not an absolute URL, in [apps/client/src/main.tsx](/workspace/apps/client/src/main.tsx:29).
- The current app-level Dockerfiles are not ready to use as-is for Cloud Run from this monorepo layout.

## Recommended Production Architecture

### Base Layout

- Initial frontend URL: `https://<cloudflare-pages-project>.pages.dev`
- Initial backend URL: Cloud Run generated stable `run.app` URL
- Future frontend URL: `https://app.example.com`
- Future backend URL: `https://api.example.com`
- Backend runtime region: `europe-west4` (Netherlands)
- Database region: `aws-eu-central-1` (Frankfurt)
- Shared pub/sub: `Redis`

### Recommended Defaults

- Cloud Run `min instances = 0`
- Cloud Run `max instances = 2` or `3`
- Cloud Run request timeout set high enough for WebSockets
- Cloud Run region fixed to `europe-west4`
- Neon region fixed to `aws-eu-central-1`
- Frontend and backend on separate subdomains
- Backend CORS locked to the actual frontend origin
- Shared Redis pub/sub added before enabling multi-instance scaling

### URL Plan

Phase 1 deployment should not wait on custom domains.

Start with provider-generated URLs:

- Frontend: `https://<project>.pages.dev`
- Backend: `https://<service>-<project-number>.europe-west4.run.app` when deterministic URL is available, otherwise the stable generated `run.app` service URL returned by Cloud Run

Add custom domains later:

- `app.example.com` -> Cloudflare Pages
- `api.example.com` -> Cloud Run

## Why This Region Pair

This plan uses:

- Cloud Run `europe-west4` because it is a European Cloud Run region with Tier 1 pricing and Cloud Run domain mapping support
- Neon `aws-eu-central-1` because Frankfurt is Neon's closest generally available European region to the Netherlands among Neon's currently documented regions

This is a best-fit Europe choice for this project, not a guarantee of absolute lowest latency in every network path.

## Phase 0: Decisions To Lock Before Coding

- [x] Frontend host fixed to `Cloudflare Pages`
- [x] Backend host fixed to `Google Cloud Run`
- [x] Database fixed to `Neon PostgreSQL`
- [x] Production shared pub/sub fixed to `Redis`
- [x] CI provider fixed to `GitHub Actions`
- [x] Cloud Run region fixed to `europe-west4`
- [x] Neon region fixed to `aws-eu-central-1`
- [x] Final custom domains reserved as:
  - `app.example.com`
  - `api.example.com`
- [x] Initial rollout will use provider-generated URLs before custom domains
- [x] Local Redis is mandatory in the devcontainer for dev-to-prod parity

## Phase 1: Make Backend Configuration Production-Safe

### Environment Variables

- [x] Replace hard-coded DB settings in [apps/server/src/app.module.ts](/workspace/apps/server/src/app.module.ts:38) with environment-driven config
- [x] Support `DATABASE_URL` as the primary production database setting
- [x] Add explicit SSL configuration for Neon
- [ ] Add environment variables for:
  - `DATABASE_URL`
  - `DATABASE_URL_DIRECT` if needed for migrations or non-pooled direct access
  - `CORS_ORIGIN`
  - `GRAPHQL_PATH`
  - `PORT`
  - `PUBSUB_DRIVER`
  - `REDIS_URL`
- [x] Keep local `.env.development` support working in the devcontainer
- [ ] Keep production env vars separate from local env vars
- [x] Ensure local development env vars include Redis configuration

### TypeORM Setup

- [x] Refactor TypeORM config into a reusable config factory instead of keeping all settings inline in `AppModule`
- [ ] Create a TypeORM `DataSource` file for CLI-based migrations
- [x] Remove `synchronize: true` from production behavior
- [x] Keep `synchronize` only for local development if you still want that convenience

### App Safety

- [x] Restrict CORS in [apps/server/src/main.ts](/workspace/apps/server/src/main.ts:14) to the frontend origin instead of `*`
- [ ] Add a simple health endpoint for deployment smoke tests and uptime checks
- [x] Confirm the server binds correctly on `0.0.0.0` for container runtime compatibility
- [x] Add graceful shutdown handling so WebSocket connections and DB pool close cleanly
- [x] Keep local development CORS behavior convenient enough for the devcontainer flow

## Phase 2: Replace In-Memory Pub/Sub With Shared Pub/Sub

### Code Shape

- [x] Remove the module-level `new PubSub()` in [apps/server/src/modules/chat/chat.resolver.ts](/workspace/apps/server/src/modules/chat/chat.resolver.ts:8)
- [x] Introduce a `PubSubService` abstraction with methods like:
  - `publishMessageAdded`
  - `subscribeMessageAdded`
- [x] Inject the shared pub/sub service into the resolver instead of using a process-local singleton
- [x] Support at least these drivers behind the abstraction:
  - `redis` for standard local devcontainer development
  - `redis` for production
  - optional `memory` fallback only if still useful for tests or emergency debugging

### Delivery Behavior

- [x] Publish events only after the message has been saved successfully
- [ ] Ensure every Cloud Run instance can receive events published by any other instance
- [x] Add reconnect behavior for the shared pub/sub client
- [ ] Log subscription disconnects and reconnects for debugging
- [ ] Keep local subscriptions working through Redis in the devcontainer

### Chosen Production Strategy: Redis

- [x] Add a Redis client and a Redis-backed pub/sub implementation
- [x] Use separate publisher and subscriber connections
- [x] Keep per-instance in-memory fanout only for connected local WebSocket clients
- [x] Use Redis only as the cross-instance event bus
- [ ] Provision a low-cost or free Redis provider suitable for hobby traffic
- [ ] Store `REDIS_URL` as a backend secret for Cloud Run

### Local Dev Strategy

- [x] Add a local Redis service to [docker-compose.localdb.yml](/workspace/.devcontainer/docker-compose.localdb.yml:1)
- [x] Wire the devcontainer to start Redis together with PostgreSQL
- [x] Add local Redis env vars for the backend
- [x] Make Redis the default pub/sub driver in the devcontainer
- [x] Keep `npm run dev` working in the devcontainer with PostgreSQL and Redis running together
- [x] If `memory` mode is kept, ensure it is not the normal devcontainer path

### Scale-Out Validation

- [ ] Verify that two backend instances both receive events correctly
- [ ] Verify that a message created on instance A is delivered to subscribers connected to instance B
- [ ] Remove any reliance on sticky sessions after shared pub/sub works

## Phase 3: Make The Client Work With Separate Frontend And API Hosts

### Environment Variable Model

- [x] Stop assuming production API calls are same-origin `/api/graphql`
- [x] Replace [.env.production](/workspace/apps/client/.env.production:1) with production values that can be absolute URLs
- [x] Support:
  - initial frontend -> backend:
    - `VITE_GRAPHQL_HTTP=<Cloud Run generated HTTPS URL>/graphql`
    - `VITE_GRAPHQL_WS=<Cloud Run generated WSS URL>/graphql`
  - future custom-domain frontend -> backend:
    - `VITE_GRAPHQL_HTTP=https://api.example.com/graphql`
    - `VITE_GRAPHQL_WS=wss://api.example.com/graphql`
- [x] Preserve current local development URLs for the devcontainer

### Client Runtime Logic

- [x] Update [apps/client/src/main.tsx](/workspace/apps/client/src/main.tsx:23) so production supports absolute WebSocket URLs
- [x] Keep local development behavior working exactly as it does now
- [ ] Add retry and reconnect settings to the `graphql-ws` client
- [ ] Handle temporary disconnects cleanly after Cloud Run instance restarts or cold starts

### Subscription UX

- [ ] Prevent duplicate message insertion in the Relay store updater if reconnect causes replay or race conditions
- [ ] Decide how the UI should behave during reconnect:
  - silent retry
  - status banner
  - disabled send button on disconnect

## Phase 4: Add Database Migrations

### Migration Baseline

- [x] Create an initial migration for the `message` table
- [x] Document the command used to generate and run migrations
- [x] Add scripts in [apps/server/package.json](/workspace/apps/server/package.json:8) for:
  - `migration:generate`
  - `migration:run`
  - `migration:revert`

### Deployment Rule

- [ ] Make production schema changes happen through migrations only
- [ ] Run migrations in CI/CD before or during deploy
- [ ] Fail deployment if migrations fail

## Phase 5: Create Production Container Build For The Backend

### Container Build

- [ ] Create a dedicated Cloud Run backend Dockerfile that works from the monorepo root
- [ ] Ensure the build installs only what the backend needs
- [ ] Build the Nest app in CI, then package the runtime image cleanly
- [ ] Avoid relying on the current app Dockerfiles until they are fixed or replaced
- [ ] Ensure the production container build does not break the devcontainer workflow

### Backend Runtime Requirements

- [ ] Ensure the container starts with `NODE_ENV=production`
- [ ] Ensure `PORT` is honored
- [ ] Ensure the image includes only runtime dependencies in the final stage
- [ ] Add a lightweight startup smoke check in CI

## Phase 6: Create Frontend Deployment Flow

### Static Hosting

- [ ] Configure `Cloudflare Pages` to build `apps/client`
- [ ] Set production env vars on the frontend host:
  - `VITE_GRAPHQL_HTTP`
  - `VITE_GRAPHQL_WS`
- [ ] Use the generated `*.pages.dev` URL for the initial production rollout
- [ ] Make preview deployments point to either:
  - a shared dev API
  - a preview API
  - or disable previews until backend preview strategy is decided

### Routing

- [ ] Confirm SPA routing works on the chosen host
- [ ] Confirm the frontend can call the Cloud Run API over HTTPS
- [ ] Confirm WebSocket upgrade to the API host works from the deployed frontend origin

## Phase 7: Provision Cloud Resources

### Google Cloud

- [ ] Create a Google Cloud project
- [ ] Enable:
  - Cloud Run
  - Artifact Registry
  - Secret Manager
  - Cloud Build if used
- [ ] Create Artifact Registry repository for backend images
- [ ] Create service account for deployment
- [ ] Grant least-privilege IAM roles to CI

### Neon

- [ ] Create Neon project and database
- [ ] Create the Neon project in `aws-eu-central-1`
- [ ] Create least-privilege app user
- [ ] Store connection string securely
- [ ] Choose direct or pooled connection mode intentionally
- [ ] Keep Cloud Run instance count low enough to avoid excessive DB connections

### Redis

- [ ] Create a Redis instance suitable for hobby-scale pub/sub traffic
- [ ] Capture the production `REDIS_URL`
- [ ] Verify the Redis provider region is acceptable for Europe-bound latency
- [x] Define the matching local Redis connection shape used in the devcontainer

### Secrets

- [ ] Store backend secrets in Secret Manager or Cloud Run secrets:
  - `DATABASE_URL`
  - `CORS_ORIGIN`
  - `PUBSUB_DRIVER`
  - `REDIS_URL` if used
- [ ] Store frontend env vars in the frontend hosting provider

## Phase 8: Configure Cloud Run Service

### Deployment Settings

- [ ] Set public access if the API is meant to be public
- [ ] Set request timeout high enough for long-lived WebSocket connections
- [ ] Set `min instances = 0` to stay close to free-tier usage
- [ ] Set `max instances` to a low number to control cost and DB connection count
- [ ] Set concurrency intentionally rather than leaving it unreviewed
- [ ] Deploy the service specifically to `europe-west4`

### Networking

- [ ] Use the generated `run.app` URL for the first rollout
- [ ] Add `api.example.com` later
- [ ] Confirm CORS matches the real frontend origin
- [ ] Confirm WebSocket upgrades work through the Cloud Run domain and custom domain

### Runtime Validation

- [ ] Deploy one instance and validate GraphQL query, mutation, and subscription
- [ ] Scale to multiple instances and validate cross-instance subscription fanout

## Phase 9: Build The CI/CD Pipeline

### Pull Request Pipeline

- [ ] Install dependencies
- [ ] Run lint
- [ ] Run tests
- [ ] Build server
- [ ] Build client
- [ ] Optionally run a container build validation for the backend image
- [ ] Validate that the project still builds and runs in a local-style configuration compatible with the devcontainer assumptions

### Main Branch Deploy Pipeline

- [ ] Build backend image
- [ ] Push image to Artifact Registry
- [ ] Run database migrations
- [ ] Deploy backend to Cloud Run
- [ ] Trigger frontend deployment or allow host auto-deploy from main
- [ ] Run smoke tests against the deployed environment

### Smoke Tests

- [ ] HTTP health check passes
- [ ] GraphQL `getMessages` query succeeds
- [ ] GraphQL `addMessage` mutation succeeds
- [ ] Subscription receives a newly created message

## Phase 10: Observability And Operations

### Logging

- [ ] Add structured logs for:
  - startup
  - DB connection failures
  - pub/sub connection failures
  - subscription connect/disconnect
  - publish and delivery failures

### Monitoring

- [ ] Add alerts for backend crash loops or repeated failed deploys
- [ ] Track Cloud Run revision health
- [ ] Track Neon connection or availability issues

### Recovery

- [ ] Document rollback steps for backend image revisions
- [ ] Document migration rollback process
- [ ] Document how to rotate secrets
- [ ] Document how to keep local devcontainer setup working when production env vars evolve

## Repo Change Checklist

These are the most likely repo touchpoints for this migration:

- [x] [apps/server/src/app.module.ts](/workspace/apps/server/src/app.module.ts:1)
  - move TypeORM config out of hard-coded inline production settings
  - disable production sync
- [x] [apps/server/src/main.ts](/workspace/apps/server/src/main.ts:1)
  - tighten CORS
  - add shutdown handling if needed
- [x] [apps/server/src/modules/chat/chat.resolver.ts](/workspace/apps/server/src/modules/chat/chat.resolver.ts:1)
  - replace in-memory pub/sub usage
- [x] `apps/server/src/modules/chat/...`
  - add shared pub/sub service implementation
- [x] [apps/server/package.json](/workspace/apps/server/package.json:1)
  - add migration scripts
- [x] `apps/server/src/database/...`
  - add TypeORM DataSource and migrations
- [x] [apps/client/src/main.tsx](/workspace/apps/client/src/main.tsx:1)
  - support absolute production HTTP and WS URLs
- [x] [apps/client/.env.production](/workspace/apps/client/.env.production:1)
  - switch to generated Cloud Run API URL first
  - support later move to `api.example.com`
- [x] [apps/server/.env.development](/workspace/apps/server/.env.development:1)
  - keep local devcontainer database flow working
  - add local Redis config
- [ ] [apps/client/.env.development](/workspace/apps/client/.env.development:1)
  - keep local devcontainer API URLs working
- [ ] `Dockerfile` or `deploy/cloudrun/...`
  - add a real backend production container build
- [ ] `.github/workflows/...`
  - add GitHub Actions CI/CD pipeline
- [x] `docker-compose.localdb.yml` and `.devcontainer/...` if local parity updates are needed
  - preserve the existing devcontainer behavior
  - add Redis as part of the standard local stack

## Done Definition

The migration is complete when all of the following are true:

- [ ] Frontend is deployed on a static host and served over HTTPS
- [ ] Backend is deployed on Cloud Run and reachable over HTTPS
- [ ] Backend uses environment-driven config only
- [ ] Database schema is managed by migrations, not `synchronize`
- [ ] Shared pub/sub works across multiple Cloud Run instances
- [ ] WebSocket subscriptions reconnect cleanly after restart or cold start
- [ ] CI validates builds and tests on every change
- [ ] Main branch deploys backend and frontend automatically
- [ ] Smoke tests verify query, mutation, and subscription after deploy
- [ ] Costs are capped with low max instances and no always-on resources unless explicitly chosen
- [x] The project still works in the devcontainer without requiring cloud services
- [x] `npm run dev` still works locally in the devcontainer after the migration changes
- [x] The devcontainer standard stack includes both PostgreSQL and Redis

## Suggested Implementation Order

- [ ] 1. Production-safe env config and migration setup
- [ ] 2. Client absolute URL support
- [ ] 3. Shared pub/sub implementation with `redis` for both local devcontainer and production
- [ ] 4. Backend Cloud Run container build
- [ ] 5. Cloud resource provisioning
- [ ] 6. GitHub Actions CI/CD pipeline
- [ ] 7. Multi-instance validation

## Notes

- If the goal is "stay free as long as possible", keep Cloud Run `min instances = 0` and `max instances` low.
- If the goal is "best reliability for subscriptions", shared Redis pub/sub is required before allowing more than one backend instance.
- For this repo, local Redis is required to preserve better dev-to-prod parity.
- Use env vars to separate local behavior from production behavior without forking the codebase.
