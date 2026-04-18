# Automated/Scripted Provisioning Guide

What I could not do directly:

- actually create the GCP / Neon / Upstash resources, because that requires your cloud accounts, billing context, and console access

Run this next, in order:

1. Pick values and export them (or use `.env` file):

```bash
export PROJECT_ID="replace-me-with-a-global-project-id"
export PROJECT_NAME="replace-me-with-a-human-readable-project-name"
export GITHUB_REPOSITORY="owner/repo"
export BILLING_ACCOUNT_ID="000000-000000-000000"

export CLOUD_RUN_REGION="europe-west4"
export ARTIFACT_REGISTRY_REPOSITORY="cloud-run-backend"
export CLOUD_RUN_SERVICE="api"

export WIF_POOL_ID="github-actions"
export WIF_PROVIDER_ID="github"
export DEPLOYER_SERVICE_ACCOUNT_ID="github-actions-deployer"
export RUNTIME_SERVICE_ACCOUNT_ID="cloud-run-runtime"
```

2. Bootstrap Google Cloud:

```bash
bash bootstrap-gcp.sh
```

3. Manually create Neon in the Neon console:

- region: `aws-eu-central-1`
- database: `chatdb`
- app user: for example `chatapp`
- copy:
  - pooled URL as `DATABASE_URL`
  - direct URL as `DATABASE_URL_DIRECT`

4. Manually create Redis in Upstash:

- create one Redis database
- choose the nearest Europe region
- copy host, port, password
- build:

```bash
export REDIS_URL="rediss://:PASSWORD@HOST:PORT"
```

5. Sync secrets into Google Secret Manager:

```bash
export DEPLOYER_SERVICE_ACCOUNT_EMAIL="github-actions-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
export RUNTIME_SERVICE_ACCOUNT_EMAIL="cloud-run-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

export DATABASE_URL="replace-with-neon-pooled-url"
export DATABASE_URL_DIRECT="replace-with-neon-direct-url"

bash sync-secrets.sh
```

6. Set GitHub repository variables.
   If you use `gh`, this is the easiest path:

```bash
export GCP_PROJECT_ID="${PROJECT_ID}"
export GCP_WORKLOAD_IDENTITY_PROVIDER="projects/123456789/locations/global/workloadIdentityPools/github-actions/providers/github"
export GCP_SERVICE_ACCOUNT="${DEPLOYER_SERVICE_ACCOUNT_EMAIL}"
export GCP_ARTIFACT_REGISTRY_REPOSITORY="${ARTIFACT_REGISTRY_REPOSITORY}"
export CLOUD_RUN_SERVICE="${CLOUD_RUN_SERVICE}"
export CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT="${RUNTIME_SERVICE_ACCOUNT_EMAIL}"
export CLOUD_RUN_CORS_ORIGIN="http://localhost:5173"

bash configure-github-vars.sh
```

7. Trigger the GitHub Actions workflow:

- run `deploy-cloud-run-backend`
- then validate:

```bash
curl -fsS "https://YOUR_RUN_APP_URL/health"
curl -fsS -H 'content-type: application/json' \
  --data '{"query":"query { getMessages { id author body } }"}' \
  "https://YOUR_RUN_APP_URL/graphql"
```

The full step-by-step version, including what each script does and what stays manual, is in [PROVISIONING.md](PROVISIONING.md). I based that runbook on official docs from Google, Neon, and Upstash, including:

- [https://github.com/google-github-actions/auth](https://github.com/google-github-actions/auth)
- [https://cloud.google.com/run/docs/authenticating/public](https://cloud.google.com/run/docs/authenticating/public)
- [https://docs.cloud.google.com/run/docs/configuring/services/secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets)
- [https://api-docs.neon.tech/reference/createproject](https://api-docs.neon.tech/reference/createproject)
- [https://upstash.com/pricing/redis](https://upstash.com/pricing/redis)
