# Auth, Realtime, And Browser Security

Auth and realtime are one cross-boundary design in this project. The browser,
Relay network, GraphQL HTTP transport, GraphQL WS transport, NestJS context,
identity module, access-control guards, cookies, CORS, and Redis pub/sub all
have to agree.

The core idea is:

```text
short-lived access token in browser memory
+ opaque refresh token stored server-side and delivered as an HttpOnly cookie
+ websocket auth supplied through connection params
+ Redis pub/sub for multi-instance realtime fanout
```

That shape gives good browser security without making realtime unreliable in a
multi-instance deployment.

## Session Model

The server issues two token types:

| Token         | Shape               | Browser storage            | Server behavior                                     |
| ------------- | ------------------- | -------------------------- | --------------------------------------------------- |
| Access token  | signed JWT          | memory only                | verified on GraphQL HTTP requests and WS connects   |
| Refresh token | opaque random token | HttpOnly cookie by default | hashed in PostgreSQL, rotated on refresh, revocable |

Access tokens are short-lived bearer secrets. The webapp stores the current
access token only in JavaScript memory. It uses that token in an
`Authorization: Bearer ...` header for GraphQL HTTP requests and in GraphQL WS
connection params for subscriptions.

Refresh tokens are long-lived session secrets. In the preferred browser shape,
the server sends the refresh token as an HttpOnly cookie. The webapp cannot
read it, copy it, or put it into a GraphQL variable. It can only make a
credentialed request to the GraphQL endpoint and let the browser attach the
cookie.

The consequence is deliberate: a page reload loses the access token, but the
browser can attempt a refresh using the cookie. This is safer than storing the
access token in `localStorage`, where any cross-site scripting bug could read
it.

## Refresh Transport Choices

The server supports two refresh-token transports:

| Transport       | Intended use                                                          | Tradeoff                                        |
| --------------- | --------------------------------------------------------------------- | ----------------------------------------------- |
| `cookie`        | browser production default                                            | safest for browsers, requires credentialed CORS |
| `response_body` | tests, CLI clients, native clients, intentionally cookie-free clients | client code receives the refresh token          |

The webapp is currently built around cookie transport. Its refresh-token
transport module sends GraphQL auth requests with `credentials: "include"` and
does not store refresh tokens in browser storage.

That decision gives the backend extra responsibilities:

- register cookie support in Fastify
- set refresh cookies as HttpOnly
- clear refresh cookies on logout
- enable CORS credentials when cookie transport is active
- use a real production `CORS_ORIGIN`, not wildcard CORS
- keep `AUTH_REFRESH_COOKIE_PATH`, `GRAPHQL_PATH`, and the webapp endpoint path
  aligned

The default refresh cookie path is `/graphql`, which matches the default
GraphQL path. If either path changes, both sides need to change together.

## First-Paint Session Hint

The webapp stores a tiny non-secret hint in local storage under
`webapp:auth-session-hint`.

That hint contains only:

```text
kind: "authenticated"
updatedAt: <timestamp>
```

It is not an auth credential. It does not include access tokens, refresh
tokens, email, display name, roles, or permissions.

The hint exists for first-paint UX. Before the refresh attempt completes, the
navigation can optimistically show authenticated navigation if the browser
previously had a session. If refresh fails, the hint is cleared and the webapp
returns to anonymous state.

This is an important distinction: storing a hint is a UX optimization; storing
a bearer token would be a security decision.

## GraphQL HTTP Flow

Relay owns GraphQL HTTP requests through `src/shared/relay/environment.ts`.

For each request, the network layer:

1. reads the in-memory access token
2. adds `Authorization: Bearer ...` when a token exists
3. sends credentials according to the refresh-token transport
4. maps HTTP 401 responses into GraphQL auth-required errors
5. performs one shared refresh attempt for non-auth operations when the
   response says authentication is required
6. retries the original operation if refresh succeeds

Auth operations such as login, register, refresh, and logout are excluded from
that refresh-and-retry loop. That avoids a recursive failure mode where a
failed refresh operation tries to refresh itself.

On the server, GraphQL context resolves a principal from the HTTP
`Authorization` header when present. Protected operations can then rely on the
shared access-control guards and decorators instead of parsing headers in each
resolver.

## GraphQL WS Flow

GraphQL WS authentication is connection-scoped.

When the webapp opens the websocket, it sends the current access token in
connection params:

```text
authorization: Bearer <access token>
```

