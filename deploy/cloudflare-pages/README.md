# Cloudflare Pages Frontend Deployment

This guide wires the repo for the chosen frontend host:

- frontend host: `Cloudflare Pages`
- initial frontend URL: generated `*.pages.dev`
- initial backend URL used by the frontend: generated Cloud Run `run.app` URL

It is written for this monorepo, where the frontend lives in [apps/client](../../apps/client).

For the manual Cloudflare dashboard steps, also see:

- [CLOUDFLARE_GUIDE.md](docs/CLOUDFLARE_GUIDE.md)

## Repo-Side Build Command

Cloudflare Pages should use this repo-root build command:

```bash
npm run client:build:pages
```

That script:

- validates the required production API env vars are present
- refuses to build if the placeholder `api.example.com` URLs are still in use
- builds the client through Nx from the monorepo root

The script lives at:

- [build-client.sh](scripts/build-client.sh)

## Required Cloudflare Pages Settings

In Cloudflare Dashboard:

1. Go to `Workers & Pages`.
2. Click `Create application` -> `Pages`.
3. Choose `Connect to Git`.
4. Select this GitHub repository.
5. Create one Pages project for this frontend.

Recommended project shape:

- project name: a unique frontend name such as `poltapp-client`
- production branch: `main`
- preview branch setting: `None`
- current preview strategy: `No previews` for now
- revisit previews later only if the project or team needs dedicated branch environments

## Build Settings

Use these values in the Pages project setup:

- Framework preset: `None`
- Root directory: repo root
- Build command: `npm run client:build:pages`
- Build output directory: `apps/client/dist`

Why `None` instead of the plain Vite preset:

- this repo is a monorepo
- the frontend build is launched from the repo root through Nx
- the custom repo-root build command is more reliable than assuming the app is a standalone Vite project

## Required Environment Variables

Set these in the Cloudflare Pages project for the `Production` environment:

```dotenv
NODE_VERSION=24
VITE_GRAPHQL_HTTP=https://<cloud-run-service>.run.app/graphql
VITE_GRAPHQL_WS=wss://<cloud-run-service>.run.app/graphql
```

Use the real Cloud Run generated URL from the backend deployment output.

Example shape:

```dotenv
VITE_GRAPHQL_HTTP=https://api-abc123-ew.a.run.app/graphql
VITE_GRAPHQL_WS=wss://api-abc123-ew.a.run.app/graphql
```

Important:

- `VITE_GRAPHQL_HTTP` must be an absolute `https://` URL
- `VITE_GRAPHQL_WS` must be an absolute `wss://` URL
- do not leave the placeholder values from [apps/client/.env.production](../../apps/client/.env.production)

## SPA Routing

This app is a client-side React SPA.

Cloudflare Pages' default serving behavior already treats projects without a
top-level `404.html` as SPAs and routes unknown paths to `/`, so no custom
`_redirects` file is required for the initial rollout.

## Monorepo Notes

Cloudflare Pages documents monorepo support through:

- a configurable root directory
- custom build commands
- optional build watch paths if you want to reduce unnecessary rebuilds later

For the first rollout, keep the setup simple:

- connect the repository once
- build from repo root
- deploy only the frontend app from `apps/client/dist`
- disable automatic preview deployments as the current `No previews` strategy

## After The First Deploy

Once the project builds successfully, Cloudflare Pages will give you a stable
production URL in this shape:

```text
https://<project-name>.pages.dev
```

Use that generated `*.pages.dev` URL first. Custom domains such as
`app.example.com` can be added later.

Where to find it in Cloudflare:

- `Workers & Pages` -> your Pages project -> `Deployments`
- open the latest production deployment and use the provided production URL
- Cloudflare's Pages docs also note that the project name is assigned as the `*.pages.dev` subdomain

## References

- Cloudflare Pages build configuration:
  [https://developers.cloudflare.com/pages/configuration/build-configuration/](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- Cloudflare Pages monorepos:
  [https://developers.cloudflare.com/pages/configuration/monorepos/](https://developers.cloudflare.com/pages/configuration/monorepos/)
- Cloudflare Pages GitHub integration:
  [https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)
- Cloudflare Pages build image and `NODE_VERSION`:
  [https://developers.cloudflare.com/pages/configuration/build-image/](https://developers.cloudflare.com/pages/configuration/build-image/)
- Cloudflare Pages serving behavior for SPAs:
  [https://developers.cloudflare.com/pages/configuration/serving-pages/](https://developers.cloudflare.com/pages/configuration/serving-pages/)
