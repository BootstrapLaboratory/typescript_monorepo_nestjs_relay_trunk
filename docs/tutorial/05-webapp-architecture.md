# Webapp Architecture

`apps/webapp` is the browser application. It owns UI composition, routes, Relay
operations, browser auth state, realtime connection behavior, design tokens,
and the static Vite build output that Cloudflare Pages serves.

The webapp is deliberately not a thin pile of components. It has its own
runtime boundaries because browser code has real responsibilities: route
preloading, GraphQL transport, auth refresh, websocket recovery, theme state,
and deployment-time endpoint configuration.

## Runtime Stack

The frontend stack is:

- React for UI
- Vite for development and production builds
- Relay for GraphQL queries, mutations, fragments, and subscriptions
- TanStack Router for code-defined routing and route loaders
- `graphql-ws` through the shared Relay network for subscriptions
- vanilla-extract for typed design tokens and component-local styles
- Storybook for isolated reusable UI and plain feature views
- Docusaurus as a separate Rush project for `/docs/`

The key design choice is that the webapp treats GraphQL as a compiled client
contract. Relay operations are checked against `libs/api/schema.gql`, and
generated operation artifacts live beside the feature code that uses them.

## Top-Level Application Shape

The root app is intentionally small:

```text
src/main.tsx
  -> install global Vite preload recovery
  -> mount React
  -> render AppProviders
```

`AppProviders` creates the Relay environment, creates the TanStack router,
applies the active theme class, and starts auth session bootstrap. It is the
place for top-level browser providers, not a place for feature UI.

`AppShell` owns the persistent navigation frame: brand link, auth navigation,
theme picker, route outlet, and suspense fallback. Feature pages render inside
that shell.

This gives the app a clean split:

| Layer                      | Owns                                                                  |
| -------------------------- | --------------------------------------------------------------------- |
| `src/main.tsx`             | browser mount and global recovery hooks                               |
| `src/app/AppProviders.tsx` | top-level providers and boot-time effects                             |
| `src/app/router.tsx`       | route tree, route loaders, router context                             |
| `src/app/AppShell.tsx`     | persistent navigation shell                                           |
| `src/routes`               | route adapters only                                                   |
| `src/features`             | page composition, feature components, Relay documents, feature assets |
| `src/shared`               | reusable browser transport and state modules                          |
| `src/ui`                   | design tokens and reusable controls                                   |

## Routes Stay Thin

Route files should adapt router data into feature pages. They should not own
visual composition, GraphQL documents, static assets, or feature styling.

The chat route shows the pattern:

1. `src/app/router.tsx` defines `/` and starts the Relay query in the route
   loader with `loadQuery`.
2. The loader returns a preloaded query reference immediately.
3. `src/routes/chat/ChatRouteAdapter.tsx` reads loader data.
4. `src/routes/chat/ChatRoute.tsx` passes the query reference into the chat
   feature page behind `Suspense`.
5. `src/features/chat` owns the actual chat composition.

This lets navigation switch routes before data has finished loading. The target
page can show a local loading state while Relay resolves the query.

The route loader also disposes the preloaded query reference when the route is
aborted. That lifecycle belongs in the route layer because it is tied to router
ownership, not to a specific chat component.

The `/docs/*` path is intentionally not part of the TanStack Router tree.
Docusaurus owns that static route space. The webapp uses an environment-backed
tutorial URL so local development can point to the Docusaurus live preview
while production points to the same-origin `/docs/tutorial/` route. Route files
should not try to render Docusaurus content inside the Vite app.

## Feature Folders Own Product Composition

Feature folders are where product behavior becomes visible UI.

The current feature shape is:

| Feature        | Owns                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `auth`         | auth page, auth form, login/register Relay mutations, auth mode parsing                           |
| `chat`         | chat page, message list, composer, message fragments, query, mutation, subscription, stack assets |
| `project-info` | README-backed info page and Markdown rendering                                                    |
| `navigation`   | navigation-adjacent pages such as not found                                                       |

Feature folders use recurring internal folders when they need them:

```text
components/
pages/
relay/
assets/
```

That pattern keeps related behavior together without making every feature
identical. A feature gets the folders it needs.

Feature containers can depend on Relay, auth state, realtime state, or router
state. Plain view components stay easier to render in Storybook because they
receive already-shaped props.

## Relay As The Data Boundary

Relay is the frontend's data layer. The webapp does not call arbitrary GraphQL
helpers from components. GraphQL operations live in feature `relay` folders, and
Relay-generated files live under `__generated__`.

The browser app build script runs:

```text
relay -> tsc -b -> vite build
```

That ordering matters. Relay validates operations against the committed schema
before TypeScript and Vite finish the app build.

For the deployable `webapp` target, Rush follows the documentation chain
`docs -> docs-site -> webapp`. After Vite finishes, the webapp build copies
`apps/docsite/build` into `apps/webapp/dist/docs`. That gives Cloudflare Pages
one upload directory while keeping docs content, the docs generator, and the
browser app independent.

