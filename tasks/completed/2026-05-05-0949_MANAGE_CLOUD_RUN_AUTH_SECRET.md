# Manage Cloud Run Auth Secret

## Goal

Make `AUTH_ACCESS_TOKEN_SECRET` a first-class Cloud Run runtime secret managed
by the same deployment preparation path as database and Redis secrets.

The secret must be stable by default. If it already exists in Google Secret
Manager, provisioning should preserve it unless an operator explicitly chooses
rotation.

## Context

Production registration and login require `AUTH_ACCESS_TOKEN_SECRET` so the
server can issue JWT access tokens. The server already requires a value of at
least 32 characters, but the Cloud Run deployment path only syncs and injects
database and Redis secrets.

Changing `AUTH_ACCESS_TOKEN_SECRET` invalidates existing access tokens, so
automatic rotation must be avoided.

## Checklist

- [x] Update the Cloud Run shell secret sync script to manage
      `AUTH_ACCESS_TOKEN_SECRET`.
- [x] Generate a strong auth secret when the Secret Manager entry is missing.
- [x] Preserve an existing auth secret by default.
- [x] Allow explicit rotation through an operator-controlled path.
- [x] Inject `AUTH_ACCESS_TOKEN_SECRET` into the Cloud Run revision.
- [x] Update the typed Cloud Run provider secret sync model.
- [x] Update the guided Cloud Run/Cloudflare/Neon/Upstash scenario.
- [x] Add tests for generation, preservation, and explicit rotation behavior.
- [x] Update deployment docs and AI deployment guidance.
- [x] Run focused validation and Trunk QA.
