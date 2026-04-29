# Webapp Architecture

`apps/webapp` is the React frontend. It owns browser UI, Relay operations, and
Cloudflare Pages build output.

## Runtime Shape

- Framework: React with Vite.
- Data layer: Relay over GraphQL HTTP for queries/mutations.
- Realtime: `graphql-ws` subscriptions wired into Relay.
- Contract source: `libs/api/schema.gql`.

The build script intentionally runs Relay codegen before TypeScript and Vite:

```text
relay -> tsc -b -> vite build
```

Generated Relay files under `src/**/__generated__` are compiler output. Do not
hand-edit them.

## UI Shape

The current app is intentionally small:

- `components/App.tsx` owns the lightweight client-side route switch.
- `components/chat` owns chat queries, mutations, subscriptions, and Relay store
  updates.
- `components/info` renders the README-backed info page.
- `realtime-connection.ts` owns WebSocket retry, heartbeat, and user-visible
  connection state.

Keep transport and Relay environment wiring in `src/main.tsx`; keep component
behavior inside feature folders.

## Deployment Boundary

The webapp package artifact is the built `apps/webapp/dist` directory. Rush
Delivery packages it and the Cloudflare Pages deploy script publishes it from
`deploy/cloudflare-pages`.

Provider-specific deploy behavior should stay under `deploy/cloudflare-pages`,
not inside React components.