The server resolves the principal during `graphql-ws` connection setup and
stores it in the websocket context. Existing websocket connections do not
magically change identity when the browser later logs in, logs out, or refreshes
the access token.

The webapp handles that by subscribing to auth state changes. When the access
token changes, it terminates the GraphQL WS client. The next subscription use
opens a new socket with the latest connection params.

That behavior prevents a subtle bug: a browser could log out locally while an
old websocket connection still carries the previous principal on the server.

## Realtime Recovery

Realtime connection handling lives in `src/shared/realtime`, not inside the
chat feature. That shared module tracks:

- idle, connecting, connected, retrying, and disconnected status
- retry attempt count
- close code and close reason
- browser online/offline state
- heartbeat timeout
- reconnect watchdog timeout
- fatal GraphQL WS close codes

The chat feature consumes this shared state. It can show a connection message
and temporarily disable sending while live updates are reconnecting.

The design reason is reuse. Future subscription features should not implement
their own websocket retry policy. They should use the shared Relay subscription
network and the shared realtime connection state.

## Redis Fanout

The chat module supports in-memory pub/sub and Redis pub/sub.

In-memory pub/sub is enough for a single local process. It is not enough for
multi-instance production, because one Cloud Run instance cannot deliver
subscription events that were published only inside another instance's memory.

With `PUBSUB_DRIVER=redis`, the server publishes chat events to Redis and each
server instance subscribes to the Redis channel. Each instance then delivers the
event into its local GraphQL subscription iterator.

That gives realtime fanout this shape:

```text
mutation on instance A
  -> publish event to Redis
  -> instance A receives event
  -> instance B receives event
  -> each instance delivers to its connected websocket clients
```

The consequence is operational: production needs `REDIS_URL` whenever Redis
pub/sub is selected. The Rush Delivery server validation target includes Redis
so this path is exercised before deployment.

## CORS And Endpoint Alignment

Cookie refresh transport ties together several values:

| Concern                           | Setting                                             |
| --------------------------------- | --------------------------------------------------- |
| Browser origin allowed by backend | `CORS_ORIGIN`                                       |
| Server GraphQL path               | `GRAPHQL_PATH`                                      |
| Refresh cookie path               | `AUTH_REFRESH_COOKIE_PATH`                          |
| Webapp HTTP endpoint              | `VITE_GRAPHQL_HTTP` from `WEBAPP_VITE_GRAPHQL_HTTP` |
| Webapp WS endpoint                | `VITE_GRAPHQL_WS` from `WEBAPP_VITE_GRAPHQL_WS`     |

For production browser auth, `CORS_ORIGIN` should be the exact Cloudflare Pages
origin or custom frontend domain. Credentialed browser requests cannot safely
use wildcard CORS.

If the backend moves to a custom domain, rebuild the webapp with new GraphQL
HTTP and WS endpoint values. If the frontend moves to a custom domain, redeploy
the backend with the new CORS origin.

## Server-Side Revocation Boundary

Refresh sessions can be revoked in PostgreSQL. Refresh-token reuse after
revocation causes all sessions for that user to be revoked.

Access tokens are signed and short-lived. Once issued, they remain valid until
they expire unless the server adds an active revocation fanout layer. The
current design keeps access tokens short and restarts browser websockets when
local auth state changes.

For future protected subscriptions across multiple browsers, devices, or server
instances, revocation should become server-pushed:

```text
revoke session or user
  -> publish revocation event through Redis
  -> every server instance closes matching websocket connections
```

That is not the same as refresh-token revocation. Refresh-token revocation
prevents future refresh. Websocket revocation would actively close existing
connections that already resolved a principal.

## Design Consequences

This architecture trades a little complexity for safer browser behavior and
more predictable realtime delivery.

The main rules for future work are:

- do not persist access tokens in browser storage
- do not treat the local session hint as authorization
- keep refresh cookie path, GraphQL path, and webapp endpoints aligned
- use shared Relay transport instead of feature-local fetch clients
- use shared realtime connection state instead of feature-local websocket
  clients
- use Redis when subscription events must reach multiple server instances
- use access-control guards/decorators for protected GraphQL operations

The result is a system where auth, HTTP, websocket, and pub/sub decisions are
named and testable instead of being scattered through feature code.

## Navigation

Previous: [Webapp Architecture](05-webapp-architecture.md)

Next: [Rush Delivery Release Model](07-rush-delivery-release-model.md)
