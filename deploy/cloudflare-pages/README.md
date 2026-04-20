# Cloudflare Pages Frontend Deployment

This guide wires the repo for the chosen frontend host:

- frontend host: `Cloudflare Pages`
- deployment style: `GitHub Actions + Wrangler Pages deploy`
- initial frontend URL: generated `*.pages.dev`
- initial backend URL used by the frontend: generated Cloud Run `run.app` URL

It is written for this monorepo, where the frontend lives in [apps/webapp](../../apps/webapp).

For the manual Cloudflare dashboard steps, also see:

- [CLOUDFLARE_GUIDE.md](docs/CLOUDFLARE_GUIDE.md)

Helper scripts:

- [build-webapp.sh](scripts/build-webapp.sh)
- [configure-github-vars.sh](scripts/configure-github-vars.sh)
- [disable-automatic-deployments.sh](scripts/disable-automatic-deployments.sh)
- [load-env.sh](scripts/load-env.sh)

## Repo-Side Build Command

GitHub Actions should use this repo-root build command before uploading static
assets to Cloudflare Pages:

```bash
npm run webapp:build:pages
```

That script:

- validates the required production API env vars are present
- refuses to build if the placeholder `api.example.com` URLs are still in use
- bootstraps Rush dependencies from the monorepo root
- generates GraphQL SDL from the backend source and Relay artifacts for the webapp
- builds the web app from the monorepo root

The script lives at:

- [build-webapp.sh](scripts/build-webapp.sh)

The deployment workflow that uses this build output lives at:

- [deploy-cloudflare-pages-webapp.yaml](../../.github/workflows/deploy-cloudflare-pages-webapp.yaml)

## Required GitHub Repository Configuration

Prefer using the helper script to set these in GitHub from the shared deploy
config:

```bash
bash deploy/cloudflare-pages/scripts/configure-github-vars.sh
```

That helper loads values from [../cloudrun/config/.env](../cloudrun/config/.env)
and [../cloudrun/config/.env.local](../cloudrun/config/.env.local) if present.

Set these GitHub repository secrets for the deploy workflow:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Set these GitHub repository variables for the deploy workflow:

- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `WEBAPP_VITE_GRAPHQL_HTTP`
- `WEBAPP_VITE_GRAPHQL_WS`

Recommended value shape:

```dotenv
WEBAPP_VITE_GRAPHQL_HTTP=https://<cloud-run-service>.run.app/graphql
WEBAPP_VITE_GRAPHQL_WS=wss://<cloud-run-service>.run.app/graphql
```

Important:

- the workflow maps `WEBAPP_VITE_GRAPHQL_HTTP` to the build-time `VITE_GRAPHQL_HTTP`
- the workflow maps `WEBAPP_VITE_GRAPHQL_WS` to the build-time `VITE_GRAPHQL_WS`
- the old Cloudflare Pages dashboard build environment variables are no longer the source of truth for production deploys
- if `WEBAPP_VITE_GRAPHQL_HTTP` and `WEBAPP_VITE_GRAPHQL_WS` are left empty in the shared deploy config, the helper derives them from the current deployed Cloud Run service URL

## Required Cloudflare Pages Project Shape

This repo now expects one existing Pages project that receives uploaded static
assets from GitHub Actions.

Keep or create one Pages project for the frontend with:

Recommended project shape:

- project name: a unique frontend name such as `poltapp-webapp`
- production branch: `main`
- automatic production Git deployments: `disabled`
- automatic preview Git deployments: `disabled`
- current preview strategy: `No previews`

If you already created this Pages project with Git integration, keep it and
disable the automatic production/preview builds. Cloudflare documents this as a
supported migration path for Git-integrated Pages projects that want Wrangler
deploys instead of Git-triggered builds.

This repo includes a helper for that:

```bash
bash deploy/cloudflare-pages/scripts/disable-automatic-deployments.sh
```

That helper uses the same shared deploy config as
[configure-github-vars.sh](scripts/configure-github-vars.sh).
For Git-integrated Pages projects, it updates and verifies the project's
`source.config` deployment controls.

The manual dashboard equivalent is documented in
[CLOUDFLARE_GUIDE.md](docs/CLOUDFLARE_GUIDE.md).

## SPA Routing

This app is a client-side React SPA.

Cloudflare Pages' default serving behavior already treats projects without a
top-level `404.html` as SPAs and routes unknown paths to `/`, so no custom
`_redirects` file is required for the initial rollout.

## Monorepo Notes

GitHub Actions now owns the build, but the same repo-root monorepo build rules
still apply:

- Rush installs from repo root
- GraphQL SDL and Relay artifacts are generated during the build
- the final upload target is `apps/webapp/dist`

If you previously configured a Cloudflare build command and output directory,
they are no longer used after automatic Pages Git builds are disabled.

## After The First Deploy

Once the GitHub Actions workflow deploys successfully, Cloudflare Pages will
serve the uploaded static assets at a stable production URL in this shape:

```text
https://<project-name>.pages.dev
```

Use that generated `*.pages.dev` URL first. Custom domains such as
`app.example.com` can be added later.

Where to find it in Cloudflare:

- `Workers & Pages` -> your Pages project -> `Deployments`
- open the latest production deployment and use the provided production URL
- Cloudflare's Pages docs also note that the project name is assigned as the `*.pages.dev` subdomain

## Optional For Adopters With Their Own Domain

This example project intentionally uses the generated `*.pages.dev` URL.

If you adopt this stack for a real project and own a frontend domain such as
`app.example.com`, use this follow-up checklist:

- add the custom frontend domain in Cloudflare Pages
- if the frontend origin changes, update the backend `CLOUD_RUN_CORS_ORIGIN`
- if the backend also moves to a custom domain, update `WEBAPP_VITE_GRAPHQL_HTTP` and `WEBAPP_VITE_GRAPHQL_WS`
- redeploy the frontend after those env-var changes
- re-check normal page load, GraphQL requests, and live subscriptions from the deployed site

## References

- Cloudflare Pages direct upload:
  [https://developers.cloudflare.com/pages/get-started/direct-upload/](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- Cloudflare Pages direct upload with GitHub Actions:
  [https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- Cloudflare Pages Git integration and disabling automatic deployments:
  [https://developers.cloudflare.com/pages/configuration/git-integration/](https://developers.cloudflare.com/pages/configuration/git-integration/)
- Cloudflare Pages branch deployment controls:
  [https://developers.cloudflare.com/pages/configuration/branch-build-controls/](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
- Cloudflare Pages serving behavior for SPAs:
  [https://developers.cloudflare.com/pages/configuration/serving-pages/](https://developers.cloudflare.com/pages/configuration/serving-pages/)
