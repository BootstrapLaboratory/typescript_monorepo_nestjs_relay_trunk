# Configure Cloud Run Refresh Cookie Environment

## Goal

Make production browser session restore explicit in the deployment path by
passing refresh-cookie runtime settings from GitHub repository variables through
Rush Delivery into Cloud Run.

The current generated-domain topology uses Cloudflare Pages and Cloud Run on
different sites, so refresh cookies need `SameSite=None` plus `Secure=true`.
When the webapp and API later move under one registrable domain, switch back to
the more restrictive `SameSite=Lax` or `SameSite=Strict` policy after testing
the browser flow.

## Phase 1: CI And Deploy Passthrough

- [x] Add server auth refresh-cookie variables to GitHub Actions deploy env.
- [x] Add those variables to Rush Delivery server deploy target passthrough and dry-run defaults.
- [x] Map repository-scoped `SERVER_AUTH_*` variables to Cloud Run runtime `AUTH_*` variables in the deploy script.
- [x] Document the required GitHub variables and the generated-domain vs custom-domain cookie policy.
- [x] Run focused validation for the changed YAML, shell, and docs.

## Phase 2: Preparation Automation

- [ ] Extend `deploy/scenarios/cloudrun-cloudflare-neon-upstash` so the guided flow writes the server refresh-cookie GitHub variables.
- [ ] Update `deploy/cloudrun/scripts/configure-github-vars.sh` to set the same variables from local deploy config.
- [ ] Add or update tests for the guided scenario and GitHub variable helper.
- [ ] Document the Phase 2 preparation flow in the provider runbooks.

## Proposed GitHub Repository Variables

- `SERVER_AUTH_REFRESH_TOKEN_TRANSPORT=cookie`
- `SERVER_AUTH_REFRESH_COOKIE_SECURE=true`
- `SERVER_AUTH_REFRESH_COOKIE_SAME_SITE=none` for generated `pages.dev` to `run.app` deployments
- `SERVER_AUTH_REFRESH_COOKIE_PATH=/graphql`

For a same-site custom-domain deployment, keep cookie transport and secure
cookies, but prefer:

- `SERVER_AUTH_REFRESH_COOKIE_SAME_SITE=lax`

Use `strict` only after validating the intended browser navigation and auth
flows.
