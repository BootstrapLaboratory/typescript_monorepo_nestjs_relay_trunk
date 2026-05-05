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
- Shared framework contracts: `@omgjs/labkit-auth-contract` provides framework-light
  auth types/constants and bearer/GraphQL WS auth helpers; `@omgjs/labkit-runtime-config`
  provides shared runtime parsing helpers.
- Server auth helpers: `@omgjs/labkit-server-auth` owns server-side auth integration
  helpers. It provides the GraphQL auth adapter that turns bearer authorization
  headers into principals through an app-supplied access-token verifier, Nest
  module helpers for GraphQL auth wiring, plus reusable public/role/principal
  decorators, GraphQL authentication and role guards, identity provider
  contracts, the provider registry, the default local credentials provider
  algorithm with an app-supplied password hasher, access-token claim mapping
  helpers, and refresh-token generation/hash primitives plus refresh-session
  expiry and rotation decision helpers plus refresh-token transport policy
  helpers for cookie and response-body delivery plus a Nest refresh-token
  transport provider adapter, plus refresh-session orchestration, plus
  lifecycle event contracts and a dispatcher for app-owned auth extensions. It
  also defines storage-facing interfaces for identity accounts, roles, refresh
  sessions, and transactional persistence adapters. The app still owns token
  signing, token secrets, concrete password hashing, and service composition
  around auth decisions.
- Server auth TypeORM adapter: `@omgjs/labkit-server-auth-typeorm` is the optional
  TypeORM/PostgreSQL persistence adapter boundary for `@omgjs/labkit-server-auth`.
  It exports the default auth entity classes, the identity table migration, a
  database manifest, TypeORM repository adapters/providers for Labkit auth
  persistence interfaces, and a `ServerAuthTypeormModule` Nest module that
  registers and exports those repository adapters. The server app composes the
  adapter manifest into its TypeORM options and imports the adapter module for
  app-owned identity services while keeping migration execution in the
  app-owned database workflow. Importing the adapter does not run migrations,
  enable schema synchronization, or mutate a database.
- Server configuration: `@omgjs/labkit-server-config` owns generic server config
  readers, env file path selection, refresh-token transport config parsing, and
  bootstrap CORS/runtime option composition.
- Server database helpers: `@omgjs/labkit-server-database` owns generic PostgreSQL
  URL normalization, SSL config parsing, migration safety checks, discrete
  connection option readers, feature database manifest composition, and
  connection summary helpers. Feature modules export their own entity and
  migration manifests; the app composes them into concrete TypeORM options.
- Server GraphQL helpers: `@omgjs/labkit-server-graphql` owns GraphQL path reading,
  Nest/Apollo GraphQL module and option factory helpers, context shape
  normalization, websocket extra state helpers, client IP extraction,
  subscription lifecycle log payload helpers, reusable scalars, schema
  directives, and Apollo plugin classes. The app passes a server-auth adapter
  into Labkit GraphQL through a server-auth module helper instead of wiring
  bearer extraction in the app module.
- Server framework helpers: `@omgjs/labkit-server-observability` owns structured JSON
  event logging helpers and logging feature-flag readers.
- Realtime: GraphQL subscriptions over `graphql-ws`.
- Pub/sub: Redis by default in checked-in development, validation, and deploy
  environments via `PUBSUB_DRIVER=redis`; in-memory pub/sub is the fallback
  when Redis is not selected.

The main feature boundaries are:

- `src/modules/chat`: resolver, service, DTOs, entity, mapper profile, and
  pub/sub service stay together there.
- `src/modules/identity`: provider-backed login and registration, local
  credential storage, access token signing, refresh session rotation, and
  GraphQL auth mutations. Provider contracts and registry selection come from
  `@omgjs/labkit-server-auth`; the default local credentials provider flow also
  comes from `@omgjs/labkit-server-auth` while the concrete Argon2 password hasher
  remains app-owned. Default auth entities, migrations, and TypeORM persistence
  adapters are registered through `@omgjs/labkit-server-auth-typeorm`; token signing,
  GraphQL resolver, and app service composition remain app-owned.
- `src/modules/access-control`: thin Nest binding that connects the app-owned
  `AccessTokenService` to Labkit guards, plus remaining protocol auth helpers.

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
internal principal shape. The Labkit local provider stores users, provider
accounts, roles, and refresh sessions through app-composed PostgreSQL
persistence adapters.

