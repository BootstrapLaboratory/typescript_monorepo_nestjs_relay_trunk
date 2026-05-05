# Extract App Framework Libraries

## Goal

Move repeated application constraints out of `apps/server` and `apps/webapp`
into small Rush libraries with clear interfaces.

The goal is not to create a generic framework. The goal is to make project
rules easier to apply and easier to fix later: auth transport, GraphQL context,
Relay network behavior, realtime reconnects, route preloading, environment
parsing, UI primitives, and similar constraints should live behind stable
helpers instead of being reimplemented in every feature.

## Problem

The server and webapp already have strong constraints that make the project
more stable:

- Server GraphQL context resolves principals from HTTP bearer headers and
  GraphQL WS connection params.
- Server auth uses short-lived access tokens, opaque refresh tokens, refresh
  rotation, provider adapters, and HttpOnly cookie transport by default.
- Server database configuration protects migration behavior from unsafe
  synchronize-plus-migrations combinations.
- Server realtime uses Redis-backed pub/sub for production-like environments
  with in-memory fanout for local subscription delivery.
- Webapp auth keeps access tokens in memory, uses a non-secret session hint,
  sends refresh-cookie credentials, and restarts GraphQL WS after token changes.
- Webapp Relay performs auth refresh and one retry for non-auth operations.
- Webapp routes use TanStack Router loaders to start Relay queries without
  blocking navigation, then dispose query references on abort.
- Webapp UI uses app-owned primitives and vanilla-extract tokens.

These constraints are good, but if a bug exists in one concept, future growth
could require fixing the same pattern across many modules, routes, forms, and
components. Framework libraries should centralize the concepts while keeping
feature code simple.

## Current High-Value Source Areas

- Server bootstrap and GraphQL wiring:
  [apps/server/src/main.ts](../../apps/server/src/main.ts),
  [apps/server/src/app.module.ts](../../apps/server/src/app.module.ts)
- Server env and database constraints:
  [apps/server/src/config/env.utils.ts](../../apps/server/src/config/env.utils.ts),
  [apps/server/src/config/database.config.ts](../../apps/server/src/config/database.config.ts)
- Server auth and access control:
  [apps/server/src/modules/identity](../../apps/server/src/modules/identity),
  [apps/server/src/modules/access-control](../../apps/server/src/modules/access-control)
- Server pub/sub and observability:
  [apps/server/src/modules/chat/chat-pubsub.service.ts](../../apps/server/src/modules/chat/chat-pubsub.service.ts),
  [apps/server/src/logging/structured-log.ts](../../apps/server/src/logging/structured-log.ts)
- Webapp provider, router, and Relay wiring:
  [apps/webapp/src/app/AppProviders.tsx](../../apps/webapp/src/app/AppProviders.tsx),
  [apps/webapp/src/app/router.tsx](../../apps/webapp/src/app/router.tsx),
  [apps/webapp/src/shared/relay](../../apps/webapp/src/shared/relay)
- Webapp auth, realtime, endpoint, theme, and Vite recovery:
  [apps/webapp/src/shared/auth](../../apps/webapp/src/shared/auth),
  [apps/webapp/src/shared/realtime](../../apps/webapp/src/shared/realtime),
  [apps/webapp/src/shared/graphql](../../apps/webapp/src/shared/graphql),
  [apps/webapp/src/shared/theme](../../apps/webapp/src/shared/theme),
  [apps/webapp/src/shared/vite](../../apps/webapp/src/shared/vite)
- Webapp UI primitives:
  [apps/webapp/src/ui](../../apps/webapp/src/ui)
- Existing shared GraphQL schema contract:
  [libs/api](../../libs/api)

## Design Principles

- Keep `libs/api` as the generated GraphQL schema contract. Do not turn it into
  a general app utilities package.
- Prefer several focused libraries over one large shared package.
- Cross-boundary libraries must be framework-light and safe for both server and
  browser use.
- Server libraries may depend on NestJS, TypeORM, Redis, and Node APIs.
- Webapp libraries may depend on React, Relay, TanStack Router, Vite, and
  browser APIs.
- Libraries must not import from `apps/server` or `apps/webapp`.
- Feature modules should depend on framework libraries, but framework libraries
  should not depend on feature modules.
- Core `@labkit/server-auth` owns auth rules, contracts, registry behavior, and
  storage-facing interfaces. Concrete database adapters, entities, and
  migrations belong in explicit adapter packages such as
  `@labkit/server-auth-typeorm`.
