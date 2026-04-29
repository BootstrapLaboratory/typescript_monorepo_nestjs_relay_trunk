# Add Identity And Access Layer

## Goal

Introduce an extensible server authentication and authorization layer that lets
the application use local credentials in development and switch to external
identity providers by configuration, without changing controllers or GraphQL
resolvers.

## Core Decisions

- Name the feature boundary `identity` for authentication and principal
  resolution.
- Name the access boundary `access-control` for roles, permissions, guards, and
  decorators.
- Keep Passport at the edge for strategy plumbing where it fits, but normalize
  all authenticated users into an internal `Principal` contract.
- Prefer OIDC as the external provider abstraction for providers such as
  Keycloak and Google.
- Keep application roles and permissions internal; map external provider claims
  or groups into those internal roles.
- Support GraphQL queries, mutations, and `graphql-ws` subscriptions through the
  same principal model.
- Support sessions immediately: issue short-lived access tokens plus
  server-stored refresh sessions with hashed refresh tokens, rotation, expiry,
  and revocation.
- Keep token/session creation, rotation, revocation, and principal resolution
  protocol-agnostic; put HTTP, GraphQL, and subscription-specific behavior in
  thin transport adapters.

## Transport Contract

- Core identity services return protocol-neutral authentication results.
- GraphQL mutations expose login, refresh, logout, and logout-all first.
- Future REST endpoints should call the same core services and only adapt HTTP
  request/response details.
- Refresh token transport should be configurable:
  `AUTH_REFRESH_TOKEN_TRANSPORT=cookie` for browser clients or
  `AUTH_REFRESH_TOKEN_TRANSPORT=response_body` for non-browser clients.
- Cookie transport sets/clears refresh tokens through the request/response
  boundary using `HttpOnly`, `Secure`, `SameSite`, path, max-age, and CORS
  credential settings.
- Response-body transport returns refresh tokens explicitly and accepts refresh
  tokens as mutation/input payloads.
- GraphQL subscriptions authenticate with access tokens from
  `graphql-ws` connection params and do not receive refresh tokens over the
  websocket connection.

## Principal Contract

```ts
type Principal = {
  userId: string;
  subject: string;
  provider: string;
  roles: string[];
  permissions: string[];
};
```

## Checklist

- [ ] Review current server module boundaries in `apps/server/src`.
- [ ] Add dependencies for the selected first implementation path.
- [ ] Design `IdentityProvider` and `Principal` interfaces.
- [ ] Create `IdentityModule` under `apps/server/src/modules/identity`.
- [ ] Create `AccessControlModule` under
      `apps/server/src/modules/access-control`.
- [ ] Add local user and role database entities.
- [ ] Add migrations for local identity tables.
- [ ] Add local username/password provider with hashed passwords.
- [ ] Add token service for application access tokens.
- [ ] Add refresh session entity with hashed refresh tokens.
- [ ] Add login mutation that returns access and refresh tokens.
- [ ] Add refresh mutation that rotates refresh tokens.
- [ ] Add logout mutation that revokes the current refresh session.
- [ ] Add logout-all mutation that revokes all sessions for the current user.
- [ ] Add refresh-token transport abstraction for cookie and response-body
      modes.
- [ ] Add GraphQL auth resolver as the first protocol adapter over core
      identity services.
- [ ] Add GraphQL-aware authentication guard.
- [ ] Add subscription authentication through `graphql-ws` connection params.
- [ ] Add `@CurrentPrincipal()` decorator.
- [ ] Add `@Public()` decorator.
- [ ] Add `@Roles()` decorator and role guard.
- [ ] Add configuration for provider selection, for example
      `AUTH_PROVIDER=local` or `AUTH_PROVIDER=oidc`.
- [ ] Protect existing GraphQL operations intentionally, leaving explicit public
      operations public.
- [ ] Add unit tests for provider selection and token validation.
- [ ] Add resolver/controller guard tests.
- [ ] Add subscription authentication tests or validation coverage.
- [ ] Update server architecture documentation if the module shape or runtime
      auth behavior changes.
- [ ] Add follow-up task for OIDC provider integration if not completed in the
      first implementation pass.

## Notes

- Local provider should be useful for development and simple deployments, but it
  should not leak provider-specific assumptions into business resolvers.
- OIDC, LDAP, and other future providers should adapt into the same `Principal`
  shape.
- Role checks should use internal roles, not raw external provider claim names.
- Refresh tokens should be opaque, stored only as hashes, and rotated on use.
- GraphQL subscriptions authenticate with the current access token; clients can
  refresh separately and reconnect when the access token changes or expires.
- Cookies are a server-owned transport concern even when the webapp decides how
  to trigger refresh on page reload.
