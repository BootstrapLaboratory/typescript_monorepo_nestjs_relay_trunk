# Design Server Auth TypeORM Adapter

## Goal

Design `@labkit/server-auth-typeorm` as the optional TypeORM/PostgreSQL
persistence adapter for the Labkit auth model before moving more identity code
out of [apps/server](../apps/server).

The adapter should let a server app opt into a production-ready auth schema,
repositories, and migration manifest while keeping migration execution,
provider choice, product-specific profile data, and app side effects under the
application's control.

## Why This Slice Exists

`@labkit/server-auth` now owns many auth rules and integration helpers:
provider registry contracts, guards and decorators, GraphQL auth wiring,
access-token claim mapping, refresh-token primitives, refresh-session state
helpers, refresh-token transport policy, and lifecycle event dispatching.

The remaining app-owned identity code is mostly persistence and app
composition. Moving that persistence directly into core auth would make the
core package too opinionated about TypeORM, PostgreSQL, and migrations. A
separate adapter gives us the reusable default while preserving the boundary:
core auth defines contracts and decisions; the TypeORM adapter implements
storage; apps decide whether and how to use it.

## Current Source Areas

- Auth TypeORM adapter package:
  [libs/labkit/server-auth-typeorm](../libs/labkit/server-auth-typeorm)
- Current local provider persistence service:
  [apps/server/src/modules/identity/local-identity.provider.ts](../apps/server/src/modules/identity/local-identity.provider.ts)
- Current refresh-session persistence service:
  [apps/server/src/modules/identity/session.service.ts](../apps/server/src/modules/identity/session.service.ts)
- Current app identity composition:
  [apps/server/src/modules/identity/identity.module.ts](../apps/server/src/modules/identity/identity.module.ts)
- Current database manifest helpers:
  [libs/labkit/server-database/src/index.ts](../libs/labkit/server-database/src/index.ts)
- Current auth core:
  [libs/labkit/server-auth/src/index.ts](../libs/labkit/server-auth/src/index.ts)

## Package Boundaries

`@labkit/server-auth` owns auth vocabulary and behavior that is not tied to a
database implementation:

- identity provider contracts and provider registry behavior
- principal, provider identity, and session result contracts
- access-token claim mapping helpers and verifier interfaces
- refresh-token generation, hashing, expiry, state, revocation, and rotation
  decision helpers
- refresh-token transport policy for cookie and response-body delivery
- guards, decorators, GraphQL auth integration helpers, and lifecycle events
- storage-facing interfaces that higher-level auth services can use without
  importing TypeORM

`@labkit/server-auth-typeorm` owns TypeORM/PostgreSQL persistence for those
contracts:

- entity classes for the default Labkit auth schema
- migration classes for that default schema
- a database manifest that apps can compose into their TypeORM options
- repository adapters that implement core storage-facing interfaces
- a Nest module helper that registers and exports those adapters
- TypeORM-specific tests for schema metadata, repository behavior, and
  migration manifest composition

The server app owns product and deployment decisions:

- choosing enabled auth providers and default provider behavior
- composing adapter modules and app database manifests
- running migrations in app-owned startup, CLI, CI, or deploy workflows
- access-token signing secrets and token verification service wiring
- product profile data, notifications, audit sinks, risk checks, and custom
  auth event handlers
- schema extension decisions beyond the default Labkit auth tables

## Standards-Oriented Auth Model

The default schema should stay aligned with modern auth principles rather than
one specific application:

- users are stable internal subjects
- provider accounts link a provider plus provider subject to a user
- local credentials are one provider account shape, not the whole identity
  model
- access tokens are short-lived bearer tokens and are not persisted
- refresh tokens are opaque secrets; only hashes are stored
- refresh sessions can expire, rotate, revoke, and revoke all sessions for a
  user
- roles and permissions are strings at the contract boundary so apps can map
  them to richer authorization systems later
- lifecycle events are secret-free and extension-friendly

This does not mean the adapter must cover every possible auth system. It should
provide a clean default and clear interfaces so apps can wrap, replace, or
extend persistence without forking the auth flow.

## Persistence Model

The first adapter should preserve the current database shape:

- `identity_user`
- `identity_account`
- `identity_user_role`
- `identity_refresh_session`

The current migration class name,
`CreateIdentityTables20260429143000`, must be preserved or explicitly aliased
when moved. TypeORM records migration names, so renaming a previously applied
migration class can make an existing database look unmigrated.

The adapter should export a manifest similar to:

```ts
export const serverAuthTypeormDatabaseManifest = {
  entities: SERVER_AUTH_TYPEORM_ENTITIES,
  migrations: SERVER_AUTH_TYPEORM_MIGRATIONS,
} satisfies ServerDatabaseFeatureManifest;
```

The adapter must not run migrations, call `synchronize`, or mutate schema when
imported. Apps opt into the adapter by composing its manifest with their own
database manifests and by running migrations through the app's normal database
workflow.

## Repository Contracts

Core `@labkit/server-auth` should define storage-facing interfaces before the
adapter implements them. Candidate contracts:

- `ServerAuthIdentityAccountRepository`
  - find a provider account by provider and subject
  - create a user with provider account and initial roles in one transaction
  - read active user/provider identity data for login
- `ServerAuthRoleRepository`
  - get roles for a user
  - assign or remove roles when a higher-level app service allows it
- `ServerAuthRefreshSessionRepository`
  - create a refresh session from a hashed token
  - find a refresh session by token hash with enough user data to mint a new
    principal
  - mark a session revoked
  - rotate a session and link it to the replacement session id
  - revoke all active sessions for a user
- `ServerAuthTransactionRunner`
  - run repository writes in one transaction when the persistence provider
    supports it