- Auth helpers should follow standards-oriented primitives and app-supplied
  adapters. Higher-level resolver/module helpers must expose extension points
  for custom app behavior such as notifications, auditing, risk checks, and
  provider-specific side effects.
- Labkit may provide database manifests and migrations, but applications own
  composing and applying those migrations through their own deployment flow.
- Labkit libraries live under `libs/labkit/*`. Each leaf folder is still a
  separate Rush project/package, not one combined library.
- Labkit package names use the `@labkit/<library-name>` shape, such as
  `@labkit/auth-contract`.
- Extract only after naming the concept and its public interface. Do not move a
  folder only because it is currently under `shared`.
- Keep first migrations behavior-preserving. Add tests before changing
  behavior.
- Each extracted library should have a narrow package README or architecture
  note explaining what constraint it owns.

## Proposed Library Map

Labkit is the shared brand and filesystem root for this internal application
framework:

```text
libs/labkit/
  auth-contract/        package: @labkit/auth-contract
  runtime-config/       package: @labkit/runtime-config
  server-auth/          package: @labkit/server-auth
  server-auth-typeorm/  package: @labkit/server-auth-typeorm
  webapp-auth/          package: @labkit/webapp-auth
```

The root groups the libraries under one idea, but each child remains a separate
Rush project with its own dependencies, build/test scripts, and public API.

### Cross-Boundary Contract Libraries

#### `libs/labkit/auth-contract` (`@labkit/auth-contract`)

Purpose: shared auth vocabulary used by server and webapp without importing
NestJS, React, Relay, or TypeORM.

Possible exports:

- `Principal`
- `AuthPayload` shape used at the GraphQL boundary
- auth provider capability names
- role and permission helper types
- refresh token transport names: `cookie`, `response_body`
- auth GraphQL error code constants
- GraphQL WS auth connection param names
- bearer token formatting helpers that do not touch request objects

Consequence: server token claims, server GraphQL DTO mapping, webapp session
state, auth error parsing, and websocket connection params can agree on one
contract.

Do not include:

- password hashing
- database entities
- refresh token persistence
- React hooks
- Nest guards or decorators

#### `libs/labkit/runtime-config` (`@labkit/runtime-config`)

Purpose: shared tiny parsing/validation helpers for runtime configuration.

Possible exports:

- boolean, number, and list parsing
- non-empty string helpers
- URL/path normalization helpers
- safe environment summary helpers that avoid leaking secrets

Consequence: `apps/server` and `apps/webapp` can reuse parsing behavior while
keeping their environment sources separate: `process.env` for server and
`import.meta.env` for Vite.

Do not include:

- direct reads from `process.env`
- direct reads from `import.meta.env`
- deployment provider logic

#### `libs/labkit/graphql-contract` (`@labkit/graphql-contract`)

Purpose: small shared constants for GraphQL transport behavior that are not the
generated schema itself.

Possible exports:

- default GraphQL path
- auth-related close codes or error-code constants
- operation category helpers, if operation naming becomes standardized
- common GraphQL error shape helpers

Consequence: server and webapp can agree on protocol details without bloating
`libs/api`.

Open decision: this may be unnecessary if `@labkit/auth-contract` covers the
small set of shared protocol constants.

### Server Framework Libraries

#### `libs/labkit/server-observability` (`@labkit/server-observability`)

Purpose: structured logging and safe error serialization.

Candidate source:
[apps/server/src/logging/structured-log.ts](../../apps/server/src/logging/structured-log.ts)

Possible exports:

- `logStructuredEvent`
- error detail serialization
- verbose logging flag helpers
- event naming conventions

Consequence: bootstrap, database, pub/sub, auth, and future modules can log with
the same event envelope.

#### `libs/labkit/server-config` (`@labkit/server-config`)

Purpose: Nest-compatible configuration helpers and app bootstrap config.

Candidate source:
[apps/server/src/config](../../apps/server/src/config)

Possible exports:

- env file loading and path selection
- typed config readers backed by `@nestjs/config`
- CORS origin resolution
- server host/port/GraphQL path config
- production-safe secret validation helpers

Consequence: new server modules read config through typed helpers instead of
scattering env parsing.

#### `libs/labkit/server-database` (`@labkit/server-database`)

Purpose: TypeORM setup constraints that should apply to every server feature.

Candidate source:
[apps/server/src/config/database.config.ts](../../apps/server/src/config/database.config.ts),
[apps/server/src/database/typeorm.datasource.ts](../../apps/server/src/database/typeorm.datasource.ts)

Possible exports:

- database URL normalization
- SSL config
- migration safety check: never synchronize and run migrations together
- logged data source factory
- feature entity and migration manifest interface
- helper to compose app database options from feature manifests

Consequence: adding a feature with entities or migrations should not require
manually editing one central list forever. Feature modules can export database
manifests and the app can compose them.

#### `libs/labkit/server-graphql` (`@labkit/server-graphql`)

Purpose: Nest GraphQL constraints and context creation.

Candidate source:
[apps/server/src/app.module.ts](../../apps/server/src/app.module.ts),
[libs/labkit/server-graphql/src](../../libs/labkit/server-graphql/src),
[apps/server/src/graphql/schema-manifest.ts](../../apps/server/src/graphql/schema-manifest.ts)

Possible exports:

- GraphQL module factory for Apollo/Fastify
- GraphQL context creation from HTTP and WS inputs
- GraphQL WS connection lifecycle logging
- subscription auth extraction
- query complexity plugin with configurable threshold
- reusable scalars
- reusable schema directives
- schema generation manifest helpers

Consequence: feature modules can add resolvers without knowing how principals,
subscriptions, logging, schema sorting, or complexity limits are wired.

#### `libs/labkit/server-auth` (`@labkit/server-auth`)

Purpose: server-side identity and access-control framework.

Candidate source:
[apps/server/src/modules/identity](../../apps/server/src/modules/identity),
[apps/server/src/modules/access-control](../../apps/server/src/modules/access-control)

Possible exports:

- `IdentityModule` or `createIdentityModule`
- provider registry interfaces
- access token service
- refresh token generation and hashing helpers
- refresh-session expiry and rotation decision helpers
- refresh token service and transport helpers
- principal decorators
- public and role decorators
- GraphQL authentication and role guards
- auth lifecycle event contracts and dispatcher helpers
- access token claim and principal mapping helpers
- test helpers for auth contexts

Consequence: auth becomes a framework feature that can be reused by future
business modules without each module caring about token verification, refresh
rotation, cookie transport, or role metadata.

Important split:

- shared types and protocol names belong in `@labkit/auth-contract`
- Nest services, guards, decorators, and provider registry helpers belong in
  `@labkit/server-auth`
- TypeORM/PostgreSQL entities, repositories, database manifests, and migrations
  belong in `@labkit/server-auth-typeorm`

#### `libs/labkit/server-auth-typeorm` (`@labkit/server-auth-typeorm`)

Purpose: optional TypeORM/PostgreSQL persistence adapter for the Labkit auth
model.

Possible exports:

- identity user/account/role/refresh-session entities
- TypeORM repositories or repository adapter providers
- auth database manifest helpers
- migration classes for the checked-in schema
- helper functions to add auth persistence to an app-owned database manifest

Consequence: server apps can opt into a production-ready PostgreSQL auth schema
without core `@labkit/server-auth` owning migration execution.

Important boundary: importing an auth module must not apply migrations or
mutate schema. The application composes the adapter's manifest and runs
migrations through its own database/deployment workflow.

#### `libs/labkit/server-pubsub` (`@labkit/server-pubsub`)

Purpose: typed pub/sub driver abstraction for GraphQL subscriptions.

Candidate source:
[apps/server/src/modules/chat/chat-pubsub.service.ts](../../apps/server/src/modules/chat/chat-pubsub.service.ts)

Possible exports:

- memory and Redis driver selection
- Redis publisher/subscriber lifecycle
- local fanout bridge for GraphQL subscription iterators
- typed channel registration
- publish/subscribe helpers with structured logging hooks

Consequence: future subscription features reuse the same Redis lifecycle,
logging, and local fanout behavior instead of copying chat-specific code.

Extraction signal: do this when a second subscription feature appears, or when
chat pub/sub behavior needs a non-chat fix.

#### `libs/labkit/server-feature-kit` (`@labkit/server-feature-kit`)

Purpose: low-level feature-module helpers after there is enough repetition.

Possible exports:

- typed mapper provider factory
- resolver/service/repository test helpers
- entity manifest helpers
- common GraphQL DTO conventions

Consequence: new server feature modules can follow the same shape with less
boilerplate.

Extraction signal: wait until at least two real feature modules need the same
helper. The current chat mapper alone is not enough evidence.

### Webapp Framework Libraries

#### `libs/labkit/webapp-external-store` (`@labkit/webapp-external-store`)

Purpose: tiny browser-safe external store primitive used by auth, realtime, and
theme state.

