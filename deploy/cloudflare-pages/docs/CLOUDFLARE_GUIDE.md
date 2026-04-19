# Cloudflare Guide

This guide covers the manual Cloudflare steps for the frontend deployment.

It is the Cloudflare-side companion to:

- [README.md](../README.md)
- [../cloudrun/PROVISIONING.md](../../cloudrun/docs/PROVISIONING.md)

This guide is for the exact frontend stack chosen for this repo:

- frontend host: `Cloudflare Pages`
- deployment style: `Git integration`
- initial frontend URL: generated `*.pages.dev`
- initial backend URL: generated Cloud Run `run.app` URL

## Important UI Note

Cloudflare currently has two similar but different Git-based flows in the
dashboard:

- `Pages` projects
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
3. Choose `Import an existing Git repository`.
4. Continue with the Pages-specific settings from this guide.

Why this matters:

- the Pages flow uses a `Build output directory` field
- the Worker flow uses Wrangler deploy commands instead
- the Pages-first rollout in this migration expects a generated `*.pages.dev`
  hostname, while the Worker flow is oriented around `*.workers.dev`

## What The Repo Already Provides

The repo-side build wiring is already done.

Cloudflare Pages should build this repo with:

- build command: `npm run client:build:pages`
- output directory: `apps/client/dist`

Those settings are documented in:

- [README.md](../README.md)

## Values To Have Ready

Before clicking through Cloudflare, have these ready:

- your GitHub repository connected to this codebase
- your deployed backend Cloud Run URL
- the exact frontend env vars you will set in Pages:
  - `NODE_VERSION=24`
  - `VITE_GRAPHQL_HTTP=https://<cloud-run-service>.run.app/graphql`
  - `VITE_GRAPHQL_WS=wss://<cloud-run-service>.run.app/graphql`

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

## 2. Connect GitHub To Cloudflare Pages

Console path:

- `Workers & Pages`
- `Create application`
- `Pages`
- `Connect to Git`

Steps:

1. Open `Workers & Pages`.
2. Click `Create application`.
3. Choose `Pages`.
4. Choose `Connect to Git`.
5. Authorize the Cloudflare Workers & Pages GitHub app when prompted.
6. If the repository is under a GitHub organization, grant access to the correct organization.
7. Prefer limiting the GitHub app to only the repositories you actually want Cloudflare to build.

## 3. Select The Repository

Steps:

1. After GitHub authorization, choose this repository.
2. Click `Begin setup`.

Cloudflare Pages supports monorepos, so one repository can host multiple apps.

For this migration, create one Pages project for the frontend only.

## 4. Create The Pages Project

Use these values during project creation:

- project name: a unique frontend project name such as `poltapp-client`
- production branch: `main`

Notes:

- the project name becomes the base for the generated `*.pages.dev` hostname
- the production branch should match the branch you want to publish as the live frontend
- Cloudflare's Pages docs note that the `Project name` value is assigned as your `*.pages.dev` subdomain

## 5. Configure Build Settings

In the `Set up builds and deployments` step, use:

- Framework preset: `None`
- Build command: `npm run client:build:pages`
- Build output directory: `apps/client/dist`

For `Root directory (advanced)`:

- leave it empty if the UI allows that, because Cloudflare uses the repository root by default
- if the UI requires an explicit path, use the repository root rather than `apps/client`

Why this setup:

- this repo is a monorepo
- the frontend build is launched from repo root through Nx
- the custom build command already validates the required env vars and then builds the client correctly

## 6. Set Environment Variables

During project creation or immediately afterward, set these `Production` environment variables:

```dotenv
NODE_VERSION=24
VITE_GRAPHQL_HTTP=https://<cloud-run-service>.run.app/graphql
VITE_GRAPHQL_WS=wss://<cloud-run-service>.run.app/graphql
```

Important:

- `VITE_GRAPHQL_HTTP` must be an absolute `https://` URL
- `VITE_GRAPHQL_WS` must be an absolute `wss://` URL
- do not use the placeholder `api.example.com` values from [apps/client/.env.production](../../../apps/client/.env.production)
- do not forget to append `/graphql`

Example shape:

```dotenv
VITE_GRAPHQL_HTTP=https://api-12345-xy.a.run.app/graphql
VITE_GRAPHQL_WS=wss://api-12345-xy.a.run.app/graphql
```

If your real backend URL is currently:

```text
https://api-32lgreeilq-ez.a.run.app/
```

then the exact values are:

```dotenv
VITE_GRAPHQL_HTTP=https://api-32lgreeilq-ez.a.run.app/graphql
VITE_GRAPHQL_WS=wss://api-32lgreeilq-ez.a.run.app/graphql
```

## 7. Configure Preview Deployments

For the first rollout, keep preview handling simple.

Console path:

- open your Pages project
- `Settings`
- `Builds & deployments`
- branch deployment controls

Recommended setting:

- production branch: `main`
- preview branch deployments: `None`

Why:

- this migration does not yet define a separate preview backend
- disabling preview builds avoids confusing deployments that point at the wrong API

You can revisit preview deployments later once you choose a backend preview strategy.

## 8. Trigger The First Frontend Deploy

Steps:

1. Save the project settings.
2. Start the first deploy.
3. Wait for the build to complete.
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

## 9. Update Backend CORS After The First Pages Deploy

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

## 10. Validate The Frontend

After the Pages deploy finishes:

1. Open the `*.pages.dev` URL.
2. Confirm the app loads.
3. Confirm the frontend can fetch messages from the backend.
4. Confirm sending a new message works.
5. Confirm subscriptions connect and receive new messages.

Notes:

- Cloudflare Pages already supports SPA serving behavior by default for projects without a top-level `404.html`, so no custom `_redirects` file is required for this app right now.
- If the UI loads but API calls fail, first check:
  - `VITE_GRAPHQL_HTTP`
  - `VITE_GRAPHQL_WS`
  - `CLOUD_RUN_CORS_ORIGIN` on the backend

## 11. Optional Later Steps

These are intentionally not part of the first rollout:

- add `app.example.com`
- re-enable preview deployments with a real preview backend strategy
- add Cloudflare Web Analytics

## Official Docs

- Cloudflare account creation:
  [Create account](https://developers.cloudflare.com/fundamentals/account/create-account/)
- Cloudflare Pages Git integration getting started:
  [Git integration guide](https://developers.cloudflare.com/pages/get-started/git-integration/)
- Cloudflare Pages Git integration management:
  [Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- Cloudflare Pages GitHub integration:
  [GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)
- Cloudflare Pages build configuration:
  [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- Cloudflare Pages monorepo support:
  [Monorepos](https://developers.cloudflare.com/pages/configuration/monorepos/)
- Cloudflare Pages environment variables:
  [Bindings / Environment variables](https://developers.cloudflare.com/pages/functions/bindings/)
- Cloudflare Pages branch deployment controls:
  [Branch deployment controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
- Cloudflare Pages SPA serving behavior:
  [Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/)
