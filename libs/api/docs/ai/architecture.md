# API Contract Architecture

`libs/api` is the shared GraphQL schema contract package. It exists so Rush can
model the schema as a dependency between the server and webapp.

## Ownership

- The server generates `schema.gql` from Nest GraphQL code-first types.
- The webapp depends on this package as `api-contract` and consumes
  `schema.gql` through Relay from the installed package path.
- The library package itself should stay tiny; it publishes only `schema.gql`.

## Workflow

- Use `npm --prefix apps/server run graphql:schema` to regenerate the schema.
- Rush `verify` checks that generated schema output is committed.
- `npm --prefix apps/webapp run relay` regenerates Relay artifacts from the
  committed schema through `node_modules/api-contract/schema.gql`.

GraphQL schema changes usually affect the server and webapp boundaries, but this
package remains only the committed generated contract.
