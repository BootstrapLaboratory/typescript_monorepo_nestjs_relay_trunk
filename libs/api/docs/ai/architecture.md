# API Contract Architecture

`libs/api` is the shared GraphQL schema contract package. It exists so Rush can
model the schema as a dependency between the server and webapp.

## Ownership

- The server generates `schema.gql` from Nest GraphQL code-first types.
- The webapp consumes `schema.gql` through Relay.
- The library package itself should stay tiny; it publishes only `schema.gql`.

## Workflow

- Use `npm --prefix apps/server run graphql:schema` to regenerate the schema.
- Rush `verify` checks that generated schema output is committed.
- `npm --prefix apps/webapp run relay` regenerates Relay artifacts from the
  committed schema.

GraphQL schema changes usually affect the server and webapp boundaries, but this
package remains only the committed generated contract.
