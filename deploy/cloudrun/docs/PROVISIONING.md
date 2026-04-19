# Cloud Run Provisioning Runbook

This runbook covers the exact next step after Phase 5:

- provision Google Cloud resources
- create Neon and Redis resources
- wire secrets and GitHub Actions variables
- perform the first backend deployment

The backend build and deploy workflow already exist in the repo. This document
gets the real cloud side ready for them.

## Automation Map

- Step `1`: manual input in [deploy/cloudrun/config/.env](../config/.env)
- Step `2`: automated by [bootstrap-gcp.sh](../scripts/bootstrap-gcp.sh)
- Steps `3` and `4`: manual provider setup using [NEON-UPSTASH-GUIDE.md](NEON-UPSTASH-GUIDE.md)
- Step `5`: automated by [sync-secrets.sh](../scripts/sync-secrets.sh)
- Step `6`: automated by [configure-github-vars.sh](../scripts/configure-github-vars.sh), or manual in GitHub UI if preferred
- Step `7`: automated by GitHub Actions in [../../.github/workflows/deploy-cloud-run-backend.yaml](../../.github/workflows/deploy-cloud-run-backend.yaml)
- Step `8`: manual verification after deploy

## Chosen Stack

- Backend runtime: Google Cloud Run
- Backend region: `europe-west4`
- Container registry: Artifact Registry in `europe-west4`
- Database: Neon PostgreSQL in `aws-eu-central-1`
- Shared pub/sub: Redis, using Upstash for the hobby-scale first rollout
- CI/CD: GitHub Actions with Workload Identity Federation

## Why Upstash Here

Upstash is a practical fit for the initial rollout because its official pricing
page currently shows a free Redis tier for hobby projects, and its documentation
shows direct compatibility with standard Redis clients and TLS-enabled TCP
connections.

This repo uses `ioredis`, so the important connection shape is:

```text
rediss://:PASSWORD@HOST:PORT
```

## Before You Start

You need:

- `gcloud` authenticated to the Google account that will own the project
- a GitHub repository for this codebase
- access to your GitHub repository settings
- a Neon account
- an Upstash account

Optional but convenient:

- `gh` authenticated to GitHub if you want to set repository variables from CLI

## Config File

The Cloud Run provisioning scripts automatically load variables from:

- [deploy/cloudrun/config/.env](../config/.env)
- [deploy/cloudrun/config/.env.example](../config/.env.example)

Start by copying `deploy/cloudrun/config/.env.example` to
`deploy/cloudrun/config/.env` if you ever need to recreate the file. Then edit
`deploy/cloudrun/config/.env` once and run the scripts without repeatedly
exporting the same variables.

## Step 1: Pick Exact Values

Automation status:

- manual
- the scripts read these values, but they do not invent them for you

Put these values into [deploy/cloudrun/config/.env](../config/.env):

```dotenv
PROJECT_ID=""
PROJECT_NAME=""
GITHUB_REPOSITORY=""
BILLING_ACCOUNT_ID=""

CLOUD_RUN_REGION="europe-west4"
ARTIFACT_REGISTRY_REPOSITORY="cloud-run-backend"
CLOUD_RUN_SERVICE="api"

WIF_POOL_ID="github-actions"
WIF_PROVIDER_ID="github"
DEPLOYER_SERVICE_ACCOUNT_ID="github-actions-deployer"
RUNTIME_SERVICE_ACCOUNT_ID="cloud-run-runtime"

CLOUD_RUN_CORS_ORIGIN="http://localhost:5173"

DATABASE_URL=""
DATABASE_URL_DIRECT=""
REDIS_URL=""
```

Notes:

- `PROJECT_ID` must be globally unique in Google Cloud.
- `CLOUD_RUN_SERVICE=api` matches the subdomain plan well.
- The runtime service account is separate from the GitHub deployer service account on purpose.

## Step 2: Bootstrap Google Cloud

Automation status:

- automated by [bootstrap-gcp.sh](../scripts/bootstrap-gcp.sh)
- this is the preferred path instead of clicking through most of [GCP_GUIDE.md](GCP_GUIDE.md)

Run:

```bash
bash deploy/cloudrun/scripts/bootstrap-gcp.sh
```

What this does:

- creates the GCP project if it does not already exist
- links billing if `BILLING_ACCOUNT_ID` is set
- enables the required APIs
- creates the Docker Artifact Registry repository
- creates:
  - deployer service account
  - Cloud Run runtime service account
- creates GitHub OIDC Workload Identity resources
- grants the deployer service account:
  - `roles/run.admin`
  - `roles/artifactregistry.writer` on the backend image repository
  - `roles/iam.serviceAccountUser` on the runtime service account
- prints the exact GitHub variable values you will need later

Manual check after the script:

- open Google Cloud Console and verify the project exists
- verify Artifact Registry has a Docker repository in `europe-west4`
- verify both service accounts exist
- verify the Workload Identity provider exists

## Step 3: Create Neon PostgreSQL

Automation status:

- manual provider setup
- no repo script creates the Neon project yet

Use the Neon console for this step.

Recommended choices:

- plan: `Free`
- region: `aws-eu-central-1`
- keep Neon defaults for database and role unless you want custom names

Capture two connection strings:

- pooled connection string -> `DATABASE_URL`
- direct connection string -> `DATABASE_URL_DIRECT`

Why both:

- this repo uses `DATABASE_URL` at runtime
- this repo uses `DATABASE_URL_DIRECT` for migrations

