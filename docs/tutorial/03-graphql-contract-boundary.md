# GraphQL Contract Boundary

This chapter will explain why `libs/api` exists, how the server generates
`schema.gql`, how the webapp consumes that schema through Relay, and how the
repository detects schema drift.

## Chapter Intent

Cover the design decision that the server owns the GraphQL schema while the
schema itself is committed as a shared package. Explain the consequences for
backend changes, frontend Relay operations, and CI verification.

## Navigation

Previous: [Rush Monorepo Foundation](02-rush-monorepo-foundation.md)

Next: [Server Architecture](04-server-architecture.md)
