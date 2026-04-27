# GraphQL Codegen Notes

This repository uses NestJS GraphQL in **code-first** mode on the backend and
Relay on the webapp.

The important build rule is:

- the backend TypeScript decorators are the source of truth
- `libs/api/schema.gql` is the committed GraphQL contract snapshot
- Relay artifacts are generated from that contract during build and local watch

## Source Of Truth

The GraphQL contract originates from the backend code-first definitions under
[apps/server/src](../../apps/server/src), especially:

- [apps/server/src/modules/chat/chat.resolver.ts](../../apps/server/src/modules/chat/chat.resolver.ts)
- [apps/server/src/modules/chat/dto/message.model.ts](../../apps/server/src/modules/chat/dto/message.model.ts)
- [apps/server/src/modules/chat/dto/new-message.input.ts](../../apps/server/src/modules/chat/dto/new-message.input.ts)
- [apps/server/src/modules/common/scalars/date.scalar.ts](../../apps/server/src/modules/common/scalars/date.scalar.ts)

The committed contract package lives at:

- [libs/api](../../libs/api)

## SDL Generation

The backend owns GraphQL SDL generation through:

- [apps/server/src/scripts/generate-schema.ts](../../apps/server/src/scripts/generate-schema.ts)
- [apps/server/src/graphql/schema-manifest.ts](../../apps/server/src/graphql/schema-manifest.ts)

That script uses Nest's documented `GraphQLSchemaBuilderModule` /
`GraphQLSchemaFactory` path to generate SDL without booting the real app,
database, or Redis runtime dependencies.

Run it directly with:

```bash
npm --prefix apps/server run graphql:schema
```

Output:

- [libs/api/schema.gql](../../libs/api/schema.gql)

This file is intentionally tracked in Git. CI regenerates it whenever `server`
is in scope and fails if the committed contract is stale.

## Relay Generation

The webapp consumes the committed SDL snapshot via:

- [apps/webapp/relay.config.json](../../apps/webapp/relay.config.json)

Relay generation uses that committed contract:

```bash
npm --prefix apps/webapp run relay
```

That command runs `relay-compiler` against
[libs/api/schema.gql](../../libs/api/schema.gql).

Relay outputs are written under:

- `apps/webapp/src/**/__generated__/`

## Build Ownership

The clean-checkout build order for the webapp is:

1. read the committed GraphQL contract from `libs/api/schema.gql`
2. generate Relay artifacts
3. run TypeScript build
4. run Vite build

That order is encoded in:

- [apps/webapp/package.json](../../apps/webapp/package.json)

For release CI, [main-workflow.yaml](../../.github/workflows/main-workflow.yaml)
calls Dagger `workflow`. The committed `libs/api/schema.gql` snapshot is
verified during the Dagger build stage by the server project's Rush `verify`
script whenever `server` is in scope.

For production deployment, the webapp build and package materialization happen
inside Dagger. The prebuilt `apps/webapp/dist` directory is then published to
Cloudflare Pages by the Dagger deploy runtime using Wrangler.

## Local Development

For local development:

- `libs/api` runs `graphql:schema:watch` against `apps/server`
- `apps/webapp` runs Relay in watch mode against `libs/api/schema.gql`
- `apps/server` boots without mutating the shared contract file at runtime

That keeps the devcontainer workflow practical while production and CI use the
same ahead-of-time contract model.

## Updating The GraphQL Surface

When you add a new GraphQL resolver or scalar class, update:

- [apps/server/src/modules/chat/chat.module.ts](../../apps/server/src/modules/chat/chat.module.ts) if it belongs to that module
- [apps/server/src/graphql/schema-manifest.ts](../../apps/server/src/graphql/schema-manifest.ts) if a new module or orphaned type needs to be included in SDL generation

If the public GraphQL contract changes, rerun:

```bash
npm --prefix apps/server run graphql:schema
npm --prefix apps/webapp run relay
```
