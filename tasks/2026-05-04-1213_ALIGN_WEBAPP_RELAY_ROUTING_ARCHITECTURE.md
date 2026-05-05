# Align Webapp Relay Routing Architecture

## Context

We reviewed a recommendation to use React Router v7 Data Mode with Relay. The
core architectural split is correct: the router should coordinate URL state,
route matching, route loaders, preloading, code splitting, and route-level
errors, while Relay should own GraphQL documents, the normalized store,
fragments, mutations, subscriptions, pagination, optimistic updates, and
server-state re-rendering.

The current webapp already follows the most important Relay rule: route loaders
start query work before render, and route-facing components read the result with
`usePreloadedQuery`. The current TanStack Router setup also already supports
the necessary external-data pattern: route loaders, route context, preload
behavior, loader abort signals, cache lifetimes, and search-param validation.

Decision for now: do not replace TanStack Router with React Router v7 just for
this recommendation. Keep TanStack Router in code-based mode and align the
webapp around the cleaner route/Relay boundaries. Revisit React Router only if
we later need React Router framework conventions, SSR/framework routing,
stronger built-in route-module ergonomics, or if TanStack creates concrete
friction that cannot be solved with small local helpers.

## What The Recommendation Gets Right

- Route-level Relay queries should be started before rendering.
- Child components should usually read fragments, not run their own top-level
  queries.
- Route loaders should not become GraphQL state managers; they should only
  coordinate preloading and URL-derived variables.
- Relay mutations and subscriptions should update the Relay store instead of
  copying server state into a separate client store.
- List pagination should use Relay connection patterns when the API shape needs
  pagination.
- Route-level code splitting and nested layouts are worth planning before the
  route tree grows.

## What This Webapp Already Does Better

- The Relay network is centralized in `@labkit/webapp-graphql-relay` and wired
  through `src/shared/relay`.
- Browser auth is stronger than the recommendation's sample because access
  tokens are memory-only and refresh tokens are server-managed cookies.
- Relay HTTP requests include credentials and can perform shared auth refresh
  retry behavior.
- GraphQL WS auth is centralized and the realtime client restarts when the
  access token changes.
- The webapp already runs Relay codegen before TypeScript and Vite builds.
- The chat route already uses TanStack route preloading plus Relay
  `usePreloadedQuery`.
- Reusable chat message rendering already uses a Relay fragment.

## Open Risks Or Gaps

- Route query reference disposal is centralized through the TanStack loader
  abort signal. Labkit now has focused disposal tests for abort behavior, but a
  future app-level verification can still prove TanStack route unload/outdated
  loader behavior end to end.
- `createRelayQueryRoute` now attaches the app-owned error UI through TanStack
  route `errorComponent` instead of wrapping route output manually.
- Mutation and subscription orchestration currently lives inside feature
  components. That is acceptable for this small app, but feature hooks will be
  cleaner as the app grows.
- The chat list is a plain root list with a custom append helper. That is fine
  for the demo, but future paginated lists should prefer Relay connections.
- Non-home route code splitting is partial. The info route is lazy; auth is not.
- The operation organization rule should be explicit: GraphQL documents may
  stay under `relay`, while orchestration hooks can live under
  `mutations`/`subscriptions` when they exist.

## Phase 1: Record The Architecture Decision

- [x] Update `apps/webapp/docs/ai/architecture.md` with the explicit
      router/Relay split.
- [x] Document why TanStack Router remains the current router.
- [x] Document clear triggers that would justify a React Router v7 migration
      spike later.
- [x] Keep the decision scoped to `apps/webapp`; do not change repository-level
      architecture unless the router strategy affects shared packages.

## Phase 2: Tighten Route Query Preloading

- [x] Add or update focused tests around `loadRouteQuery` disposal behavior in
      `@labkit/webapp-graphql-relay`.
- [ ] Verify that TanStack route unload/outdated loader aborts dispose Relay
      query refs as expected.
- [ ] Decide whether `createRelayQueryRoute` should expose route options such
      as `loaderDeps`, `shouldReload`, `staleTime`, `pendingComponent`, and
      `errorComponent`.
- [x] Decide whether route-level errors should move from the current wrapper
      boundary into TanStack route `errorComponent`.
- [x] Keep `src/app/router.tsx` free of feature Relay operation imports.

## Phase 3: Clean Feature Relay Operation Boundaries

- [ ] Keep `relay/` as GraphQL-document-only unless a stronger convention is
      chosen.
- [ ] Use `queries`/`mutations`/`subscriptions` folders only for orchestration
      hooks, not just to move document files around.
- [ ] Extract chat add-message mutation orchestration into a feature hook if it
      makes `MessageAddForm` meaningfully simpler.
- [ ] Extract chat message-added subscription orchestration into a feature hook
      if it makes `Chat` meaningfully simpler.
- [ ] Evaluate whether auth login/register mutation orchestration should become
      small feature hooks or remain in `AuthForm`.
- [ ] Prefer spreading component fragments in mutation/subscription payloads
      when the payload should refresh component-owned fields.

## Phase 4: Strengthen Fragment And List Patterns

- [ ] Keep route/root queries shallow and let reusable components declare
      fragments.
- [ ] Avoid adding top-level queries to child components for route-critical
      data.
- [ ] When a real paginated list appears, design the schema and client around
      Relay connections and `usePaginationFragment`.
- [ ] Keep current plain chat-list append behavior unless pagination or richer
      list semantics appear.

## Phase 5: Route Code Splitting And Nesting Readiness

- [ ] Keep the chat root route eagerly loaded unless bundle analysis shows it
      should be split.
- [ ] Consider lazy loading the auth route after the route boundary settles.
- [ ] Keep the info route lazily loaded because it imports the markdown bundle.
- [ ] Define a nested-route example only when a real nested feature exists.
- [ ] Revisit TanStack file-based routing only if route count or route typing
      ergonomics make code-based route composition noisy.

## Phase 6: Validation

- [ ] Run `VITE_GRAPHQL_HTTP=/graphql VITE_GRAPHQL_WS=/graphql npm --prefix apps/webapp run build`.
- [ ] Run `npm run rush -- lint --to webapp`.
- [ ] Run `trunk check -a -y`.
- [ ] Smoke test `npm run dev`: chat loads, auth navigation works, messages
      send, and subscriptions still update the list.

## Source References

- [Relay v20.1 query rendering and render-as-you-fetch guidance](https://relay.dev/docs/guided-tour/rendering/queries/)
- [Relay v20.1 `loadQuery` disposal guidance](https://relay.dev/docs/api-reference/load-query/)
- [Relay v20.1 fragments and `useFragment`](https://relay.dev/docs/guided-tour/rendering/fragments/)
- [Relay v20.1 mutations and store updates](https://relay.dev/docs/guided-tour/updating-data/graphql-mutations/)
- [Relay v20.1 subscriptions](https://relay.dev/docs/guided-tour/updating-data/graphql-subscriptions/)
- [React Router v7.14 Data Mode route objects](https://reactrouter.com/start/data/route-object)
- [TanStack Router external data loading](https://tanstack.com/router/latest/docs/guide/external-data-loading)
- [TanStack Router data loading, loader dependencies, abort signals, and cache lifetime](https://tanstack.com/router/latest/docs/guide/data-loading)