Candidate source:
[apps/webapp/src/shared/auth/session.ts](../../apps/webapp/src/shared/auth/session.ts),
[apps/webapp/src/shared/realtime/realtime-connection.ts](../../apps/webapp/src/shared/realtime/realtime-connection.ts),
[apps/webapp/src/shared/theme/theme-store.ts](../../apps/webapp/src/shared/theme/theme-store.ts)

Initial exports:

- create store with `getSnapshot`, `setSnapshot`, `updateSnapshot`,
  `subscribe`, and `emit`
- keep React hooks in app-owned store modules for now

Consequence: auth, theme, and realtime state share one tested store pattern.

#### `libs/labkit/webapp-auth` (`@labkit/webapp-auth`)

Purpose: browser auth runtime.

Candidate source:
[apps/webapp/src/shared/auth](../../apps/webapp/src/shared/auth),
[apps/webapp/src/features/auth](../../apps/webapp/src/features/auth),
[apps/webapp/src/routes/auth/AuthRoute.tsx](../../apps/webapp/src/routes/auth/AuthRoute.tsx)

Possible exports:

- memory-only access token session store
- non-secret session hint policy
- refresh-cookie transport adapter
- refresh and logout client
- auth error parsing
- auth boot helper
- hooks such as `useAuthState`
- route guard helpers
- auth mutation wrappers or factory helpers

Consequence: future webapp routes and forms do not need to know how refresh
cookies, local hints, auth-required GraphQL errors, or logout cleanup work.

Important split:

- shared protocol names and auth shapes belong in `@labkit/auth-contract`
- React hooks and fetch behavior belong in `@labkit/webapp-auth`

#### `libs/labkit/webapp-graphql-relay` (`@labkit/webapp-graphql-relay`)

Purpose: Relay runtime, auth-aware network, subscriptions, store helpers, and
route preload conventions.

Candidate source:
[apps/webapp/src/shared/relay](../../apps/webapp/src/shared/relay),
[apps/webapp/src/shared/graphql/endpoints.ts](../../apps/webapp/src/shared/graphql/endpoints.ts),
[apps/webapp/src/app/router.tsx](../../apps/webapp/src/app/router.tsx)

Possible exports:

- GraphQL endpoint resolution
- `createRelayEnvironment`
- auth-aware HTTP fetch with one refresh retry
- GraphQL WS subscription network integration
- operation category policy for auth operations
- route loader helper for `loadQuery` plus abort disposal
- Relay store updater helpers

Consequence: future Relay routes can preload data with one helper and cannot
accidentally skip abort disposal, credentialed requests, auth retry, or shared
subscription transport.

#### `libs/labkit/webapp-realtime` (`@labkit/webapp-realtime`)

Purpose: GraphQL WS reconnect policy and user-visible connection state.

Candidate source:
[apps/webapp/src/shared/realtime/realtime-connection.ts](../../apps/webapp/src/shared/realtime/realtime-connection.ts)

Possible exports:

- GraphQL WS client factory
- heartbeat and reconnect watchdog
- browser online/offline integration
- fatal close-code policy
- connection state store and React hook
- connection message formatter

Consequence: future subscription features reuse the same Cloud Run-friendly
reconnect behavior and UI status policy.

#### `libs/labkit/webapp-ui` (`@labkit/webapp-ui`)

Purpose: design tokens, themes, primitives, and UI composition helpers.

Candidate source:
[apps/webapp/src/ui](../../apps/webapp/src/ui)

Possible exports:

- vanilla-extract token contract
- theme implementations
- Button, Link, Surface, TextField, SelectField, StatusState
- class name helper
- motion and status styles
- Storybook stories or fixtures

Consequence: feature code depends on project UI primitives instead of direct
styling libraries. Future styling changes happen in one package.

Migration caution: vanilla-extract package boundaries and Storybook config need
to be verified before moving this out of `apps/webapp`.

#### `libs/labkit/webapp-app-shell` (`@labkit/webapp-app-shell`)

Purpose: reusable app-provider and route-shell helpers, if more app surfaces
appear.

Candidate source:
[apps/webapp/src/app](../../apps/webapp/src/app)

Possible exports:

- provider composition helper
- route error boundary
- pending-state route fallback presets
- navigation action helpers

Consequence: top-level app wiring stays small as providers grow.

Extraction signal: wait until a second browser surface exists, or until
`AppProviders`/router wiring becomes too complex.

#### `libs/labkit/webapp-vite-runtime` (`@labkit/webapp-vite-runtime`)

Purpose: browser runtime helpers coupled to Vite output behavior.

