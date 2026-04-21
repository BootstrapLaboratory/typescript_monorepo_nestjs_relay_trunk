# Cloudflare Guide

This guide covers the manual Cloudflare steps for the frontend deployment.

It is the Cloudflare-side companion to:

- [README.md](../README.md)
- [../cloudrun/PROVISIONING.md](../../cloudrun/docs/PROVISIONING.md)

This guide is for the exact frontend stack chosen for this repo:

- frontend host: `Cloudflare Pages`
- deployment style: `GitHub Actions + Wrangler Pages deploy`
- initial frontend URL: generated `*.pages.dev`
- initial backend URL: generated Cloud Run `run.app` URL

## Important UI Note

Cloudflare currently has two similar but different setup styles in the
dashboard:

- `Pages` projects, which can be Git-integrated or Direct Upload
- `Worker` projects with `Workers Builds`

This guide is written for the `Pages` project flow.

If you see fields such as:

- `Deploy command`
- `Non-production branch deploy command`
- `API token`
- default commands like `npx wrangler deploy`

then you are in the `Worker project / Workers Builds` flow, not the `Pages`
flow used by this migration plan.

What to do:

1. Go back.
2. In `Workers & Pages` -> `Create application`, select `Pages`.
3. Choose the Pages project type that matches your migration path:
   - `Import an existing Git repository` if you are keeping the existing Git-integrated project and only disabling automatic builds
   - `Direct Upload` if you are creating a brand-new Pages project specifically for Wrangler uploads
4. Continue with the Pages-specific settings from this guide.

Why this matters:

- this repo deploys to a Cloudflare `Pages` project
- the Worker flow is a different product
- the Pages rollout in this migration expects a generated `*.pages.dev`
  hostname, while the Worker flow is oriented around `*.workers.dev`

## What The Repo Already Provides

The repo-side build and deploy wiring is already done.

GitHub Actions now:

- builds the webapp with `npm run webapp:build:pages`
- uploads `apps/webapp/dist` with `wrangler pages deploy`

Those settings are documented in:

- [README.md](../README.md)

## Values To Have Ready

Before clicking through Cloudflare, have these ready:

- your GitHub repository connected to this codebase, if your Pages project already uses Git integration
- your deployed backend Cloud Run URL
- your shared deploy config in [../../cloudrun/config/.env](../../cloudrun/config/.env)

For this repo, the frontend must use absolute production API URLs.

## 1. Create A Cloudflare Account

If you do not already have one:

1. Go to the Cloudflare sign-up page.
2. Enter your email and password.
3. Create the account.
4. Verify your email address when Cloudflare sends the verification email.

Optional but helpful:

1. Open the account configuration page.
2. Rename the account to something recognizable if the default name is too generic.

You do **not** need to add a custom domain yet for this rollout.

The first deployment will use the generated `*.pages.dev` hostname.

## 2. Create Or Reuse The Pages Project

This repo deploys prebuilt assets with Wrangler, so Cloudflare only needs one
Pages project to host the site.

You can use either of these starting points:

- an existing Git-integrated Pages project
- a new Direct Upload Pages project

For this repository's current migration path, the most likely case is that you
already have a Git-integrated Pages project and want to keep it while disabling
automatic builds.

Use these values for the project:

- project name: a unique frontend project name such as `poltapp-webapp`
- production branch: `main`

Notes:

- the project name becomes the base for the generated `*.pages.dev` hostname
- Cloudflare's Pages docs note that the `Project name` value is assigned as your `*.pages.dev` subdomain

If you are creating a brand-new project and already know that GitHub Actions
will be your only build authority, a Direct Upload project is also a valid
choice. This guide keeps focusing on the existing Git-integrated project path,
because that is the live migration shape for this repo.

## 3. Disable Automatic Git Builds

If your Pages project is Git-integrated, disable both automatic production and
preview builds.

Dashboard path:

- `Workers & Pages`
- your Pages project
- `Settings`
- `Builds & deployments`
- `Branch control`

Set:

- `Enable automatic production branch deployments`: `off`
- `Preview branch`: `None`

Cloudflare documents this as the supported way to stop Git-triggered Pages
builds and switch to Wrangler deployments for an existing Git-integrated
project.

Optional helper script:

```bash
bash deploy/cloudflare-pages/scripts/disable-automatic-deployments.sh
```

The helper calls the Pages project update API with:

- `source.config.deployments_enabled=false`
- `source.config.production_deployments_enabled=false`
- `source.config.preview_deployment_setting=none`

## 4. Generate A Cloudflare API Token

Cloudflare's CI guide recommends an API token with:

- permission group: `Account`
- resource: `Cloudflare Pages`
- access level: `Edit`

Save the token value as the GitHub repository secret:

- `CLOUDFLARE_API_TOKEN`

If you keep using the shared deploy config, also place it in
[../../cloudrun/config/.env](../../cloudrun/config/.env) so the helper scripts
can reuse it.

## 5. Get Your Cloudflare Account ID

Find your Cloudflare account ID in the dashboard and save it as the GitHub
repository secret:

- `CLOUDFLARE_ACCOUNT_ID`

If you keep using the shared deploy config, also place it in
[../../cloudrun/config/.env](../../cloudrun/config/.env).

## 6. Configure GitHub Repository Variables

Preferred path:

```bash
bash deploy/cloudflare-pages/scripts/configure-github-vars.sh
```

That helper:

- loads Cloudflare values from [../../cloudrun/config/.env](../../cloudrun/config/.env)
- sets the Cloudflare GitHub Actions secrets
- sets the Cloudflare Pages project name variable
- derives `WEBAPP_VITE_GRAPHQL_HTTP` and `WEBAPP_VITE_GRAPHQL_WS` from the live Cloud Run service if you did not set explicit overrides in the shared config

Manual GitHub UI equivalent:

```dotenv
CLOUDFLARE_PAGES_PROJECT_NAME=<your-pages-project-name>
WEBAPP_VITE_GRAPHQL_HTTP=https://<cloud-run-service>.run.app/graphql
WEBAPP_VITE_GRAPHQL_WS=wss://<cloud-run-service>.run.app/graphql
```

Important:

- `WEBAPP_VITE_GRAPHQL_HTTP` must be an absolute `https://` URL
- `WEBAPP_VITE_GRAPHQL_WS` must be an absolute `wss://` URL
- do not use the placeholder `api.example.com` values from [../../../apps/webapp/.env.production](../../../apps/webapp/.env.production)
- do not forget to append `/graphql`

If your real backend URL is currently:

```text
https://api-32lgreeilq-ez.a.run.app/
```

then the exact GitHub variables are:

```dotenv
WEBAPP_VITE_GRAPHQL_HTTP=https://api-32lgreeilq-ez.a.run.app/graphql
WEBAPP_VITE_GRAPHQL_WS=wss://api-32lgreeilq-ez.a.run.app/graphql
```

These values are consumed by:

- [ci-release.yaml](../../../.github/workflows/ci-release.yaml)

The workflow maps them to the build-time `VITE_*` environment variables before
running the repo build helper.

## 7. Trigger The First Frontend Deploy

Steps:

1. Open GitHub Actions.
2. Run `deploy-webapp`, or push a change to `main` that affects the `webapp` Rush project.
3. Wait for the build and `wrangler pages deploy` upload to complete.
4. Open the generated production URL.

Expected production URL shape:

```text
https://<project-name>.pages.dev
```

This generated `*.pages.dev` URL is the correct first production frontend URL for this migration.

Where to find it in the dashboard:

1. Open `Workers & Pages`.
2. Select your Pages project.
3. Open `Deployments`.
4. Open the latest production deployment.
5. Use the production URL shown there.

In many cases, if your project name is `beltapp`, the URL will be:

```text
https://beltapp.pages.dev
```

But the dashboard deployment link is the safest source of truth.

## 8. Update Backend CORS After The First Pages Deploy

Once Cloudflare gives you the real `*.pages.dev` URL, update the backend CORS allowlist.

Why this matters:

- the backend currently enforces `CORS_ORIGIN`
- the frontend is now on a different origin than the backend

For this repo, the backend supports a comma-separated `CORS_ORIGIN` list.

Practical next step:

1. Go to your GitHub repository variables.
2. Update `CLOUD_RUN_CORS_ORIGIN` to the real Pages origin.
3. If you still want local frontend testing against the deployed backend, you can temporarily keep both:

```text
http://localhost:5173,https://<project-name>.pages.dev
```

4. Trigger the backend deploy workflow again so Cloud Run picks up the new CORS value.

## 9. Validate The Frontend

After the Pages deploy finishes:

1. Open the `*.pages.dev` URL.
2. Confirm the app loads.
3. Confirm the frontend can fetch messages from the backend.
4. Confirm sending a new message works.
5. Confirm subscriptions connect and receive new messages.

Notes:

- the deploy workflow already validates `/` and `/info` against the live `*.pages.dev` URL after upload
- Cloudflare Pages already supports SPA serving behavior by default for projects without a top-level `404.html`, so no custom `_redirects` file is required for this app right now.
- If the UI loads but API calls fail, first check:
  - `WEBAPP_VITE_GRAPHQL_HTTP`
  - `WEBAPP_VITE_GRAPHQL_WS`
  - `CLOUD_RUN_CORS_ORIGIN` on the backend

## 10. Optional Later Steps

These are intentionally not part of the first rollout:

- add `app.example.com`
- re-enable preview deployments if future project or team needs justify a real preview backend strategy
- add Cloudflare Web Analytics

## Official Docs

- Cloudflare account creation:
  [Create account](https://developers.cloudflare.com/fundamentals/account/create-account/)
- Cloudflare Pages direct upload:
  [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- Cloudflare Pages direct upload with continuous integration:
  [Use Direct Upload with continuous integration](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- Cloudflare Pages Git integration management:
  [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- Cloudflare Pages branch deployment controls:
  [Branch deployment controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
- Cloudflare Pages SPA serving behavior:
  [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/)
