# Server Architecture

`apps/server` is the backend runtime. It owns API behavior, GraphQL schema
generation, database access, migrations, identity, access control,
subscriptions, and backend validation.

The server is intentionally a product application, not a deployment toolkit.
Cloud Run scripts, provider SDK wrappers, and pre-deployment scenarios live
under `deploy`. The NestJS app focuses on serving the API correctly once it is
running.

## Runtime Stack

The backend stack is:

- NestJS as the application framework
- Fastify as the HTTP platform adapter
- Apollo through `@nestjs/apollo` for GraphQL
- TypeORM for database access
- PostgreSQL for persistence
- `graphql-ws` for subscriptions
- Redis for production pub/sub fanout

NestJS is useful here because the backend is not just a set of handlers. It has
modules, providers, guards, resolvers, database services, configuration, and
runtime lifecycle hooks. Nest's dependency injection keeps those pieces
explicit without forcing every feature to hand-wire its dependencies.

Fastify is the HTTP adapter because the project wants Nest structure without
being tied to Express runtime behavior. Apollo owns GraphQL execution, while
Nest owns module composition and dependency injection.

## Application Composition

`AppModule` wires the runtime together:

- global configuration through `ConfigModule`
- feature modules for chat, identity, and access control
- GraphQL setup with HTTP and `graphql-ws` subscription support
- TypeORM setup through the shared database config

The important design choice is that protocol setup lives at the application
edge, while feature logic stays in feature modules. For example, GraphQL WS
connection authentication is configured where GraphQL is bootstrapped, but the
token verification service comes from the identity module.

That keeps cross-cutting protocol behavior centralized without making the
identity module depend on Apollo-specific wiring.

## Feature Boundaries

The current main server modules are:

| Module           | Owns                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `chat`           | message entity, GraphQL message model/input, resolver, service, mapper, pub/sub                     |
| `identity`       | provider registry, local credentials, users, roles, refresh sessions, token signing, auth mutations |
| `access-control` | bearer parsing, GraphQL auth guard, roles guard, principal decorators, public operation metadata    |

The pattern is feature-first. Chat files stay together because they change
together. Identity files stay together because login, registration, refresh
rotation, and local credential storage are one domain. Access-control stays
separate because protected operations should not duplicate provider-specific
checks.

The consequence is that adding a protected feature should not invent its own
auth parsing. It should use the shared principal contract and access-control
guards/decorators.

## GraphQL API Shape

The server uses Nest GraphQL code-first types. Resolvers, object models, inputs,
and scalars produce the schema described in `libs/api/schema.gql`.

The chat module exposes message queries, mutations, and a `MessageAdded`
subscription. The identity module exposes auth mutations for registration,
login, refresh, logout, and logout-all.

Current chat operations are public. Protected operations should resolve callers
through the shared `Principal` contract and use the access-control module
rather than checking a specific identity provider directly.

The schema generation path is part of the server contract. After GraphQL API
changes, run:

```sh
npm --prefix apps/server run graphql:schema
```

Rush verification runs the contract check and fails if the generated
`libs/api/schema.gql` is not committed.

## Identity And Sessions

Identity is provider-based. `AUTH_PROVIDERS` selects enabled providers, and
provider adapters normalize results into the same internal principal shape.
The checked-in development default is the local provider.

The local provider stores identity users, provider accounts, roles, and refresh
sessions in PostgreSQL. Passwords are hashed with Argon2. Refresh tokens are
opaque secrets; the server stores hashes and rotates sessions on refresh.

The browser-oriented default is:

```text
short-lived access token + opaque refresh token in an HttpOnly cookie
```

That has consequences for both sides of the app:

- GraphQL HTTP requests need credentials when cookie refresh transport is used.
- The webapp cannot read the refresh token from JavaScript.
- The backend CORS origin must be the real webapp origin in production.
- Access tokens can stay in browser memory instead of persistent storage.

The server also supports response-body refresh token transport for non-browser
clients, tests, or intentionally cookie-free clients. That mode is not the
preferred browser production shape because client JavaScript receives the
refresh token.

## Realtime And Pub/Sub

Subscriptions use `graphql-ws`. A principal is resolved when the websocket
connects, using access token data from connection params. That means websocket
auth is connection-scoped: if the browser logs in or out later, the webapp must
restart its socket so the server sees the new identity.

For pub/sub, the chat module can use either in-memory pub/sub or Redis. Redis is
the selected driver for checked-in validation and deployment-like environments
through:

```text
PUBSUB_DRIVER=redis
REDIS_URL=...
```

The design reason is multi-instance behavior. In-memory pub/sub is enough for a
single local process, but Cloud Run can run multiple instances. Redis gives
subscription events a process-independent path.

## Database And Migrations

The server uses TypeORM with PostgreSQL. Production uses migrations rather than
schema synchronization.

The key distinction is:

- runtime database config lives in `src/config/database.config.ts`
- migration CLI config lives in `src/database/typeorm.datasource.ts`
- migrations live under `src/database/migrations`

`DATABASE_SYNCHRONIZE` defaults off in production. Development can run
migrations on application startup with `DATABASE_RUN_MIGRATIONS_ON_START=true`,
but the config rejects combining that with `DATABASE_SYNCHRONIZE=true`.

That explicit failure matters. Schema synchronization and migrations are two
different ownership models. Allowing both at the same time would make it hard
to know which mechanism changed the database.

For production-style migrations, `DATABASE_URL_DIRECT` is preferred when
present. That lets runtime traffic use a pooled database URL while migration
commands use a direct connection.

## Deployment Boundary

The server package target uses a Rush deploy archive:

```text
common/deploy/server
```

That archive is produced from the Rush project, then the Cloud Run deploy
target runs provider-specific deployment scripts under `deploy/cloudrun`.

The NestJS app does not create Artifact Registry repositories, service
accounts, Workload Identity pools, or Secret Manager entries. Those concerns
belong to deployment scripts and provider packages.

This separation gives the backend a clean runtime contract:

- accept configuration through environment variables
- connect to database and Redis
- serve GraphQL HTTP and WS on `GRAPHQL_PATH`
- run migrations when explicitly configured
- expose health and API behavior for deploy validation

Everything about how the runtime gets to Cloud Run is outside the app module.

## Validation

Rush Delivery includes a server validation target. It starts PostgreSQL and
Redis services, runs migrations, starts the production server, and executes a
Cloud Run smoke test.

That validation is intentionally closer to production than a unit test. It
checks that migrations, runtime config, Redis pub/sub configuration, production
startup, and the GraphQL endpoint can work together in one isolated flow.

Unit tests still matter inside modules. The deploy validation target catches a
different class of failure: integration mistakes between runtime configuration,
database state, and deployment assumptions.

## Design Consequences

The server architecture favors explicit boundaries:

- feature modules own domain behavior
- access control owns auth enforcement helpers
- identity owns session and provider behavior
- database config owns migration/runtime connection rules
- `libs/api` owns the committed schema contract
- `deploy` owns provider and deployment behavior

That makes changes slightly more deliberate. A new feature usually needs a
module boundary, schema generation, possible migration work, and maybe webapp
Relay updates. The upside is that each of those effects is visible in source
control and CI.

## Navigation

Previous: [GraphQL Contract Boundary](03-graphql-contract-boundary.md)

Next: [Webapp Architecture](05-webapp-architecture.md)