Candidate source:
[apps/webapp/src/shared/vite/preloadRecovery.ts](../../apps/webapp/src/shared/vite/preloadRecovery.ts)

Possible exports:

- Vite preload recovery installer
- one-reload retry storage policy

Consequence: stale chunk recovery becomes a tested runtime helper instead of
application boot code.

### Tooling And Build Libraries

#### `libs/labkit/webapp-build-config` (`@labkit/webapp-build-config`)

Purpose: reusable Vite/Storybook/build configuration helpers.

Candidate source:
[apps/webapp/vite.config.ts](../../apps/webapp/vite.config.ts),
[apps/webapp/relay.config.json](../../apps/webapp/relay.config.json)

Possible exports:

- production env requirement checker
- package-module chunk grouping helper
- default vendor groups
- Storybook Vite env defaults

Consequence: build constraints are easier to update and test as the webapp
build grows.

#### `libs/labkit/server-build-tools` (`@labkit/server-build-tools`)

Purpose: schema generation and migration command helpers, if server scripts
grow.

Candidate source:
[apps/server/src/scripts](../../apps/server/src/scripts),
[apps/server/package.json](../../apps/server/package.json)

Possible exports:

- schema generation runner
- contract drift check helper
- CI migration/start smoke helpers

Consequence: server package scripts remain thin while validation behavior stays
testable.

Extraction signal: wait until scripts are reused by another app or become
large enough to test independently.

## Recommended Dependency Graph

```text
@labkit/runtime-config
@labkit/auth-contract
@labkit/graphql-contract
        ^
        |
        +-------------------+
        |                   |
@labkit/server-*      @labkit/webapp-*
        |                   |
apps/server           apps/webapp

libs/api remains the generated schema contract consumed by apps/webapp.
```

Rules:

- `@labkit/auth-contract`, `@labkit/runtime-config`, and optional
  `@labkit/graphql-contract` must have no dependency on NestJS, TypeORM,
  React, Relay, Vite, or browser globals.
- Server libraries may depend on cross-boundary contracts.
- Webapp libraries may depend on cross-boundary contracts.
- Server libraries must not depend on webapp libraries.
- Webapp libraries must not depend on server libraries.
- Apps may depend on libraries; libraries must not depend on apps.

## Phases

### Phase 0: Architecture Inventory And Naming

- [x] Use `Labkit` as the shared brand for the application framework
      libraries.
- [x] Place Labkit libraries under `libs/labkit/*`.
- [x] Use package names in the `@labkit/<library-name>` shape, such as
      `@labkit/auth-contract`.
- [x] Keep each `libs/labkit/*` child as a separate Rush project/package with
      its own dependencies and public API.
- [x] Decide TypeScript output/module format that can be consumed by the
      CommonJS Nest server and the ESM/bundler webapp.
- [x] Add a short architecture note for library dependency direction.
- [x] Defer the `@labkit/graphql-contract` decision to
      [Deferred Labkit Follow-Ups](../2026-05-04-0230_DEFERRED_LABKIT_FOLLOW_UPS.md);
      `@labkit/auth-contract` plus `libs/api` are enough for the current
      boundary.
- [x] Add Rush project entries only for the first extraction slice.

### Phase 1: Extract Low-Risk Cross-Boundary Contracts

- [x] Create `libs/labkit/runtime-config` with parsing helpers from
      [apps/server/src/config/env.utils.ts](../../apps/server/src/config/env.utils.ts).
- [x] Move browser-safe bearer token formatting/parsing helpers into a
      cross-boundary contract only if both sides need them.
- [x] Create `libs/labkit/auth-contract` with `Principal`, auth payload,
      refresh token transport names, and GraphQL WS auth param constants.
- [x] Update server identity types to consume `@labkit/auth-contract` where
      safe.
- [x] Update webapp auth session types to consume `@labkit/auth-contract` where
      safe.
- [x] Keep generated Relay types as the webapp operation source of truth; do
      not replace them with hand-written contract types.
- [x] Add tests for shared parsing and auth contract helpers.
- [x] Run Rush verify for `server`, `webapp`, and affected libraries.

### Phase 2: Extract Server Foundations

- [x] Create `libs/labkit/server-observability` from structured logging
      helpers.
- [x] Move server config readers and CORS config into
      `libs/labkit/server-config`.
- [x] Create `libs/labkit/server-database` with TypeORM option composition and
      migration safety checks.
- [x] Add a feature database manifest interface so feature modules can register
      entities and migrations without a permanent central manual list.
