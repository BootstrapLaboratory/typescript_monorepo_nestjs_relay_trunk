# Server Architecture

`apps/server` is the NestJS backend. It owns runtime API behavior, GraphQL
schema generation, database access, migrations, and backend deploy validation.

## Runtime Shape

- Framework: NestJS with the Fastify platform adapter.
- API: Nest GraphQL code-first schema with Apollo.
- Database: TypeORM with PostgreSQL.
- Realtime: GraphQL subscriptions over `graphql-ws`.
- Pub/sub: in-memory locally by default, Redis when `PUBSUB_DRIVER=redis`.

The main feature boundary is `src/modules/chat`: resolver, service, DTOs,
entity, mapper profile, and pub/sub service stay together there.

## GraphQL Contract

The server is the source of truth for the GraphQL schema. Code-first decorators
generate `libs/api/schema.gql`, which the webapp uses for Relay.

- Run `npm --prefix apps/server run graphql:schema` after GraphQL API changes.
- Rush `verify` runs `graphql:check-contract` and fails on schema drift.
- Do not edit `libs/api/schema.gql` by hand unless intentionally resolving a
  generated diff.

## Database

Production uses migrations, not schema synchronization.

- Runtime config comes from `src/config/database.config.ts`.
- Migration CLI config is `src/database/typeorm.datasource.ts`.
- Migrations live under `src/database/migrations`.
- `DATABASE_URL_DIRECT` is preferred for migrations when present.
- `DATABASE_SYNCHRONIZE` defaults off in production.

## Deployment Boundary

Server package materialization uses `rush deploy` with
`common/config/rush/deploy-server.json`. Provider deployment behavior belongs
under `deploy/cloudrun`, not in Nest modules.

Rush Delivery validation for this project starts backing Postgres and Redis
services, runs migrations, starts the production server, and executes the Cloud
Run smoke test declared in `.dagger/validate/targets/server.yaml`.
