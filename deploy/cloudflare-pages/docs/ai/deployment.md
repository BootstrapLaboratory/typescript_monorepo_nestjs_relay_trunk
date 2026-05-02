# Cloudflare Pages Deployment Guidance

This document tells AI assistants how to guide production preparation and
deployment for the `webapp` target on Cloudflare Pages.

## Scope

Use this document for Cloudflare Pages production setup, webapp deployment,
Cloudflare deployment secrets, Pages project configuration, Vite production
GraphQL endpoints, SPA route validation, and frontend production
troubleshooting.

The provider scripts are the recommended path. They encode the repository's
current deployment decisions and should be preferred before manual setup. Still
explain the manual equivalent when a human needs to understand or repair the
automation.

`deploy/providers/cloudflare-pages` is the active TypeScript provider spike for
Cloudflare Pages production provisioning. It uses Cloudflare's official
TypeScript SDK and can ensure a Pages project exists, set the production branch,
and disable Cloudflare Git automatic deployments for Git-integrated projects.
It does not deploy assets, configure GitHub repository values, or derive
backend GraphQL URLs.

The guided scenario under `deploy/scenarios/cloudrun-cloudflare-neon-upstash`,
run through `deploy/wizard`, now calls that provider after backend runtime
secrets are synced. It prompts for `CLOUDFLARE_ACCOUNT_ID`,
`CLOUDFLARE_API_TOKEN`, and `CLOUDFLARE_PAGES_PROJECT_NAME`; the API token
remains transient and is not written to scenario state. After Pages
provisioning, the scenario configures the GitHub repository variables and
Cloudflare secrets required by the production workflow. For webapp GraphQL
variables, it uses explicit overrides when supplied; otherwise it asks Google
Cloud for the live Cloud Run service URL and appends `/graphql`. A brand-new
environment may need a server-only deploy before that URL exists.

## Deployment Boundary

The Cloudflare Pages deploy target is `webapp`.

Production deployment flow:

1. GitHub Actions runs `.github/workflows/main-workflow.yaml` or
   `.github/workflows/force-deploy-webapp.yaml`.
2. Rush Delivery detects, builds, packages, and deploys the `webapp` target.
3. The webapp artifact is `apps/webapp/dist`.
4. Rush Delivery runs [../../scripts/deploy-webapp.sh](../../scripts/deploy-webapp.sh).
5. The deploy script uploads the built assets with `wrangler pages deploy` and
   validates deployed SPA routes.

Do not describe a local script run as the final production deployment step. The
human-facing deployment trigger is GitHub Actions.

## Recommended Automation Path

This provider reuses the shared deploy config under `deploy/cloudrun/config`.
Start from `deploy/cloudrun/config/.env.example`, copy it to
`deploy/cloudrun/config/.env`, and fill the Cloudflare and webapp values.

For the guided combined flow, run the scenario engine when the human wants a
single resumable CLI path:

```bash
npm --prefix deploy/providers/cloudrun run build
npm --prefix deploy/providers/cloudflare-pages run build
npm --prefix deploy/wizard run cloudrun-cloudflare-neon-upstash
```

1. Create or reuse the Cloudflare Pages project.
   Use a real Pages project, not a Worker project. The current deployment style
   is GitHub Actions plus Wrangler direct upload. A brand-new Direct Upload
   project is valid. An existing Git-integrated Pages project is also valid if
   automatic Cloudflare Git builds are disabled.

2. Fill Cloudflare deploy config.

   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account id.
   - `CLOUDFLARE_API_TOKEN`: token with Cloudflare Pages edit access.
   - `CLOUDFLARE_PAGES_PROJECT_NAME`: Pages project name.
   - `CLOUDFLARE_PAGES_PRODUCTION_BRANCH`: usually `main`.
   - `WEBAPP_VITE_GRAPHQL_HTTP`: deployed backend HTTPS GraphQL endpoint.
   - `WEBAPP_VITE_GRAPHQL_WS`: deployed backend WSS GraphQL endpoint.

3. Disable Cloudflare automatic Git builds when the Pages project is
   Git-integrated.
   Run [../../scripts/disable-automatic-deployments.sh](../../scripts/disable-automatic-deployments.sh).
   The helper disables automatic production deployments, disables preview
   deployments, and verifies the Pages project configuration through the
   Cloudflare API.

4. Configure GitHub repository secrets and variables.
   Run [../../scripts/configure-github-vars.sh](../../scripts/configure-github-vars.sh).
   It sets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub
   secrets, then sets `CLOUDFLARE_PAGES_PROJECT_NAME`,
   `WEBAPP_VITE_GRAPHQL_HTTP`, and `WEBAPP_VITE_GRAPHQL_WS` as GitHub
   variables. If the webapp GraphQL values are empty, the helper can derive
   them from the current Cloud Run service URL.

5. Validate the production build path when needed.
   [../../scripts/build-webapp.sh](../../scripts/build-webapp.sh) requires
   `VITE_GRAPHQL_HTTP` and `VITE_GRAPHQL_WS`, rejects placeholder
   `api.example.com` values, requires `https://` and `wss://` endpoints, runs a
   Rush install unless skipped, and builds the `webapp` project.

6. Deploy through GitHub Actions.
   Push to `main` for the normal full workflow, or manually run
   `force-deploy-webapp` for a targeted frontend deployment.