- [x] Move GraphQL context creation and websocket lifecycle helpers into
      `libs/labkit/server-graphql`.
- [x] Move common GraphQL scalar/plugin helpers into
      `libs/labkit/server-graphql`.
- [x] Keep `apps/server/src/app.module.ts` as composition only: imports feature
      modules and library module factories.
- [x] Update server architecture docs after behavior-preserving extraction.
- [x] Run server tests and schema contract verification.

### Phase 3: Extract Server Auth And Realtime

Status after review: the server-auth extraction is stable for now. Remaining
app-owned auth code is intentional composition rather than obvious framework
material: the GraphQL resolver and DTOs own the API surface, `AccessTokenService`
owns concrete JWT signing and verification, `PasswordService` owns Argon2,
`IdentityConfigService` adapts app environment names, `AuthLifecycleService`
composes app lifecycle handlers, and `IdentityService`/`IdentitySessionService`
are thin app-facing wrappers around Labkit providers and session orchestration.
The next broad work should move to Phase 4/5 frontend boundaries unless a new
server auth app, provider, or lifecycle extension creates repeated code.

- [x] Create `libs/labkit/server-auth` as the server auth helper package while
      keeping product-specific feature modules outside the library.
- [x] Review remaining app-owned server auth code and confirm that no further
      broad Phase 3 split is meaningful right now.
- [x] Move access-control decorators and guards into
      `libs/labkit/server-auth`.
- [x] Move provider registry interfaces and registry helper into
      `libs/labkit/server-auth`.
- [x] Keep the concrete local provider app-owned until the persistence adapter
      boundary is implemented, then move the local credentials provider flow
      into `libs/labkit/server-auth` while keeping password hashing
      app-supplied.
- [x] Move access-token claim mapping and expiry helpers into
      `libs/labkit/server-auth`.
- [x] Move refresh-token generation and hashing helpers into
      `libs/labkit/server-auth`.
- [x] Move refresh-session expiry and rotation decision helpers into
      `libs/labkit/server-auth`.
- [x] Move refresh-token transport policy helpers into
      `libs/labkit/server-auth`.
- [x] Add auth lifecycle event contracts and dispatcher helpers so future
      resolver/service defaults can expose app-owned extension hooks.
- [x] Apply auth lifecycle dispatching in the app-owned auth resolver flow with
      a secret-free structured logging handler.
- [x] Lower expected refresh/logout authorization lifecycle failures to normal
      structured logs while keeping unexpected failures as warnings.
- [x] Move refresh token transport and token rotation services into
      `libs/labkit/server-auth` only after their extension hooks are applied.
- [x] Add a server-auth GraphQL integration helper, such as
      `createServerAuthGraphqlIntegration`, so `apps/server/src/app.module.ts`
      can pass one auth adapter into `createServerGraphqlModule` instead of
      wiring bearer extraction and access-token verification inline.
- [x] Add server-auth Nest module helpers so apps can choose between a
      configurable GraphQL auth factory and a named access-token-service
      adapter.
- [x] Create `@labkit/server-auth-typeorm` as the optional TypeORM/PostgreSQL
      persistence adapter when auth persistence moves out of `apps/server`.
      Detailed design task:
      [Design Server Auth TypeORM Adapter](2026-05-03-1656_DESIGN_SERVER_AUTH_TYPEORM_ADAPTER.md).
- [x] Defer `libs/labkit/server-pubsub` until a second subscription feature
      needs the Redis/memory driver behavior or chat pub/sub needs a shared
      fix. Tracked in
      [Deferred Labkit Follow-Ups](../2026-05-04-0230_DEFERRED_LABKIT_FOLLOW_UPS.md).
- [x] Add focused tests for auth provider selection, token claims, guard
      behavior, refresh rotation, and pub/sub driver behavior.
- [x] Add app-level `IdentityService` tests for auth provider selection,
      session creation delegation, refresh delegation, and revoke delegation.
- [x] Add app-level `AccessTokenService` tests for issued JWT auth claims,
      explicit expiry, display-name omission, and invalid claim rejection.
- [x] Add app-level `AccessControlModule` tests for Labkit guard wiring and
      access-token verifier delegation.
- [x] Add app-level `IdentitySessionService` tests for refresh-session
      creation, rotation, and revocation wiring.
- [x] Add app-level `ChatPubSubService` tests for memory fanout, Redis driver
      wiring, and Redis configuration validation.

### Phase 4: Extract Webapp Runtime Foundations

