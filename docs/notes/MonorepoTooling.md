# Monorepo Tooling Notes

This repository intentionally uses Rush and Nx for different jobs.

## Current Split

- Rush is the source of truth for dependency installation, lockfile updates, CI builds, Docker builds, and deploy packaging.
- Rush Delivery owns release planning, deploy-target builds, package
  materialization, and deploy execution.
- Nx is used only for the local `npm run dev` experience.

That split is deliberate.

Rush is the better fit for the repo's package-management and deployment model.
Nx provides a nicer local multi-process interface for long-running dev tasks,
including the terminal UI for switching between running services and focusing
on one service's logs.

## Why `npm run dev` Uses Nx

The root `npm run dev` script bootstraps Nx into `.nx/installation` instead
of using a root `node_modules` folder.

That means:

- there is no committed root dependency install model
- Nx is installed into Nx's own workspace-local `.nx/installation` directory
- the installation is created on demand the first time someone runs
  `npm run dev`
- the repo stays aligned with Rush's recommendation to avoid a real root
  `node_modules` tree

If you want the plain Rush version of the same workflow, use:

```bash
npm run dev:rush
```

## Why CI Still Uses Rush

CI, production builds, Docker images, and deploy artifacts stay Rush-native on
purpose:

- one authority for installs and lockfiles
- one authority for monorepo build selection in automation
- less drift between local tooling and production packaging

This keeps the convenience of Nx in development without making Nx a required
part of the install or deployment architecture.

Rush Delivery uses Rush for dependency-aware project selection, build ordering,
and deploy packaging. The app repository supplies metadata and provider scripts;
the reusable Dagger framework code lives upstream in
`BootstrapLaboratory/rush-delivery`.

## Nx Caching Policy

Nx caching is intentionally not enabled right now.

It can be introduced later if there is a real, measured need for it, for
example:

- repeated CI builds are materially slower than Rush's existing flow
- the team wants Nx Cloud or another remote cache for specific targets
- there is clear value in expanding Nx beyond local dev orchestration

Until that need exists, keeping Nx scoped to local `dev` avoids adding a
second build-orchestration source of truth to CI.
