# GraphQL Contract Boundary

The GraphQL schema is the contract between the backend and the webapp. This
project makes that contract visible by committing the generated schema as a
small Rush project: `libs/api`.

That choice is easy to underestimate. The schema could be treated as an
implementation detail of the server, or regenerated only inside frontend CI.
Instead, the repository gives it a stable location and a package identity. That
lets Rush model the server-to-webapp contract directly.

## Ownership Model

The server owns the schema because the API is implemented there. NestJS
code-first decorators on resolvers, object models, inputs, and scalars describe
the GraphQL surface.

The shared contract package owns the generated output:

```text
libs/api/
  package.json
  schema.gql
```

The webapp consumes that committed schema through Relay. It does not infer the
API from live server introspection during normal builds.

That gives each side a clear job:

| Layer | Responsibility |
| --- | --- |
| `apps/server` | Define resolvers, models, inputs, scalars, and auth behavior |
| `libs/api` | Store the generated `schema.gql` contract |
| `apps/webapp` | Compile Relay operations against `schema.gql` |

The contract package stays intentionally tiny. It is not a shared runtime
library, DTO package, or place for hand-written API helpers. Its purpose is to
make the schema a versioned artifact in the monorepo.

## Schema Generation

The server script `graphql:schema` generates `libs/api/schema.gql`.

```sh
npm --prefix apps/server run graphql:schema
```

Generation is handled by `apps/server/src/scripts/generate-schema.ts`. The
script starts a Nest GraphQL schema builder context, creates a schema from the
server's resolver manifest, sorts it, prints it as SDL, and writes the result to
`libs/api/schema.gql`.

The resolver manifest matters. The server lists the GraphQL resolvers and
scalars that belong in the schema instead of relying on runtime boot to mutate
the shared contract file. Runtime boot sets `autoSchemaFile: true`, but the
committed contract is generated ahead of time by the explicit script.

That avoids a sloppy boundary where starting the server in one environment
quietly rewrites a shared file. Schema generation becomes an intentional
developer action and a verification step.

## Drift Detection

The server `verify` script runs `graphql:check-contract`. That script
regenerates the schema and fails if `libs/api/schema.gql` differs from the
committed version.

The failure is useful. It means one of two things happened:

- backend GraphQL behavior changed and the schema file needs to be committed
- generated schema output changed unexpectedly and the backend change should be
  reviewed

This is better than letting the webapp discover the mismatch later. A schema
diff is a product contract diff, so it should be visible in code review.

## Relay Consumption

The webapp's Relay config points at the committed schema:

```json
{
  "schema": "../../libs/api/schema.gql"
}
```

When the webapp runs Relay codegen, Relay validates frontend queries,
mutations, fragments, and subscriptions against that schema.

```sh
npm --prefix apps/webapp run relay
```

The webapp build intentionally runs:

```text
relay -> tsc -b -> vite build
```

Relay artifacts are generated before TypeScript and Vite build the browser app.
That ordering means frontend code sees typed operation artifacts that match the
current committed contract.

## Why Not Share TypeScript DTOs

It can be tempting to share backend DTO classes with the frontend. This project
does not do that. The server's code-first classes are server implementation
tools. The webapp's operation types are Relay-generated from GraphQL operations.

That separation gives the frontend a client-shaped API:

- the webapp types only the fields each operation asks for
- server persistence models do not leak into browser code
- GraphQL remains the public boundary between runtime processes

The consequence is a little more generation work, but the contract is cleaner.
The frontend depends on the schema, not on server internals.

## Change Workflow

For a GraphQL API change, the normal workflow is:

1. Change the server resolver, model, input, scalar, or auth behavior.
2. Run `npm --prefix apps/server run graphql:schema`.
3. Review and commit the `libs/api/schema.gql` diff.
4. Update webapp Relay operations when needed.
5. Run `npm --prefix apps/webapp run relay`.
6. Run repository verification before merging.

If the schema changes but the webapp does not need new data yet, the webapp may
not need operation changes. The committed schema diff is still valuable because
it records the API change.

## Design Consequences

This boundary makes API compatibility visible. Reviewers can ask whether a
schema diff is intended, whether frontend operations need updates, and whether
new protected operations use the shared access-control path.

It also keeps generated files honest. `libs/api/schema.gql` is generated output,
but it is committed because it is the contract. Relay artifacts are generated
inside the webapp because they are client build output. Those are different
kinds of generated files, and the repository treats them differently.

## Navigation

Previous: [Rush Monorepo Foundation](02-rush-monorepo-foundation.md)

Next: [Server Architecture](04-server-architecture.md)