Status after review: the browser runtime Labkit extraction is stable for now.
`src/shared/auth`, `src/shared/relay`, `src/shared/realtime`, and
`src/shared/theme` are app-local adapters that supply endpoint, environment,
storage-key, and React hook choices while Labkit owns the reusable browser
runtime policies. Endpoint resolution should remain in `src/shared/graphql`
until a second browser app needs the same Vite URL policy. Route/page cleanup
has moved page composition back into feature folders, so the next broad work
should move to Phase 5 UI framework-helper closure rather than extracting more
runtime code.

- [x] Create `libs/labkit/webapp-external-store` and migrate auth, realtime,
      and theme stores to it.
- [x] Create `libs/labkit/webapp-auth` from session state, refresh/logout
      client, auth boot, auth error parsing, and refresh-token transport
      policy.
- [x] Create `libs/labkit/webapp-realtime` from GraphQL WS reconnect logic and
      connection-state hooks.
- [x] Create `libs/labkit/webapp-graphql-relay` from Relay environment
      creation, auth-aware HTTP fetch, subscription setup, realtime token-change
      termination, and store helpers.
- [x] Defer moving endpoint resolution into
      `libs/labkit/webapp-graphql-relay` until a second browser app needs the
      same Vite URL policy. Tracked in
      [Deferred Labkit Follow-Ups](../2026-05-04-0230_DEFERRED_LABKIT_FOLLOW_UPS.md).
- [x] Replace manual route loader `loadQuery` plus abort disposal with a tested
      helper.
- [x] Keep route files as adapters and feature pages as plain composition.
      Completed by moving auth session gating and chat Relay/Suspense page
      composition into route-facing feature pages while keeping TanStack
      router glue in route files.
- [x] Add tests around auth refresh retry, route query disposal, and realtime
      fatal/retry close-code behavior.
- [x] Run Relay, TypeScript, Vite build, and Storybook build if UI surfaces are
      affected.

### Phase 5: Extract Webapp UI Framework Helpers

Status after review: the `@labkit/webapp-ui` boundary is stable for now.
Labkit UI owns framework helpers and contracts only: class-name composition,
theme-name validation, theme definition derivation, theme-value typing, and
persisted theme controller behavior. The webapp still owns vanilla-extract
theme contracts, theme values, generated theme classes, concrete UI
components, visual tokens, component styles, feature visual composition, and
Storybook stories. No additional UI helper needs to move until repeated
framework code appears. A shared design-system package should wait for a second
webapp or equivalent reuse pressure; it should not be folded into Labkit UI.

- [x] Keep `@labkit/webapp-ui` scoped to framework helpers and contracts:
      Labkit UI does not own concrete product components or visual design.
- [x] Create `libs/labkit/webapp-ui` with class name helpers as the first
      small slice.
- [x] Move theme mode contracts/helpers only if they become clearly reusable
      without moving app-owned theme values or vanilla-extract classes.
- [x] Move persisted theme selection and document-root class application into
      `@labkit/webapp-ui` while keeping React hooks and app-owned theme metadata
      in the webapp.
- [x] Verify vanilla-extract builds correctly across package boundaries before
      moving any styling framework helpers.
- [x] Keep concrete UI components, visual tokens, themes, and Storybook stories
      app-owned until a second webapp creates pressure for a separate shared
      design-system package.
- [x] Update webapp feature imports to consume `@labkit/webapp-ui` for moved
      framework helpers.
- [x] Keep feature-specific visual composition in feature folders.
- [x] Add visual/Storybook checks only when concrete visual primitives move.
      No concrete primitives moved in Phase 5; the route/page cleanup already
      ran the webapp build and Storybook build after feature composition moved.

### Phase 6: Extract Build And Tooling Helpers

Status after review: build/tooling extraction is stable for now.
`@labkit/webapp-build-config` owns only tested production env validation and
package-based vendor chunk grouping. `apps/webapp/vite.config.ts` still owns
plugin order, analyze mode, local dev-server filesystem access, and the actual
vendor group policy. Browser-consumed and shared Labkit packages publish ESM
`import` entries with CommonJS `require` fallbacks; server-only packages remain
CommonJS. No Labkit-specific Vite `optimizeDeps.include` workaround remains,
and no additional build config should move right now.

- [x] Publish browser-consumed Labkit packages with explicit ESM `import`
      entries while preserving CommonJS `require` entries for Node/server
      consumers.
- [x] Remove the webapp Vite dependency-optimization workaround for Labkit
      workspace packages after package exports became browser-safe.