7. Verify the deployed webapp.
   The deploy script runs [../../scripts/validate-webapp-routes.sh](../../scripts/validate-webapp-routes.sh),
   which validates `/` and `/info` at
   `https://<CLOUDFLARE_PAGES_PROJECT_NAME>.pages.dev`. Also open the deployed
   app in a browser and verify GraphQL HTTP requests and WS subscriptions.

## Manual Equivalent

When the scripts cannot be used, explain the same setup manually.

Cloudflare manual setup:

- Create or select a Cloudflare account.
- Create or reuse a Pages project.
- Use a unique Pages project name. The generated production URL is usually
  `https://<project-name>.pages.dev`.
- If the project is Git-integrated, disable automatic production builds and set
  preview deployments to none. GitHub Actions should be the deploy authority.
- Create a Cloudflare API token with Cloudflare Pages edit access.
- Find the Cloudflare account id.

GitHub manual setup:

- Set repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- Set repository variables `CLOUDFLARE_PAGES_PROJECT_NAME`,
  `WEBAPP_VITE_GRAPHQL_HTTP`, and `WEBAPP_VITE_GRAPHQL_WS`.
- Confirm `.github/workflows/main-workflow.yaml` maps those values into Rush
  Delivery deploy environment values.
- Trigger `main-workflow` by pushing to `main`, or manually run
  `force-deploy-webapp`.

Endpoint manual setup:

- `WEBAPP_VITE_GRAPHQL_HTTP` must be an absolute `https://.../graphql` URL.
- `WEBAPP_VITE_GRAPHQL_WS` must be an absolute `wss://.../graphql` URL.
- Do not use placeholder `api.example.com` values.
- Do not forget the `/graphql` path.
- Keep these values aligned with the backend `GRAPHQL_PATH`.

## Required GitHub Configuration

Cloudflare Pages secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Cloudflare Pages variables:

- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `WEBAPP_VITE_GRAPHQL_HTTP`
- `WEBAPP_VITE_GRAPHQL_WS`

The workflow also constructs:

- `WEBAPP_URL=https://<CLOUDFLARE_PAGES_PROJECT_NAME>.pages.dev`

The Vite build receives:

- `VITE_GRAPHQL_HTTP` from `WEBAPP_VITE_GRAPHQL_HTTP`
- `VITE_GRAPHQL_WS` from `WEBAPP_VITE_GRAPHQL_WS`

## Pages Project Shape

The current production shape is:

- frontend host: Cloudflare Pages
- deployment style: GitHub Actions plus Wrangler Pages deploy
- production branch: `main`
- production URL: generated `*.pages.dev` unless a custom domain is added
- automatic Cloudflare Git production deployments: disabled
- automatic Cloudflare Git preview deployments: disabled
- SPA routing: default Pages SPA fallback behavior, with no custom `_redirects`
  required for the current app

If the human sees Worker-specific fields such as `npx wrangler deploy` as the
primary deployment command, redirect them back to the Pages project flow.

## Cross-Provider Coordination

Cloudflare Pages and Cloud Run settings must agree:

- `WEBAPP_VITE_GRAPHQL_HTTP` must point to the deployed backend
  `https://.../graphql` URL.
- `WEBAPP_VITE_GRAPHQL_WS` must point to the deployed backend
  `wss://.../graphql` URL.
- `CLOUD_RUN_CORS_ORIGIN` must include the deployed webapp origin, usually
  `https://<CLOUDFLARE_PAGES_PROJECT_NAME>.pages.dev`.
- For HttpOnly refresh-cookie auth, the backend CORS allowlist must use the
  exact frontend origin because credentialed browser requests cannot rely on
  wildcard CORS.
- If the frontend moves to a custom domain, update backend CORS and redeploy the
  backend.
- If the backend moves to a custom domain, update frontend GraphQL endpoint
  variables and redeploy the webapp.

## Validation

Before deployment, prefer repository validation when possible:

```bash
npm run rush -- verify
```

For webapp-specific build validation, the production build path must have:

- `VITE_GRAPHQL_HTTP` set to a non-placeholder `https://.../graphql` value.
- `VITE_GRAPHQL_WS` set to a non-placeholder `wss://.../graphql` value.
- Relay artifacts generated as part of the Rush build.
- Final static assets in `apps/webapp/dist`.

After deployment:

- Confirm the Pages deployment is visible in Cloudflare.
- Open `https://<CLOUDFLARE_PAGES_PROJECT_NAME>.pages.dev`.
- Confirm `/` and `/info` return successfully.
- Confirm the app can call GraphQL HTTP.
- Confirm GraphQL WS subscriptions connect and receive messages.
- Confirm login/register works if production auth settings are deployed.

## Common Mistakes

- Creating a Worker project instead of a Pages project.
- Leaving automatic Cloudflare Git builds enabled while GitHub Actions is
  supposed to own production deploys.
- Storing production Vite variables only in the Cloudflare dashboard. In this
  repo, GitHub Actions is the source of truth for production build variables.
- Forgetting `/graphql` in `WEBAPP_VITE_GRAPHQL_HTTP` or
  `WEBAPP_VITE_GRAPHQL_WS`.
- Using `http://` or `ws://` endpoints for production.
- Forgetting to update backend `CLOUD_RUN_CORS_ORIGIN` after the Pages URL or
  custom frontend domain changes.
- Assuming SPA routes require `_redirects` for the current app. The current
  Pages setup relies on default SPA fallback behavior.