The TypeORM package implements these contracts with TypeORM repositories and
`DataSource.transaction`. The app should be able to decorate or replace those
implementations if it needs custom audit writes, notification fanout, or
product-specific identity state.

## Local Provider Boundary

The current local provider combines provider logic, password hashing, and
TypeORM writes. Split it gradually:

- core `@labkit/server-auth` can own the local-provider contract shape and a
  password-hasher interface
- `@labkit/server-auth-typeorm` can own the local account repository adapter
- `apps/server` can initially keep the concrete `LocalIdentityProvider` while
  switching it to the adapter interface
- a later helper can provide a default local provider by composing a password
  hasher, default-role reader, and account repository

This keeps flexibility for external providers, passwordless providers, and
custom registration flows while still shrinking the app once the adapter is
stable.

## Extension Hooks

Higher-level auth helpers must remain extension-oriented. Apps should be able
to run custom behavior around:

- login success and failure
- registration success and failure
- refresh success and failure
- logout success and failure
- revoke-all success and failure
- local account creation
- refresh-session rotation or suspicious reuse

The default contract should pass secret-free event data. Access tokens,
refresh tokens, password hashes, and raw passwords should not be passed through
lifecycle events.

## Schema Extension Rule

The default adapter should not try to model product profile data. If an app
needs more user fields, prefer app-owned profile tables keyed by auth user id
over modifying the default auth tables.

If an app truly needs different auth table columns, it can own a custom
persistence adapter and custom migrations while still using core
`@labkit/server-auth` contracts and helpers.

## Open Decisions

- Should exported entity class names remain `IdentityUserEntity`,
  `IdentityAccountEntity`, `IdentityUserRoleEntity`, and
  `IdentityRefreshSessionEntity` for the first move, or should the package add
  prefixed aliases while preserving the existing migration class name?
- Should password hashing stay app-owned for now, or should core auth expose a
  default Argon2 password hasher behind an interface?
- Should the first migration support only PostgreSQL, with other databases
  left to future adapter packages?
- Should roles remain the only checked-in authorization persistence, or should
  permissions get a separate table before more protected features appear?
- How should adapter repository methods expose transactions without leaking
  TypeORM's `EntityManager` into core interfaces?

## Checklist

### Phase 0: Contract Design

- [x] Finalize the storage-facing interfaces that belong in
      `@labkit/server-auth`.
- [x] Decide which existing app services will consume interfaces first:
      local provider and session service will switch to interfaces in later
      behavior-preserving slices.
- [x] Decide initial entity export names and migration compatibility strategy:
      preserve existing entity names and the existing migration class name when
      the database shape moves.
- [x] Decide whether the first adapter includes a Nest module helper or only
      exported providers: start with a minimal package and manifest, then add
      providers/module helpers once repository adapters exist.
- [x] Add architecture notes for the adapter boundary before moving code.

### Phase 1: Create Adapter Package

- [x] Add `libs/labkit/server-auth-typeorm` as a Rush project and package
      named `@labkit/server-auth-typeorm`.
- [x] Add package scripts, TypeScript config, tests, and README/architecture
      note matching the existing Labkit package shape.
- [x] Add dependencies on `@labkit/server-auth` and
      `@labkit/server-database`; defer Nest TypeORM and TypeORM until entity or
      repository code needs them.
- [x] Export an empty or minimal public API before moving app code.

### Phase 2: Move Database Shape

- [x] Move or copy the four identity entity classes into the adapter with no
      database table or column changes.
- [x] Move or copy the identity migration into the adapter while preserving
      the applied migration identity.
- [x] Export `SERVER_AUTH_TYPEORM_ENTITIES`,
      `SERVER_AUTH_TYPEORM_MIGRATIONS`, and
      `serverAuthTypeormDatabaseManifest`.
- [x] Update `apps/server` to compose the adapter manifest instead of owning
      `identity.database-manifest.ts`.
- [x] Keep migration execution in `apps/server` database workflow.

### Phase 3: Add Repository Adapters

- [x] Implement TypeORM adapters for provider account lookup and creation.
- [x] Implement TypeORM adapters for role lookup.
- [x] Implement TypeORM adapters for refresh-session create, lookup, rotate,
      revoke-one, and revoke-all behavior.
- [x] Add tests for repository behavior against TypeORM metadata or a test
      database strategy already accepted by the repo.
- [x] Keep app behavior unchanged while switching app services to the adapter
      interfaces.

### Phase 4: Thin The Server Identity Module

- [x] Replace direct `@InjectRepository` use in app auth services with
      interface-backed adapter providers.
- [x] Move app-neutral refresh-session persistence behavior behind core auth
      interfaces when extension hooks are clear.
- [x] Keep product-specific resolver DTOs and app GraphQL schema ownership in
      `apps/server` unless a later design explicitly moves them.
- [x] Add a cleaner named helper when stable, while keeping the configurable
      lower-level helper available.

### Phase 5: Validate And Document

- [x] Run focused unit tests for `@labkit/server-auth` and
      `@labkit/server-auth-typeorm`.
- [x] Run server tests and GraphQL contract verification after app wiring
      changes.
- [x] Run Trunk local QA before completing implementation slices.
- [x] Update `apps/server/docs/ai/architecture.md` after behavior changes.
- [x] Update the main extraction task checklist as each slice lands.

## Completion Criteria

- `apps/server` can use `@labkit/server-auth-typeorm` for the default auth
  tables without changing runtime auth behavior.
- Database migrations remain app-composed and app-executed.
- `@labkit/server-auth` remains TypeORM-free.
- The app can still add custom auth events, providers, profile tables, and
  side effects without forking Labkit core.