- [x] Create `libs/labkit/webapp-build-config` only if Vite/Storybook/Relay
      config complexity continues to grow.
- [x] Move production env validation from
      [apps/webapp/vite.config.ts](../../apps/webapp/vite.config.ts) into a
      tested helper.
- [x] Move vendor chunk grouping helpers into a tested helper.
- [x] Defer `libs/labkit/server-build-tools` until schema and migration scripts
      are reused or become complex enough to test independently. Tracked in
      [Deferred Labkit Follow-Ups](../2026-05-04-0230_DEFERRED_LABKIT_FOLLOW_UPS.md).
- [x] Keep app package scripts thin and Rush-owned. Rush continues to own
      repo-level `verify`, `lint`, `test`, and `dev` orchestration while package
      scripts stay project-local.

### Phase 7: Feature Migration And Cleanup

- [x] Migrate the chat feature to the new Relay route preload helper.
- [x] Migrate the chat subscription to the new webapp realtime helpers; keep
      server pub/sub extraction deferred until a second subscription feature or
      shared fix appears.
- [x] Migrate auth route and auth form containers to the webapp auth library
      through app-local auth adapters.
- [x] Remove old duplicated helpers from app-local `shared` folders; remaining
      shared files are intentional adapters for app-owned endpoints, storage
      keys, environment variables, and React hooks.
- [x] Update scoped architecture docs for server and webapp during the
      extraction slices.
- [x] Add top-level and package-level Labkit README documentation instead of a
      short tutorial note, because these packages are intended to move to a
      separate project or be reused by other projects later.

## Candidate Priority

| Priority | Candidate                      | Why                                                                                                  |
| -------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 1        | `@labkit/auth-contract`        | Auth already defines constraints on both server and webapp. Drift here is expensive.                 |
| 1        | `@labkit/runtime-config`       | Small, low-risk, immediately useful for env parsing and tests.                                       |
| 2        | `@labkit/webapp-graphql-relay` | Relay auth retry, credentials, subscriptions, and route disposal are high-value constraints.         |
| 2        | `@labkit/webapp-auth`          | Session security policy should not be reimplemented by future features.                              |
| 2        | `@labkit/server-graphql`       | GraphQL context and WS auth currently live in app composition and will grow with new resolvers.      |
| 3        | `@labkit/server-observability` | Logging is already reused and should stay consistent.                                                |
| 3        | `@labkit/server-database`      | Becomes more valuable as feature entities and migrations grow.                                       |
| 3        | `@labkit/webapp-realtime`      | Current implementation is mature enough to extract, but only one subscription feature uses it today. |
| 4        | `@labkit/webapp-ui`            | Valuable, but vanilla-extract and Storybook package-boundary verification make it a larger move.     |
| 4        | `@labkit/server-auth`          | High value but large blast radius; do after contract extraction.                                     |
| 5        | `@labkit/server-pubsub`        | Wait for a second subscription feature or a shared pub/sub fix.                                      |
| 5        | build/tooling libraries        | Wait until config complexity justifies a separate package.                                           |

## Non-Goals

- Do not rewrite the app into a different framework.
- Do not move feature domain logic into framework libraries.
- Do not make `libs/api` a general shared utilities package.
- Do not extract chat UI, project-info markdown UI, or demo stack logos as
  framework code.
- Do not create a single universal library that mixes server and browser
  dependencies.
- Do not change auth security posture while extracting. Memory-only access
  tokens and HttpOnly refresh cookies remain the preferred browser shape.

## Closed Decisions

- Server-only libraries emit CommonJS for now. Shared and browser-consumed
  libraries emit dual CommonJS/ESM package entry points.
- Auth persistence entities live in `@labkit/server-auth-typeorm`, while core
  `@labkit/server-auth` owns auth rules, contracts, provider behavior, and
  storage-facing interfaces.
- `@labkit/graphql-contract` is deferred. `@labkit/auth-contract` and `libs/api`
  cover the current shared GraphQL/auth boundary.
- A lightweight package generator/checklist is deferred until more Labkit
  package creation makes manual setup repetitive.

## First Suggested Slice

- [x] Create `libs/labkit/runtime-config` as package
      `@labkit/runtime-config`.
- [x] Create `libs/labkit/auth-contract` as package
      `@labkit/auth-contract`.
- [x] Replace only duplicated type/constant/parsing usage in server and webapp.
- [x] Do not move Nest modules, React hooks, Relay environment, or UI yet.
- [x] Verify package format, Rush wiring, and dependency direction with the
      smallest possible behavioral change.
