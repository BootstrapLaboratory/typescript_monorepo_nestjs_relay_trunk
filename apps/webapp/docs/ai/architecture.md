# Webapp Architecture

`apps/webapp` is the React frontend. It owns browser UI, Relay operations, and
Cloudflare Pages build output.

## Runtime Shape

- Framework: React with Vite.
- Routing: TanStack Router in code-based mode.
- Data layer: Relay over GraphQL HTTP for queries/mutations.
- Realtime: `graphql-ws` subscriptions wired into Relay.
- Auth: shared browser auth state with memory-only access tokens,
  server-managed refresh cookies, and a non-secret first-paint session hint.
- Styling: vanilla-extract tokens and component-local style modules.
- UI primitives: app-owned wrappers in `src/ui`, with Radix UI primitives used
  behind those wrappers when accessible behavior is needed.
- UI workshop: Storybook with the React/Vite framework for isolated reusable
  UI components, plain feature views, and page compositions.
- Published docs: Docusaurus in `apps/docsite`, served under the webapp origin at
  `/docs/` after its build output is copied into `apps/webapp/dist/docs`.
- Contract source: `libs/api/schema.gql`.

The build script intentionally runs Relay codegen before TypeScript and Vite:

```text
relay -> tsc -b -> vite build
```

Generated Relay files under `src/**/__generated__` are compiler output. Do not
hand-edit them.

When Rush builds the deployable `webapp` target, it builds the `docs-site`
Rush dependency first. The webapp build then copies `apps/docsite/build` into
`apps/webapp/dist/docs`. That keeps Docusaurus independent while preserving a
single Cloudflare Pages deploy artifact.

## UI Shape

- `src/main.tsx` only installs global browser recovery and mounts React.
- `src/app/AppProviders.tsx` creates the Relay environment, creates the router,
  and wires top-level providers.
- `src/app/router.tsx` owns the TanStack Router tree and passes the Relay
  environment to route loaders through router context.
- `src/app/AppShell.tsx` owns the persistent navigation shell.
- `src/routes` owns route adapters only. Route files may read route loader data,
  params, or search state and pass them to feature pages. They should not own
  visual page composition, static assets, or page styles.
- `src/features/chat` owns chat queries, mutations, subscriptions, fragments,
  page composition, static assets, and feature styles.
- `src/features/project-info` owns the README-backed info page and markdown
  rendering.
- `src/features/navigation` owns navigation-adjacent pages such as not found.
- `apps/docsite` owns the Docusaurus documentation surface. The TanStack Router
  app should link to `/docs/` or `/docs/tutorial/`, but it should not define
  `/docs/*` routes.
- Feature folders should use consistent internal folders when they grow:
  `pages` for route-facing feature pages, `components` for feature-local
  building blocks, `relay` for feature GraphQL documents, and `assets` for
  feature-owned static files.
- Feature components that depend on Relay, auth stores, realtime stores, or
  route state should keep that dependency in a thin container and expose a
  plain view component for reusable UI composition and isolated rendering.
- Storybook stories should target `src/ui` primitives, plain feature view
  components, and pages that can be composed from view components. Avoid using
  Storybook as the primary home for Relay or router container fixtures.
- `src/shared/graphql` owns browser GraphQL endpoint resolution.
- `src/shared/auth` owns auth session state, boot-time refresh, refresh-token
  transport strategy selection, logout, auth error parsing, and the non-secret
  local session hint used only for first-paint navigation.
- `src/shared/relay` owns Relay environment creation and reusable Relay store
  helpers.
- `src/shared/realtime` owns websocket retry, heartbeat, Cloud Run connection
  termination recovery, and user-visible realtime connection state.
- `src/shared/theme` owns persisted theme selection and applies the active
  theme class to the document root.
- `src/shared/vite` owns Vite preload recovery for stale deployment chunks.
- `src/ui` owns design tokens, styling primitives, and small reusable UI
  components. Feature components should depend on `src/ui` rather than directly
  depending on a styling framework.

Keep top-level provider wiring in `src/app/AppProviders.tsx`. Keep transport
details in `src/shared`. Keep route definitions and route data preloading in
`src/app/router.tsx`. Keep component behavior inside feature folders.

## Routing And Relay

Routes that need Relay data should start the Relay request in the route loader
with `loadQuery` and return the preloaded query reference without awaiting the
network. The route component should render the page shell immediately and put
the data-bound region behind Suspense with `usePreloadedQuery`. This keeps menu
navigation and page switching responsive while data loading remains visible in
the target page.

Dispose preloaded query references from the loader's abort signal when the
route match is no longer active. Routes holding Relay query references should
avoid long-lived router data caches unless they also own the matching Relay
retain/dispose lifecycle.

GraphQL subscriptions must use Relay's subscription network from
`src/shared/relay/environment.ts`. Feature code should call Relay subscription
hooks and must not create its own websocket client. `src/shared/realtime`
centralizes the websocket retry policy, heartbeat timeout, browser offline
tracking, reconnect watchdog, fatal close-code handling, and Cloud Run
persistent-connection termination recovery so every subscription feature gets
the same behavior.

