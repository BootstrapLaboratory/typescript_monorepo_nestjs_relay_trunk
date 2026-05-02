# Create Project Design Tutorial

## Goal

Create a self-contained tutorial under `docs/tutorial/` that explains how this
project is designed from scratch.

The tutorial should teach the architectural shape and decision tradeoffs rather
than walk through every file. It should describe the important parts of the
system, why they exist, what they give us, and what consequences they create for
future changes.

## Audience

- Developers studying the project before contributing.
- Developers who want to build a similar Rush monorepo with a NestJS backend,
  React/Relay frontend, shared GraphQL contract, and provider-backed deployment
  path.
- Future maintainers deciding where new app, deployment, or scenario behavior
  should live.

## Documentation Shape

Create the first version as isolated, cross-linked Markdown documents:

```text
docs/tutorial/
  README.md
  01-system-overview.md
  02-rush-monorepo-foundation.md
  03-graphql-contract-boundary.md
  04-server-architecture.md
  05-webapp-architecture.md
  06-auth-realtime-and-browser-security.md
  07-rush-delivery-release-model.md
  08-deploy-targets-and-provider-boundaries.md
  09-predeploy-scenarios-and-provider-functions.md
  10-ci-validation-and-local-workflows.md
  11-how-to-evolve-the-project.md
```

Use relative links for repository-local documents. Link to Rush Delivery as an
external reference:

- https://bootstraplaboratory.github.io/rush-delivery/
- https://bootstraplaboratory.github.io/rush-delivery/docs/tutorial/

## Style Principles

- Prefer architecture explanation over copy-pasted code.
- Use small excerpts only when they clarify a contract or decision.
- Each chapter should explain:
  - what decision was made
  - why it was made
  - what consequence it has
  - what failure mode it avoids
- Keep chapters readable on their own, but include previous/next navigation.
- Keep this tutorial complementary to the Rush Delivery tutorial. Do not
  duplicate their metadata walkthrough; explain how this project uses that
  release model.

## Source Material

- `docs/ai/architecture.md`
- `docs/ai/deployment.md`
- `apps/server/docs/ai/architecture.md`
- `apps/webapp/docs/ai/architecture.md`
- `libs/api/docs/ai/architecture.md`
- `deploy/scenario-engine/README.md`
- `deploy/scenarios/cloudrun-cloudflare-neon-upstash/README.md`
- `deploy/wizard/README.md`
- `deploy/providers/cloudrun/README.md`
- `deploy/providers/cloudflare-pages/README.md`
- `deploy/providers/github/README.md`
- `.dagger/**`
- `rush.json`
- `common/config/rush/command-line.json`
- `.github/workflows/*.yaml`

## Phase 1: Scaffold Tutorial

- [x] Create `docs/tutorial/`.
- [x] Create all planned chapter files.
- [x] Add a `README.md` table of contents.
- [x] Add previous/next navigation to each chapter.
- [x] Keep chapter filenames stable and ordered.

## Phase 2: Overview And Monorepo Foundation

- [x] Write `README.md` with audience, tutorial scope, technology list, deploy
      target list, and chapter links.
- [x] Write `01-system-overview.md` explaining the system shape:
      `apps/server`, `apps/webapp`, `libs/api`, `.dagger`, `deploy`, and
      GitHub Actions.
- [x] Write `02-rush-monorepo-foundation.md` explaining Rush project identity,
      dependency graph, PNPM lockfile ownership, root command wrappers, and
      bulk commands.

## Phase 3: App Contract And Runtime Architecture

- [x] Write `03-graphql-contract-boundary.md` explaining why `libs/api` exists,
      how the server generates `schema.gql`, how Relay consumes it, and how
      drift is detected.
- [x] Write `04-server-architecture.md` explaining NestJS, Fastify, Apollo
      GraphQL, TypeORM/Postgres, migrations, identity, access control, Redis
      pub/sub, and feature module boundaries.
- [ ] Write `05-webapp-architecture.md` explaining React, Vite, Relay,
      TanStack Router, feature folders, `src/shared`, `src/ui`,
      vanilla-extract, and Storybook.
- [ ] Write `06-auth-realtime-and-browser-security.md` explaining memory-only
      access tokens, HttpOnly refresh cookies, credentialed GraphQL requests,
      GraphQL WS authentication, socket restart behavior, CORS, and Redis
      fanout implications.

## Phase 4: Delivery And Deployment Architecture

- [ ] Write `07-rush-delivery-release-model.md` explaining why Rush Delivery is
      used, how Dagger isolation changes the release model, and how this
      project keeps GitHub Actions thin.
- [ ] Write `08-deploy-targets-and-provider-boundaries.md` explaining package
      targets, deploy targets, deploy mesh ordering, build-time versus
      deploy-time environment, Cloud Run, Cloudflare Pages, and provider script
      boundaries.
- [ ] Write `09-predeploy-scenarios-and-provider-functions.md` explaining the
      scenario engine, wizard host, concrete
      `cloudrun-cloudflare-neon-upstash` scenario, provider packages, typed
      provider functions, secret redaction, resumable state, and why scenarios
      prepare infrastructure but do not trigger production deploys.

## Phase 5: Operational Workflow And Evolution

- [ ] Write `10-ci-validation-and-local-workflows.md` explaining PR validation,
      main release workflow, forced target workflows, local dev commands,
      schema generation, Relay generation, migrations, and validation checks.
- [ ] Write `11-how-to-evolve-the-project.md` as a design playbook for adding:
      a GraphQL field, a server module, a webapp feature, a deploy target, a
      provider function, and a scenario step.

## Phase 6: Review And Polish

- [ ] Check all relative links.
- [ ] Check that every chapter has a clear design decision and consequence.
- [ ] Remove stale or speculative claims that are not true in the current
      checkout.
- [ ] Ensure Rush Delivery links point to the public docs and tutorial.
- [ ] Run markdown/documentation checks available in the repository.
- [ ] Provide semantic commit messages after modifying docs.

## Acceptance Criteria

- `docs/tutorial/README.md` is a useful entrypoint on its own.
- The tutorial covers technologies used and deploy targets in the introduction.
- Rush and Rush Delivery are separate chapters.
- Server, webapp, GraphQL contract, pre-deploy scenarios, deployment targets,
  and CI validation are each covered.
- The tutorial describes architectural reasoning and consequences, not just
  commands and files.
- The tutorial is self-contained inside `docs/tutorial/` while linking to
  existing repo docs only as references.
