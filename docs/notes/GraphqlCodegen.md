# GraphQL Codegen Notes

This repository uses NestJS GraphQL in **code-first** mode on the backend and
Relay on the webapp.

The important build rule is:

- the backend TypeScript decorators are the source of truth
- `schema.gql` is generated, not tracked
- Relay artifacts are generated, not tracked

## Source Of Truth

The GraphQL contract originates from the backend code-first definitions under
[apps/server/src](../../apps/server/src), especially:

- [apps/server/src/modules/chat/chat.resolver.ts](../../apps/server/src/modules/chat/chat.resolver.ts)
- [apps/server/src/modules/chat/dto/message.model.ts](../../apps/server/src/modules/chat/dto/message.model.ts)
- [apps/server/src/modules/chat/dto/new-message.input.ts](../../apps/server/src/modules/chat/dto/new-message.input.ts)
- [apps/server/src/modules/common/scalars/date.scalar.ts](../../apps/server/src/modules/common/scalars/date.scalar.ts)

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

- [apps/server/generated/schema.gql](../../apps/server/generated/schema.gql)

This file is intentionally ignored by Git.

## Relay Generation

The webapp consumes the generated SDL via:

- [apps/webapp/relay.config.json](../../apps/webapp/relay.config.json)

Relay generation always bootstraps the schema first:

```bash
npm --prefix apps/webapp run relay
```

That command:

1. runs `apps/server` schema generation
2. runs `relay-compiler`

Relay outputs are written under:

- `apps/webapp/src/**/generated/`

These files are also intentionally ignored by Git.

## Build Ownership

The clean-checkout build order for the webapp is:

1. generate backend SDL
2. generate Relay artifacts
3. run TypeScript build
4. run Vite build

That order is encoded in:

- [apps/webapp/package.json](../../apps/webapp/package.json)

So a clean checkout no longer depends on committed GraphQL generated files.

For production deployment, the webapp is built in GitHub Actions and the
prebuilt `apps/webapp/dist` output is uploaded to Cloudflare Pages with
Wrangler. Cloudflare no longer rebuilds frontend source from Git pushes for
this repo's main deployment path.

## Local Development

For local development:

- `apps/webapp` runs an initial schema generation before Relay watch starts
- `apps/server` still writes the schema snapshot during local Nest startup so
  backend schema edits refresh the file after restarts

That keeps the devcontainer workflow practical while production and CI builds
stay independent from backend runtime startup.

## Updating The GraphQL Surface

When you add a new GraphQL resolver or scalar class, update:

- [apps/server/src/modules/chat/chat.module.ts](../../apps/server/src/modules/chat/chat.module.ts) if it belongs to that module
- [apps/server/src/graphql/schema-manifest.ts](../../apps/server/src/graphql/schema-manifest.ts) if a new module or orphaned type needs to be included in SDL generation

If the public GraphQL contract changes, rerun:

```bash
npm --prefix apps/webapp run relay
```