Application sessions use short-lived signed access tokens plus opaque refresh
tokens. Access tokens are bearer secrets. HTTP GraphQL requests supply them in
`Authorization: Bearer ...`; GraphQL WS connections supply them through
`connectionParams` when the socket opens. Refresh tokens are stored server-side
only as hashes, rotated on refresh, and can be revoked per session or per user.
The access-token claim shape and claim-to-principal normalization come from
`@omgjs/labkit-server-auth`; the server app still signs and verifies JWTs with its
own configured secret. Refresh-token generation and hashing also come from
`@omgjs/labkit-server-auth`, as do refresh-session expiry/state and rotation data
helpers, refresh-session orchestration, and refresh-token delivery,
extraction, and clearing policy. The server app supplies access-token issuing,
runtime config, and persistence adapters to Labkit session orchestration and
the Labkit refresh-token transport provider.

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

The app-owned auth resolver dispatches Labkit lifecycle events around login,
registration, refresh, logout, and revoke-all flows. The default app lifecycle
service writes structured, secret-free logs and continues through handler
failures so notification or audit extensions do not accidentally break normal
auth responses. Expected authorization failures during refresh/logout cleanup
are logged at normal level because stale or missing browser refresh cookies are
ordinary session state; unexpected failures remain warnings. Custom handlers
should stay token-free and use app-owned providers when they need to send
notifications, audit records, or risk signals.

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

- Runtime config is assembled in `src/config/database.config.ts` with generic
  helpers from `@omgjs/labkit-server-database`.
- Migration CLI config is `src/database/typeorm.datasource.ts`.
- Migrations live under `src/database/migrations`.
- Development can run migrations during application startup with
  `DATABASE_RUN_MIGRATIONS_ON_START=true`; do not pair this with
  `DATABASE_SYNCHRONIZE=true`.
- `DATABASE_URL_DIRECT` is preferred for migrations when present.
- `DATABASE_SYNCHRONIZE` defaults off in production.

Auth persistence is explicit app composition. Core `@omgjs/labkit-server-auth` can
define auth rules and storage-facing contracts, but it does not apply database
migrations or mutate schemas by being imported. If Labkit provides a
TypeORM/PostgreSQL auth adapter, it lives in `@omgjs/labkit-server-auth-typeorm` as a
separate package whose entities and migrations are opted into by the server
app's database manifest. Its repository adapters implement the Labkit auth
storage contracts, so app-owned identity services do not inject TypeORM
repositories directly. The checked-in server app composes that adapter manifest
but still owns when migrations run.
Higher-level auth helpers must stay extension-oriented: apps should be able to
run custom code around auth events such as login, registration, refresh, logout,
and revocation without forking Labkit resolver or service defaults. Labkit
lifecycle event payloads are intentionally secret-free; custom handlers should
not receive access tokens or refresh tokens through those events.

## Deployment Boundary

Server package materialization uses `rush deploy` with
`common/config/rush/deploy-server.json`. Provider deployment behavior belongs
under `deploy/cloudrun` and deploy provider modules, not in Nest modules.
`deploy/providers/cloudrun` is currently a TypeScript provider spike for typed
Cloud Run bootstrap orchestration. It includes SDK-backed Resource Manager,
Cloud Billing, Service Usage, Artifact Registry repository, and Artifact
Registry repository IAM dependencies plus `@googleapis/iam`-backed IAM service
account creation, service-account IAM binding, and Resource Manager-backed
project IAM dependencies, plus `@googleapis/iam`-backed Workload Identity pool
and GitHub OIDC provider dependencies. It exports a default Google-backed
dependency factory for `bootstrapCloudRun` and `syncCloudRunRuntimeSecrets`.
The production scenario under `deploy/scenarios/cloudrun-cloudflare-neon-upstash`
has Cloud Run step adapters that can lazy-load the built provider. It
requires an existing billing-enabled Google Cloud `PROJECT_ID`, executes Cloud
Run bootstrap, prints a backend GitHub variable handoff, collects Neon database
URLs plus the Upstash Redis URL as transient secret inputs, and syncs them into
Google Secret Manager. The Cloud Run step can pause for manual billing
enablement and retry when Google reports that billing is required. The scenario
does not create Google Cloud projects. This does not replace the existing Cloud
Run shell scripts yet.

Rush Delivery validation for this project starts backing Postgres and Redis
services, runs migrations, starts the production server, and executes the Cloud
Run smoke test declared in `.dagger/validate/targets/server.yaml`.