The Relay environment lives in `src/shared/relay/environment.ts`. It defines
one network layer for:

- GraphQL HTTP queries and mutations
- GraphQL WS subscriptions
- bearer access-token headers when an access token exists
- refresh-cookie credentials for browser refresh flow
- one shared refresh-and-retry path for auth-required GraphQL responses

This keeps transport policy out of feature components. A chat component can use
Relay hooks without knowing how refresh cookies, access tokens, or websocket
connection params are wired.

## Realtime Is Shared Infrastructure

GraphQL subscriptions use the same Relay environment. Feature code calls Relay
subscription hooks; it does not create a separate websocket client.

`src/shared/realtime` centralizes browser online tracking, retry state,
heartbeat behavior, reconnect watchdog behavior, and Cloud Run persistent
connection recovery. The chat feature consumes the resulting connection state
to disable sends while live updates are recovering and to show a user-facing
connection message.

That design prevents every subscription feature from inventing its own retry
policy. New realtime features should reuse the shared subscription network and
connection state.

## Shared Browser Modules

The `src/shared` folder owns browser behavior that is not a single feature:

| Shared area | Owns                                                                           |
| ----------- | ------------------------------------------------------------------------------ |
| `auth`      | auth session state, boot refresh, logout, refresh-token transport, auth errors |
| `graphql`   | endpoint resolution for HTTP and WS URLs                                       |
| `relay`     | Relay environment and store helpers                                            |
| `realtime`  | websocket retry and status state                                               |
| `theme`     | persisted theme selection and document theme class                             |
| `vite`      | stale chunk preload recovery                                                   |

The rule is practical: if a behavior affects multiple features or the whole
browser runtime, put it in `src/shared`. If it is product-specific to one
feature, keep it in that feature folder.

## UI And Styling Boundary

Reusable controls live in `src/ui`: buttons, links, select fields, surfaces,
status states, class-name helpers, tokens, themes, and global theme CSS.

Styles use vanilla-extract. The token contract in `tokens.css.ts` defines the
shape every theme must satisfy. `themes.css.ts` provides the current light and
dark theme implementations.

Feature styles can use component-local `.css.ts` files, but they should consume
semantic tokens from `src/ui`. That keeps a future styling change from being a
feature-by-feature rewrite.

Storybook targets reusable UI components, plain feature views, and page
compositions that can be rendered without a live router or Relay server. That
is why feature containers and plain view components are separated where useful.

## Build-Time Endpoint Configuration

The browser bundle needs GraphQL endpoint values at build time:

- `VITE_GRAPHQL_HTTP`
- `VITE_GRAPHQL_WS`
- `VITE_DOCS_TUTORIAL_URL`

Vite embeds these values into the built app. In production, the repository uses
deployment-facing variable names:

- `WEBAPP_VITE_GRAPHQL_HTTP`
- `WEBAPP_VITE_GRAPHQL_WS`

Rush Delivery package metadata maps those deployment variables into Vite
variables for the build phase. The deploy phase still uses the `WEBAPP_*`
values for validation and handoff, but it does not require the build-only
`VITE_*` names.

That distinction matters because frontend endpoint values are build-time
inputs, not runtime secrets. They must be present when the static assets are
built; changing them later requires rebuilding the webapp. In local
development, `VITE_DOCS_TUTORIAL_URL` points to the Docusaurus dev server. In
production, it points to `/docs/tutorial/` inside the same Cloudflare Pages
artifact.

## Deployment Boundary

The webapp package artifact is:

```text
apps/webapp/dist
```

Rush Delivery packages that directory, and the Cloudflare Pages deploy script
uploads it. React components do not know about Wrangler, Cloudflare accounts,
Pages project settings, or GitHub repository variables.

The directory contains both the Vite app at `/` and Docusaurus at `/docs/`.
This is artifact composition, not runtime integration. TanStack Router remains
responsible for the application routes, and Docusaurus remains responsible for
the documentation routes.

Provider-specific Pages setup belongs under `deploy/cloudflare-pages` and
`deploy/providers/cloudflare-pages`. The webapp's job is to build correct
static assets from explicit inputs.

## Design Consequences

The webapp architecture favors explicit browser infrastructure:

- routes own route lifecycle and loader data
- features own product UI and GraphQL documents
- Relay owns data access
- shared modules own transport, auth, realtime, theme, and Vite recovery
- `src/ui` owns reusable visual primitives
- `docs-site` owns documentation rendering and docs navigation
- deployment metadata owns build-time endpoint mapping

The upside is that adding a feature has a clear path. Put the product behavior
under `src/features`, add Relay operations beside it, use `src/shared` for
cross-feature browser policy, and use `src/ui` for reusable controls.

## Navigation

Previous: [Server Architecture](04-server-architecture.md)

Next: [Auth, Realtime, And Browser Security](06-auth-realtime-and-browser-security.md)
