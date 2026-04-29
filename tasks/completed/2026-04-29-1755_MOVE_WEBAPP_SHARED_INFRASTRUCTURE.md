# Move Webapp Shared Infrastructure

## Goal

Refactor `apps/webapp` toward the mature provider/shared-infrastructure shape
used by Beltapp while preserving TanStack Router, Relay route preloading,
vanilla-extract UI boundaries, and GraphQL websocket reconnection behavior.

## Checklist

- [x] Add `src/app/AppProviders.tsx` so `main.tsx` only boots React and global recovery.
- [x] Move GraphQL endpoint resolution into `src/shared/graphql`.
- [x] Move Relay environment/network creation into `src/shared/relay`.
- [x] Move websocket retry, heartbeat, and connection-state code into `src/shared/realtime`.
- [x] Move Vite preload recovery into `src/shared/vite`.
- [x] Move route page UI/CSS/assets out of `src/routes` and into feature folders.
- [x] Keep `src/routes` limited to route adapters/boundaries.
- [x] Update webapp architecture docs for the new provider/shared shape.
- [x] Run Relay, lint, TypeScript, and Vite build verification.
