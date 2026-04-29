# Server Architecture

`apps/server` is the NestJS backend. It owns runtime API behavior, GraphQL
schema generation, database access, migrations, and backend deploy validation.

## Runtime Shape

- Framework: NestJS with the Fastify platform adapter.
- API: Nest GraphQL code-first schema with Apollo.
- Database: TypeORM with PostgreSQL.
- Identity: provider-based authentication with local credentials as the
  checked-in development default.
- Access control: principal-aware guards and decorators for protected GraphQL
  operations.
- Realtime: GraphQL subscriptions over `graphql-ws`.
- Pub/sub: Redis by default in checked-in development, validation, and deploy
  environments via `PUBSUB_DRIVER=redis`; in-memory pub/sub is the fallback
  when Redis is not selected.

The main feature boundaries are:

- `src/modules/chat`: resolver, service, DTOs, entity, mapper profile, and
  pub/sub service stay together there.
- `src/modules/identity`: provider registry, provider-backed login and
  registration, local credential storage, access token signing, refresh session
  rotation, and GraphQL auth mutations.
- `src/modules/access-control`: authentication guards, role guards, principal
  decorators, and protocol auth helpers.

## GraphQL Contract

The server is the source of truth for the GraphQL schema. Code-first decorators
generate `libs/api/schema.gql`, which the webapp uses for Relay.

- Run `npm --prefix apps/server run graphql:schema` after GraphQL API changes.
- Rush `verify` runs `graphql:check-contract` and fails on schema drift.
- Do not edit `libs/api/schema.gql` by hand unless intentionally resolving a
  generated diff.

Existing chat GraphQL operations are intentionally public while the identity
layer lands. New protected operations should resolve callers through the shared
`Principal` contract and use the access-control guards/decorators instead of
provider-specific checks.

GraphQL subscriptions authenticate with access tokens supplied through
`graphql-ws` connection params. HTTP GraphQL requests can resolve principals
from `Authorization: Bearer ...` headers.

## Identity And Sessions

Identity providers are selected by configuration. `AUTH_PROVIDERS` enables one
or more providers, and provider adapters normalize their result into the same
internal principal shape. The local provider stores users, provider accounts,
roles, and refresh sessions in PostgreSQL.

Application sessions use short-lived signed access tokens plus opaque refresh
tokens. Refresh tokens are stored only as hashes, rotated on refresh, and can be
revoked per session or per user. Refresh delivery is a transport concern:
`AUTH_REFRESH_TOKEN_TRANSPORT=cookie` uses Fastify cookies with CORS
credentials, while `response_body` returns and accepts refresh tokens through
GraphQL mutation payloads for non-browser clients.

## Database

Production uses migrations, not schema synchronization.

- Runtime config comes from `src/config/database.config.ts`.
- Migration CLI config is `src/database/typeorm.datasource.ts`.
- Migrations live under `src/database/migrations`.
- Development can run migrations during application startup with
  `DATABASE_RUN_MIGRATIONS_ON_START=true`; do not pair this with
  `DATABASE_SYNCHRONIZE=true`.
- `DATABASE_URL_DIRECT` is preferred for migrations when present.
- `DATABASE_SYNCHRONIZE` defaults off in production.

## Deployment Boundary

Server package materialization uses `rush deploy` with
`common/config/rush/deploy-server.json`. Provider deployment behavior belongs
under `deploy/cloudrun`, not in Nest modules.

Rush Delivery validation for this project starts backing Postgres and Redis
services, runs migrations, starts the production server, and executes the Cloud
Run smoke test declared in `.dagger/validate/targets/server.yaml`.