For short click-by-click provider instructions, see:

- [NEON-UPSTASH-GUIDE.md](NEON-UPSTASH-GUIDE.md)

## Step 4: Create Redis

Automation status:

- manual provider setup
- no repo script creates the Upstash Redis database yet

Use Upstash Console for the initial rollout.

Recommended settings:

- database type: Redis
- primary region: choose the nearest available EU region to Cloud Run `europe-west4`
- no read regions for the first rollout
- plan: free tier unless you already expect to exceed it

When the database is ready, copy:

- endpoint
- port
- password

Construct:

```bash
export REDIS_URL="rediss://:PASSWORD@HOST:PORT"
```

This is the format Upstash documents for `ioredis`.

For short click-by-click provider instructions, see:

- [NEON-UPSTASH-GUIDE.md](NEON-UPSTASH-GUIDE.md)

## Step 5: Create Secret Manager Secrets

Automation status:

- automated by [sync-secrets.sh](../scripts/sync-secrets.sh)
- manual Secret Manager creation is only the fallback path described in [GCP_GUIDE.md](GCP_GUIDE.md)

Fill these values in [deploy/cloudrun/config/.env](../config/.env):

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `REDIS_URL`

Then run:

```bash
bash deploy/cloudrun/scripts/sync-secrets.sh
```

What this does:

- creates or updates:
  - `DATABASE_URL`
  - `DATABASE_URL_DIRECT`
  - `REDIS_URL`
- grants `roles/secretmanager.secretAccessor` to:
  - deployer service account for all three secrets
  - runtime service account for `DATABASE_URL` and `REDIS_URL`

## Step 6: Set GitHub Repository Variables

Automation status:

- preferably automated by [configure-github-vars.sh](../scripts/configure-github-vars.sh)
- manual GitHub repository settings are the fallback path

The workflow expects these repository variables:

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `GCP_ARTIFACT_REGISTRY_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT`
- `CLOUD_RUN_CORS_ORIGIN`

For the first backend-only rollout, a practical `CLOUD_RUN_CORS_ORIGIN` in
`deploy/cloudrun/config/.env` is:

```text
http://localhost:5173
```

or, if you already know the Cloudflare Pages URL:

```text
http://localhost:5173,https://your-project.pages.dev
```

You can set the variables manually in GitHub repository settings, or by CLI:

```bash
bash deploy/cloudrun/scripts/configure-github-vars.sh
```

## Step 7: Trigger the First Backend Deploy

Automation status:

- handled by GitHub Actions in [../../.github/workflows/deploy-cloud-run-backend.yaml](../../.github/workflows/deploy-cloud-run-backend.yaml)
- this step is about starting the workflow and watching the result

From GitHub Actions:

- run `deploy-cloud-run-backend`

What should happen:

- GitHub authenticates to GCP via Workload Identity Federation
- the workflow runs TypeORM migrations using `DATABASE_URL_DIRECT`
- the workflow builds and pushes the backend image to Artifact Registry
- the workflow deploys the Cloud Run service in `europe-west4`
- the service is configured as public using `--no-invoker-iam-check`

## Step 8: Validate the Deployed Backend

Automation status:

- manual verification
- smoke checks are not fully automated yet

After deploy, note the generated Cloud Run URL and verify:

```bash
curl -fsS "https://YOUR_RUN_APP_URL/health"
```

Expected:

```json
{ "status": "ok" }
```

Then test GraphQL:

```bash
curl -fsS \
  -H 'content-type: application/json' \
  --data '{"query":"query { getMessages { id author body } }"}' \
  "https://YOUR_RUN_APP_URL/graphql"
```

If that succeeds, the backend provisioning path is good and the next step is
Cloudflare Pages setup for the frontend.

## Manual Steps Summary

These parts are still manual:

- choosing your final `PROJECT_ID`
- linking a billing account if needed
- creating the Neon project and copying its connection strings
- creating the Upstash Redis database and copying its credentials
- optionally setting GitHub repository variables in the GitHub UI instead of `gh`
- triggering the first deploy from GitHub Actions

These parts are now automated by repo scripts:

- Google Cloud bootstrap
- Workload Identity setup
- Artifact Registry creation
- service account creation
- Secret Manager creation and updates

## References

- Google Cloud: Workload Identity Federation with GitHub Actions
  [google-github-actions/auth](https://github.com/google-github-actions/auth)
- Google Cloud: Artifact Registry repository creation
  [Create standard repositories](https://cloud.google.com/artifact-registry/docs/repositories/create-repos)
- Google Cloud: Secret Manager secret creation
  [Create and access a secret](https://cloud.google.com/secret-manager/docs/creating-and-accessing-secrets)
- Google Cloud: Cloud Run public access
  [Allowing public access](https://cloud.google.com/run/docs/authenticating/public)
- Google Cloud: Cloud Run secrets and service identity
  [Configure secrets for services](https://docs.cloud.google.com/run/docs/configuring/services/secrets)
- Neon API: Create project
  [Create project](https://api-docs.neon.tech/reference/createproject)
- Neon API: Retrieve connection URI
  [Get connection URI](https://api-docs.neon.tech/reference/getconnectionuri)
- Upstash docs: Getting started
  [Getting started](https://upstash.com/docs/redis/overall/getstarted)
- Upstash docs: Connect your client
  [Connect your client](https://upstash.com/docs/redis/howto/connectclient)
- Upstash pricing
  [Redis pricing](https://upstash.com/pricing/redis)