Relay HTTP requests include refresh-cookie credentials and add the current
bearer access token from `src/shared/auth` when one exists. If a GraphQL
response reports an auth-required error, the Relay network performs one shared
refresh attempt and retries the operation. GraphQL WS connection params use the
same access-token source and the shared realtime client restarts the socket when
the token changes so future protected subscriptions do not duplicate auth or
Cloud Run reconnect logic in feature code.

## Browser Auth Security

The current webapp auth setup is optimized for browser security:

- Access tokens live in memory only.
- Refresh tokens are expected to be HttpOnly server cookies.
- Relay HTTP always sends `credentials: "include"` so the server can read the
  refresh cookie for login, refresh, and logout flows.
- Relay HTTP adds `Authorization: Bearer ...` only while an in-memory access
  token exists.
- GraphQL WS connection params add the same bearer token while authenticated.
- The shared realtime client restarts the websocket when the access token
  changes so server-side connection context does not keep an old identity after
  login, logout, or refresh.

`src/shared/auth` also persists a small first-paint session hint in
`localStorage` under `webapp:auth-session-hint`. That hint is intentionally not
an auth credential. It contains only a marker that this browser last had an
authenticated session plus a timestamp; it contains no access token, refresh
token, email, display name, roles, or permissions. Persistent navigation may use
the hint to choose `Logout` on the first paint while boot refresh confirms the
real session. If refresh fails, the hint is cleared and the UI returns to
anonymous state.

Do not treat the local session hint as authorization. Only the in-memory access
token and server-validated refresh cookie establish real authentication.

Security options, from preferred to least preferred for browsers:

- Preferred: HttpOnly refresh cookie plus memory-only access token. This is the
  current webapp design and should remain the default.
- Acceptable UX improvement: persist a non-secret local session hint only. This
  is the current first-paint optimization and does not let JavaScript recover a
  session by itself.
- Usually avoid: persist access tokens in `sessionStorage` or `localStorage`.
  It reduces reload work but exposes bearer tokens to XSS.
- Avoid for browser production unless explicitly required:
  `AUTH_REFRESH_TOKEN_TRANSPORT=response_body` with client-managed refresh
  token storage. This can be right for non-browser clients, but it is weaker for
  browser apps than HttpOnly cookies.

Important webapp environment variables:

- `VITE_GRAPHQL_HTTP`: GraphQL HTTP endpoint used by Relay queries and
  mutations. In production this should be an absolute `https://.../graphql`
  URL, or a same-origin path if the backend is intentionally reverse-proxied
  behind the webapp origin.
- `VITE_GRAPHQL_WS`: GraphQL WS endpoint used by Relay subscriptions. In
  production this should be an absolute `wss://.../graphql` URL, or a
  same-origin websocket path if reverse-proxied.
- `VITE_GRAPHQL_LOG_RECONNECTS`: set to `true` to log realtime reconnect
  behavior in the browser console. It should normally be `false` in production.
- `VITE_GRAPHQL_RECONNECT_WATCHDOG_MS`: timeout for a stuck GraphQL WS
  `connecting` or `retrying` state. Default is `30000`. Set to `0` to disable.
  Local development may use a lower value such as `15000` to recover faster
  after laptop sleep or network changes.

Deployment helpers may expose these as `WEBAPP_VITE_GRAPHQL_HTTP` and
`WEBAPP_VITE_GRAPHQL_WS` before mapping them into the Vite build environment.
Guided production setup may resolve the live Cloud Run service URL and append
`/graphql` when explicit webapp GraphQL URLs are not supplied. Keep these
values aligned with the server `GRAPHQL_PATH`, refresh cookie path, and backend
`CORS_ORIGIN`. For cookie refresh transport, the backend CORS allowlist must
include the exact webapp origin because credentialed browser requests cannot
safely rely on wildcard production CORS.

## Styling Boundary

Use `src/ui/tokens.css.ts` for the vanilla-extract theme contract,
`src/ui/themes.css.ts` for available theme implementations, `src/ui/theme.css.ts`
for global document styles, and vanilla-extract `.css.ts` files for
component-local styles. Reusable controls should be implemented in `src/ui`
first and consumed by features as semantic components such as `Button`,
`TextField`, `SelectField`, `Link`, and `Surface`. This keeps the app resilient
if the styling implementation later moves to CSS Modules, Panda, Tailwind, or
another system.

Add selectable visual themes by extending `THEME_NAMES` and
`themeClassByName` in `src/ui/themes.css.ts`. Every theme must satisfy the same
token contract, so missing token implementations fail TypeScript/build.
Components should consume semantic tokens from `vars` instead of branching on
individual theme names.

## Deployment Boundary

The webapp package artifact is the built `apps/webapp/dist` directory. Rush
Delivery packages it and the Cloudflare Pages deploy script publishes it from
`deploy/cloudflare-pages`.

The artifact includes two static surfaces:

- `/`: the Vite/TanStack browser app
- `/docs/`: the Docusaurus docs site copied from `apps/docsite/build`

Provider-specific deploy behavior should stay under `deploy/cloudflare-pages`,
not inside React components.

`deploy/providers/cloudflare-pages` is the TypeScript provider spike for
Cloudflare Pages production provisioning. It owns Pages project setup only:
ensuring the project exists, setting the production branch, and disabling
Cloudflare Git automatic deployments for Git-integrated projects. It does not
own Wrangler uploads, GitHub repository configuration, or Vite GraphQL endpoint
derivation.
