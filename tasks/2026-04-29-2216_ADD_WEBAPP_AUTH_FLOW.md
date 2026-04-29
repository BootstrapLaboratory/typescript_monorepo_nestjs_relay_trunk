# Add Webapp Auth Flow

## Goal

Implement login, register, and logout in the webapp using the auth contract that already exists in the server app.

The webapp should expose a `Login/Register` entry in the primary header near the `Anonymous Chat` brand link. After a user is authenticated, that entry should become `Logout`; logout should clear the current session and redirect to the home route.

Auth should be implemented as a separate feature, not as part of chat. Chat can later consume auth state, but authentication is shared application infrastructure because it affects Relay requests, GraphQL subscriptions, navigation, and future protected routes.

## Current Server Contract

Primary source of truth:

- [`apps/server/src/modules/identity/auth.resolver.ts`](../apps/server/src/modules/identity/auth.resolver.ts)
- [`apps/server/src/modules/identity/dto/login.input.ts`](../apps/server/src/modules/identity/dto/login.input.ts)
- [`apps/server/src/modules/identity/dto/register.input.ts`](../apps/server/src/modules/identity/dto/register.input.ts)
- [`apps/server/src/modules/identity/dto/refresh.input.ts`](../apps/server/src/modules/identity/dto/refresh.input.ts)
- [`apps/server/src/modules/identity/dto/auth.payload.ts`](../apps/server/src/modules/identity/dto/auth.payload.ts)
- [`apps/server/src/modules/identity/dto/principal.model.ts`](../apps/server/src/modules/identity/dto/principal.model.ts)
- [`apps/server/src/modules/identity/refresh-token-transport.service.ts`](../apps/server/src/modules/identity/refresh-token-transport.service.ts)
- [`apps/server/src/app.module.ts`](../apps/server/src/app.module.ts)
- [`libs/api/schema.gql`](../libs/api/schema.gql)

Available GraphQL mutations:

- `login(input: LoginInput!): AuthPayload!`
- `register(input: RegisterInput!): AuthPayload!`
- `refresh(input?: RefreshInput): AuthPayload!`
- `logout(input?: RefreshInput): Boolean!`
- `logoutAll: Boolean!`

Current auth payload:

- `accessToken`
- `accessTokenExpiresAt`
- `refreshToken`, only present when refresh transport is `response_body`
- `refreshTokenExpiresAt`
- `principal { userId, subject, provider, roles, permissions }`

Important behavior:

- The server default refresh token transport is an HttpOnly cookie.
- Cookie transport requires browser GraphQL requests to use `credentials: "include"`.
- Authenticated HTTP GraphQL requests use `Authorization: Bearer <accessToken>`.
- GraphQL WS can receive the same bearer token through connection params.
- There is no current `me` or `viewer` query; the client can recover a session on app boot by calling `refresh`.

## Decisions

- Implement the default HttpOnly-cookie refresh mode first.
- Shape `shared/auth` around a small refresh-token transport boundary so `response_body` support can be added later without rewriting the auth feature UI or Relay integration.
- Use `/auth?mode=login` and `/auth?mode=register`.
- Make the header `Login/Register` link point to `/auth?mode=login`.
- Use the server `logout` mutation for the header logout button.
- Keep access tokens memory-only.
- Restore the session during app boot by calling `refresh`.
- Do not add `me` or `viewer` in this task; use `refresh` to restore the principal.
- Add `viewer` later when the UI needs richer authenticated account data.

## Reference Checked

The BeltApp reference repo was cloned to `/tmp/beltapp-auth-reference` and reviewed for ideas only.

Useful pattern from that project:

- Auth session is shared infrastructure under `shared/auth`.
- Relay HTTP and GraphQL WS read the access token through that shared auth boundary.
- The login/register UI is a feature page, while token storage and request behavior are not owned by a feature page.
- Navigation renders auth-aware links from the shared session store.

Differences from this project:

- BeltApp stores refresh tokens in local storage because its server contract returns them in the response body.
- This project defaults to an HttpOnly refresh cookie, which should be preferred unless we intentionally support the response-body mode too.
- BeltApp has a different auth payload and schema shape.

## Proposed Webapp Shape

Add shared auth infrastructure:

- `apps/webapp/src/shared/auth/session.ts`
- `apps/webapp/src/shared/auth/auth-api.ts`
- `apps/webapp/src/shared/auth/auth-errors.ts`, if useful
- `apps/webapp/src/shared/auth/auth-boot.ts`, if boot refresh needs a small boundary
- `apps/webapp/src/shared/auth/refresh-token-transport.ts`, or equivalent small strategy boundary

Add auth feature UI:

- `apps/webapp/src/features/auth/pages/AuthPage.tsx`
- `apps/webapp/src/features/auth/components/AuthForm.tsx`
- `apps/webapp/src/features/auth/relay/Login.mutation.ts`
- `apps/webapp/src/features/auth/relay/Register.mutation.ts`
- `apps/webapp/src/features/auth/relay/Refresh.mutation.ts`
- `apps/webapp/src/features/auth/relay/Logout.mutation.ts`

Add route adapter:

- `apps/webapp/src/routes/auth/AuthRoute.tsx`

Update shared request infrastructure:

- [`apps/webapp/src/shared/relay/environment.ts`](../apps/webapp/src/shared/relay/environment.ts)
- [`apps/webapp/src/shared/realtime/realtime-connection.ts`](../apps/webapp/src/shared/realtime/realtime-connection.ts)

Update app shell:

- [`apps/webapp/src/app/AppShell.tsx`](../apps/webapp/src/app/AppShell.tsx)
- [`apps/webapp/src/app/router.tsx`](../apps/webapp/src/app/router.tsx)

## Implementation Checklist

- [ ] Create shared auth session store with `useSyncExternalStore`.
- [ ] Add a refresh-token transport boundary with cookie mode as the only initial implementation.
- [ ] Represent auth state as `unknown`, `anonymous`, or `authenticated` so the header can avoid flicker during boot refresh.
- [ ] Keep access token in memory only.
- [ ] On app boot, call `refresh` once so an HttpOnly refresh cookie can restore the access token.
- [ ] Add auth GraphQL operations for login, register, refresh, and logout.
- [ ] Make auth API write successful `AuthPayload` values into the shared session store.
- [ ] Make Relay HTTP requests send `credentials: "include"`.
- [ ] Make Relay HTTP requests add the bearer token when available.
- [ ] Retry once after an auth-required response by calling `refresh`.
- [ ] Make GraphQL WS connection params include the bearer token when available.
- [ ] Recreate or restart the GraphQL WS connection when the access token changes, without weakening the existing Cloud Run reconnect behavior.
- [ ] Add `/auth?mode=login` and `/auth?mode=register` behavior with a login/register mode switch.
- [ ] Use server field constraints: email, password with minimum 8 characters, optional display name on registration.
- [ ] Add `Login/Register` button next to the `Anonymous Chat` brand area when anonymous, linked to `/auth?mode=login`.
- [ ] Add `Logout` button in the same area when authenticated.
- [ ] On logout, call the server `logout` mutation, clear local auth state, and redirect to `/`.
- [ ] If a user is already authenticated and opens `/auth`, redirect to `/`.
- [ ] Do not add a server `me` or `viewer` query in this task.
- [ ] Run Relay compiler after adding operations.
- [ ] Run webapp typecheck/build.
- [ ] Update webapp architecture docs if the shared auth/realtime architecture changes enough to matter.
