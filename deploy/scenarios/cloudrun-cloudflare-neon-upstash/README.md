# Cloud Run + Cloudflare Pages + Neon + Upstash Scenario

This is the first production setup scenario. It currently asks for an existing,
billing-enabled Google Cloud project ID, executes Cloud Run backend bootstrap
through `deploy-provider-cloudrun`, then collects Neon database URLs and the
Upstash Redis URL as transient secrets, syncs those secrets into Google Secret
Manager, and prepares the Cloudflare Pages project through
`deploy-provider-cloudflare-pages`. Finally, it configures GitHub repository
variables and secrets through `deploy-provider-github`.

## Run

Build the Cloud Run, Cloudflare Pages, and GitHub providers first:

```sh
npm --prefix deploy/providers/cloudrun run build
npm --prefix deploy/providers/cloudflare-pages run build
npm --prefix deploy/providers/github run build
```

Before running the scenario, create or choose a Google Cloud project in Google
Cloud Console and link it to a billing account. The scenario does not create
Google Cloud projects.

Authenticate Google SDK calls with Application Default Credentials. Use
`--disable-quota-project` so Google does not copy the current `gcloud` project
into ADC as a local quota project. The scenario manages the deployment target
project itself.

```sh
gcloud auth application-default login --disable-quota-project
```

If ADC already points at a deleted or stale quota project, recreate it:

```sh
gcloud auth application-default revoke
gcloud auth application-default login --disable-quota-project
```

Authenticate the GitHub CLI before the GitHub repository configuration step:

```sh
gh auth login
```

Run the scenario through the deployment wizard CLI host:

```sh
npm --prefix deploy/wizard run cloudrun-cloudflare-neon-upstash
```

Run non-interactively:

```sh
npm --prefix deploy/wizard run cloudrun-cloudflare-neon-upstash -- \
  --var PROJECT_ID="your-existing-gcp-project-id" \
  --var GITHUB_REPOSITORY=owner/repository \
  --var DATABASE_URL="postgres://..." \
  --var DATABASE_URL_DIRECT="postgres://..." \
  --var REDIS_URL="rediss://..." \
  --var CLOUDFLARE_ACCOUNT_ID="..." \
  --var CLOUDFLARE_API_TOKEN="..." \
  --var CLOUDFLARE_PAGES_PROJECT_NAME="your-pages-project"
```

Pass `--var CLOUD_RUN_CORS_ORIGIN=https://your-webapp.example.com` when using
a custom frontend domain. Otherwise the GitHub configuration step uses the
Cloudflare Pages URL. Pass `--var WEBAPP_VITE_GRAPHQL_HTTP=...` and
`--var WEBAPP_VITE_GRAPHQL_WS=...` when the backend URL is already known or
uses a custom domain. If those values are omitted, the scenario asks Google
Cloud for the live Cloud Run service URL and appends `/graphql`.

For a brand-new environment, Cloud Run may not have a public service URL until
after the first server deploy. In that case, run the server deploy first, rerun
this scenario so the GitHub repository configuration step can resolve the live
Cloud Run URL, then deploy the webapp. You can also pass
`--var CLOUD_RUN_PUBLIC_URL=https://...run.app` when you already know the
backend service origin.

If Google reports that billing is not enabled, the scenario pauses, asks you to
enable billing for the project manually, and retries Cloud Run bootstrap after
you press Enter.

The Neon database URL and Upstash Redis URL inputs are secrets. They are
validated and stay available to later steps in the same run, but are not printed
in CLI summaries or written to the scenario state file.

The Cloudflare API token is also a secret. It is used to prepare the Pages
project and to write the GitHub repository secret during the current run, but is
not printed or written to the scenario state file. If you resume an already
prepared scenario later, the CLI asks for the token again before the GitHub
configuration step. The Pages production branch defaults to `main`; pass
`--var CLOUDFLARE_PAGES_PRODUCTION_BRANCH=...` only when using a different
branch.

The Cloud Run runtime secrets step writes these Secret Manager entries:

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `REDIS_URL`

It grants the deployer service account access to all three secrets, and grants
the Cloud Run runtime service account access to `DATABASE_URL` and `REDIS_URL`.
Only `CLOUD_RUN_RUNTIME_SECRETS_SYNCED=true` is written to scenario state.

The Cloudflare Pages step ensures the project exists, sets the production
branch, and disables Cloudflare Git automatic deployments when the project has
Git source deployment controls. It does not deploy assets.

The GitHub repository configuration step writes these repository variables:

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `GCP_ARTIFACT_REGISTRY_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT`
- `CLOUD_RUN_CORS_ORIGIN`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `WEBAPP_VITE_GRAPHQL_HTTP`
- `WEBAPP_VITE_GRAPHQL_WS`

It also writes these repository secrets through the official `gh` CLI:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

When Cloud Run bootstrap finishes, the CLI prints a Cloud Run backend handoff
section with the GitHub repository variables required by the backend deploy
workflow:

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `GCP_ARTIFACT_REGISTRY_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT`

When Cloudflare Pages provisioning finishes, the CLI prints safe Pages handoff
values:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `CLOUDFLARE_PAGES_PRODUCTION_BRANCH`
- `CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS`
- `WEBAPP_URL`

When GitHub repository configuration finishes, the CLI prints:

- `GITHUB_REPOSITORY_CONFIGURED`
- `CLOUD_RUN_PUBLIC_URL`
- `CLOUD_RUN_CORS_ORIGIN`
- `WEBAPP_VITE_GRAPHQL_HTTP`
- `WEBAPP_VITE_GRAPHQL_WS`

When every step succeeds, provisioning/setup is finished and the project is
ready for the first deploy. The scenario does not trigger deployment
automatically. From a clean pushed branch, run:

```sh
gh workflow run main-workflow.yaml --repo owner/repository --ref main
```

Use `--fresh` to ignore saved progress, and `--state <path>` to choose a
specific JSON state file. By default, state is stored at
`~/.config/beltapp/deploy-scenarios/cloudrun-cloudflare-neon-upstash.json`.
