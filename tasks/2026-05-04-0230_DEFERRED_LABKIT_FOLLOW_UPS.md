# Deferred Labkit Follow-Ups

## Goal

Keep the completed Labkit extraction closed while preserving the follow-up
ideas that were deliberately deferred.

These items are not failures of the current extraction. They are future
extraction signals: do them when reuse pressure appears, when a second app or
feature needs the same behavior, or when the implementation becomes complex
enough to test independently.

## Source Task

Deferred from
[Extract App Framework Libraries](completed/2026-05-03-1143_EXTRACT_APP_FRAMEWORK_LIBRARIES.md).

## Phase 1: Cross-Boundary Contract Decisions

- [ ] Revisit whether `@labkit/graphql-contract` is needed.

  Why: `@labkit/auth-contract` currently owns the shared GraphQL auth protocol
  constants, while `libs/api` remains the generated schema contract. A separate
  GraphQL contract package should exist only if non-auth GraphQL transport
  constants, operation policy, close codes, or error-shape helpers begin to
  repeat across server and browser code.

  Start when: at least two non-auth GraphQL protocol concepts need to be shared
  across server and webapp, or when adding them to `@labkit/auth-contract`
  would make that package misleading.

## Phase 2: Server Follow-Ups

- [ ] Extract `@labkit/server-pubsub`.

  Why: chat currently owns the only real subscription pub/sub feature. The
  Redis/memory driver split, local fanout bridge, lifecycle logging, and typed
  channel helpers are good framework candidates, but extracting them before a
  second subscription feature risks freezing a chat-shaped API.

  Start when: a second subscription feature needs pub/sub, or chat pub/sub
  needs a shared fix that should become reusable infrastructure.

- [ ] Consider `@labkit/server-feature-kit`.

  Why: mapper providers, resolver/service/repository test helpers, entity
  manifest helpers, and GraphQL DTO conventions may become useful after more
  feature modules exist. The current app does not yet have enough repetition to
  justify this package.

  Start when: at least two real server feature modules repeat the same helper
  shape.

- [ ] Consider `@labkit/server-build-tools`.

  Why: schema generation, contract drift checks, migration commands, and
  start/smoke validation may deserve tested helpers later. Right now server
  package scripts are still readable and app-owned.

  Start when: those scripts are reused by another server app, or they become
  complex enough that testing them outside package scripts would reduce risk.

## Phase 3: Webapp Runtime Follow-Ups

- [ ] Move endpoint resolution into `@labkit/webapp-graphql-relay`, if reuse
      pressure appears.

  Why: endpoint resolution is still app-owned because it encodes this app's
  Vite environment variable names and local/prod URL policy. Moving it now
  would make the Relay package opinionated about a single app's deployment
  shape.

  Start when: a second browser app needs the same GraphQL HTTP/WS URL policy,
  or endpoint derivation starts repeating in multiple app-local adapters.

- [ ] Consider `@labkit/webapp-app-shell`.

  Why: provider composition, route error boundaries, pending-state route
  fallbacks, and navigation helpers may become reusable if more browser
  surfaces appear. Today they are still product-shell decisions.

  Start when: a second browser surface exists, or `AppProviders`/router wiring
  grows enough that a tested shell helper would make the app easier to evolve.

- [ ] Consider `@labkit/webapp-vite-runtime`.

  Why: Vite preload recovery is runtime behavior coupled to bundler output.
  It may deserve a tested helper if more browser apps need the same stale chunk
  recovery policy.

  Start when: another Vite app needs preload recovery, or the current recovery
  policy grows beyond a small app-local boot helper.

## Phase 4: Webapp UI Follow-Ups

- [ ] Create a separate shared design-system package only after real reuse
      pressure appears.

  Why: `@labkit/webapp-ui` is intentionally limited to framework helpers and
  contracts. Concrete buttons, fields, layout components, theme values, styles,
  and stories remain app-owned. A design-system package should be created when
  a second webapp or equivalent surface needs to share those concrete visual
  pieces.

  Start when: there is a second webapp, admin app, or other durable consumer
  that needs the same concrete UI components.

## Phase 5: Tooling Follow-Ups

- [ ] Add a lightweight Labkit package generator or checklist.

  Why: the first extraction established package conventions manually. A helper
  may be useful later to create consistent package metadata, dual ESM/CJS
  config, README skeletons, and Rush entries.

  Start when: more Labkit packages are being created often enough that manual
  setup becomes repetitive or error-prone.

## Validation Before Starting Any Follow-Up

- [ ] Confirm the target behavior is repeated or complex enough to justify a
      package.
- [ ] Define the package boundary and what the app still owns.
- [ ] Add or update package README documentation with the public API and usage
      pattern.
- [ ] Add focused tests before changing behavior.
- [ ] Run Rush verification for affected packages and apps.
- [ ] Run Trunk QA.
