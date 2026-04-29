# Modularize Webapp Router And UI

## Goal

Refactor `apps/webapp` from sample-app component layout into explicit
application, route, feature, and UI boundaries while preserving Relay
preloading and instant route transitions.

## Checklist

- [x] Add TanStack Router, vanilla-extract, and Radix Slot dependencies.
- [x] Replace the custom client-side router with a TanStack Router tree.
- [x] Introduce `src/ui` tokens and reusable primitives.
- [x] Move chat domain code from `src/components/chat` to `src/features/chat`.
- [x] Move route-owned page composition under `src/routes`.
- [x] Move the not-found route into `src/routes/not-found`.
- [x] Remove the old catch-all `src/components` feature layout.
- [x] Update webapp architecture docs for the modular shape.
- [x] Run Relay, lint, TypeScript, and Vite build verification.
