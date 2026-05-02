# Project Design Tutorial

This tutorial explains how this project is designed from scratch. It is not a
file-by-file rebuild guide. It is a map of the architectural decisions that make
the repository work as a full product: monorepo structure, backend, frontend,
GraphQL contract, delivery metadata, deployment providers, and pre-deployment
automation.

The goal is to make the design understandable enough that a maintainer can add
features, change providers, or create a similar project without guessing where
each responsibility belongs.

## What This Project Builds

The product is a TypeScript monorepo with:

- a NestJS GraphQL backend in `apps/server`
- a React, Vite, and Relay webapp in `apps/webapp`
- a committed GraphQL schema contract in `libs/api`
- Rush-owned project membership, dependency installation, and bulk commands
- Rush Delivery-owned release flow for detect, validate, build, package, and
  deploy
- Cloud Run deployment for the backend
- Cloudflare Pages deployment for the webapp
- provider-backed pre-deployment preparation for Google Cloud, Cloudflare
  Pages, GitHub repository configuration, Neon, and Upstash

The repository separates product runtime code from delivery and provisioning
code. That separation is one of the main design choices: application modules do
not know how Cloud Run, Cloudflare Pages, GitHub Actions, or scenario setup are
implemented.

## Technology Map

Core monorepo and delivery:

- Rush
- pnpm
- TypeScript
- GitHub Actions
- Dagger
- [Rush Delivery](https://bootstraplaboratory.github.io/rush-delivery/)

Backend:

- NestJS
- Fastify
- Apollo GraphQL
- TypeORM
- PostgreSQL
- Redis
- `graphql-ws`

Frontend:

- React
- Vite
- Relay
- TanStack Router
- vanilla-extract
- Storybook

Production and preparation:

- Google Cloud Run
- Google Artifact Registry
- Google Secret Manager
- Google Workload Identity Federation
- Cloudflare Pages
- Neon PostgreSQL
- Upstash Redis
- GitHub repository variables and secrets

## Deploy Targets

The release model has two production deploy targets:

| Target | Runtime | Package shape | Deploy path |
| --- | --- | --- | --- |
| `server` | NestJS backend on Cloud Run | Rush deploy archive | `deploy/cloudrun` scripts |
| `webapp` | Static Vite build on Cloudflare Pages | `apps/webapp/dist` directory | `deploy/cloudflare-pages` scripts |

The deploy mesh orders `webapp` after `server` because the frontend is built
against backend GraphQL endpoint values and should be released after the backend
target is available.

## How To Read This Tutorial

Read the first three chapters in order. After that, jump to the part you are
working on.

1. [System Overview](01-system-overview.md)
2. [Rush Monorepo Foundation](02-rush-monorepo-foundation.md)
3. [GraphQL Contract Boundary](03-graphql-contract-boundary.md)
4. [Server Architecture](04-server-architecture.md)
5. [Webapp Architecture](05-webapp-architecture.md)
6. [Auth, Realtime, And Browser Security](06-auth-realtime-and-browser-security.md)
7. [Rush Delivery Release Model](07-rush-delivery-release-model.md)
8. [Deploy Targets And Provider Boundaries](08-deploy-targets-and-provider-boundaries.md)
9. [Pre-Deploy Scenarios And Provider Functions](09-predeploy-scenarios-and-provider-functions.md)
10. [CI Validation And Local Workflows](10-ci-validation-and-local-workflows.md)
11. [How To Evolve The Project](11-how-to-evolve-the-project.md)

Rush Delivery has its own detailed tutorial:
[Rush Delivery Tutorial](https://bootstraplaboratory.github.io/rush-delivery/docs/tutorial/).
This project tutorial complements it. Rush Delivery's tutorial teaches the
delivery framework itself; this tutorial explains how this repository uses that
framework as part of a larger application architecture.

## Design Themes

Several themes repeat through the project:

- Stable boundaries are more important than clever abstractions.
- The server owns the GraphQL schema; the webapp consumes the committed schema.
- Rush owns project identity and dependency-aware commands.
- Rush Delivery owns the release pipeline; GitHub Actions stays thin.
- Provider-specific deployment behavior lives under `deploy`, not in app code.
- Pre-deployment scenarios prepare infrastructure and repository settings, but
  do not replace the production deploy workflow.
- Browser auth favors memory-only access tokens and HttpOnly refresh cookies.

These choices reduce hidden coupling. They also make the repository a bit more
explicit: environment variables, deploy artifacts, generated contracts, and
provider responsibilities are named rather than inferred.

## Navigation

Next: [System Overview](01-system-overview.md)
