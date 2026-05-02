# Auth, Realtime, And Browser Security

This chapter will explain the cross-cutting browser and backend security model:
memory-only access tokens, HttpOnly refresh cookies, CORS, credentialed GraphQL
HTTP requests, GraphQL WS authentication, socket restart behavior, and Redis
fanout implications.

## Chapter Intent

Cover why the browser does not persist access tokens, why refresh cookies affect
CORS and GraphQL paths, and why realtime authentication must be treated as
connection-scoped.

## Navigation

Previous: [Webapp Architecture](05-webapp-architecture.md)

Next: [Rush Delivery Release Model](07-rush-delivery-release-model.md)
