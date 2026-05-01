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
tokens. Access tokens are bearer secrets. HTTP GraphQL requests supply them in
`Authorization: Bearer ...`; GraphQL WS connections supply them through
`connectionParams` when the socket opens. Refresh tokens are stored server-side
only as hashes, rotated on refresh, and can be revoked per session or per user.

The browser-oriented and most secure default is refresh-cookie transport:
`AUTH_REFRESH_TOKEN_TRANSPORT=cookie`. In this mode the server delivers the
refresh token as an HttpOnly cookie, the webapp cannot read that token from
JavaScript, and browser GraphQL requests must use CORS credentials. This is the
preferred production shape for the Cloudflare Pages webapp.

`AUTH_REFRESH_TOKEN_TRANSPORT=response_body` is the less secure browser option
because the refresh token is returned to client code and the client must decide
where to keep it. It is useful for non-browser clients, CLI tools, tests,
native clients, or environments where cookies are intentionally unavailable. If
a browser uses `response_body`, do not store refresh tokens in local storage
unless accepting the XSS exposure is an explicit product decision.

Access token persistence is also a security boundary. The safest browser setup
is memory-only access tokens plus an HttpOnly refresh cookie. Persisting access
tokens in `localStorage` or `sessionStorage` can make reloads simpler, but any
XSS bug can read those tokens. This project intentionally keeps access tokens
out of browser storage.

GraphQL WS authentication is connection-scoped. A principal is resolved when
the socket connects; existing subscription connections do not automatically
change identity when HTTP logout happens. The current webapp closes/restarts
its socket on local login, logout, or access-token changes. When protected
subscriptions become important across multiple browsers, devices, or server
instances, add server-side revocation fanout: publish session/user revocation
events through Redis and close matching in-memory websocket connections by
`principal.sessionId` or `principal.userId` on every server instance.

Auth-related server environment variables:

- `AUTH_ACCESS_TOKEN_SECRET`: required signing secret, at least 32 characters.
  Use a strong production secret and rotate intentionally.
- `AUTH_ACCESS_TOKEN_TTL_SECONDS`: access-token lifetime. Default is `900`
  seconds. Shorter is safer; longer reduces refresh frequency.
- `AUTH_REFRESH_TOKEN_TTL_SECONDS`: refresh-token lifetime. Default is
  `1209600` seconds.
- `AUTH_REFRESH_TOKEN_TRANSPORT`: `cookie` for the browser default, or
  `response_body` for clients that manage refresh tokens themselves.
- `AUTH_REFRESH_COOKIE_NAME`: refresh cookie name. Default is `refresh_token`.
- `AUTH_REFRESH_COOKIE_PATH`: refresh cookie path. Default is `/graphql`.
- `AUTH_REFRESH_COOKIE_SAME_SITE`: `lax`, `strict`, or `none`. Default is
  `lax`. Use `none` only when cross-site cookies are required, and pair it with
  secure HTTPS cookies.
- `AUTH_REFRESH_COOKIE_SECURE`: whether the refresh cookie uses `Secure`.
  Defaults to true in production and false otherwise.
- `AUTH_PROVIDERS`: comma-separated enabled identity providers. Default is
  `local`.
- `AUTH_DEFAULT_LOGIN_PROVIDER`: provider used when login input omits a
  provider. Default is the first enabled provider.
- `AUTH_REGISTRATION_PROVIDER`: provider that handles registration. Default is
  `local`.
- `AUTH_LOCAL_DEFAULT_ROLE`: default role assigned by local registration.
  Default is `user`.
- `CORS_ORIGIN`: comma-separated browser origins allowed by CORS. Cookie
  refresh transport enables CORS credentials, so production must use the real
  webapp origin rather than wildcard origins.
- `GRAPHQL_PATH`: GraphQL HTTP and WS path. Default is `/graphql`. Keep it
  aligned with refresh cookie path and webapp endpoint variables.

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
under `deploy/cloudrun` and deploy provider modules, not in Nest modules.
`deploy/providers/cloudrun` is currently a TypeScript provider spike for typed
Cloud Run bootstrap orchestration. It includes SDK-backed Resource Manager,
Service Usage, Artifact Registry repository, and Artifact Registry repository
IAM dependencies plus `@googleapis/iam`-backed IAM service account creation,
service-account IAM binding, and Resource Manager-backed project IAM
dependencies, plus `@googleapis/iam`-backed Workload Identity pool and GitHub
OIDC provider dependencies. It is not wired into scenarios and does not replace
the existing Cloud Run shell scripts yet.

Rush Delivery validation for this project starts backing Postgres and Redis
services, runs migrations, starts the production server, and executes the Cloud
Run smoke test declared in `.dagger/validate/targets/server.yaml`.
