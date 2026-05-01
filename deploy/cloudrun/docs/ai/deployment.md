# Cloud Run Deployment Guidance

This document tells AI assistants how to guide production preparation and
deployment for the `server` target on Cloud Run.

## Scope

Use this document for Cloud Run production setup, backend deployment, backend
GitHub deployment variables, Google Cloud infrastructure, Secret Manager,
backend runtime secrets, production migrations, Cloud Run monitoring, and
backend production troubleshooting.

The provider scripts are the recommended path. They encode the repository's
current deployment decisions and should be preferred before manual setup. Still
explain the manual equivalent when a human needs to understand or repair the
automation.

The guided scenario under `deploy/scenarios/cloudrun-cloudflare-neon-upstash`,
run through `deploy/wizard`, is also an active preparation path for the
currently implemented combined flow. It can create or select the Google Cloud
project, run Cloud Run backend bootstrap, collect already-provisioned Neon and
Upstash connection URLs, and sync `DATABASE_URL`, `DATABASE_URL_DIRECT`, and
`REDIS_URL` into Secret Manager without persisting the secret values. It also
prepares the Cloudflare Pages project, but it does not replace the final GitHub
Actions deployment trigger.

## Deployment Boundary

The Cloud Run deploy target is `server`.

Production deployment flow:

1. GitHub Actions runs `.github/workflows/main-workflow.yaml` or
   `.github/workflows/force-deploy-server.yaml`.
2. Rush Delivery detects, builds, packages, and deploys the `server` target.
3. Rush package materialization creates `common/deploy/server` from the Rush
   deploy scenario.
4. Rush Delivery runs [../../scripts/deploy-server.sh](../../scripts/deploy-server.sh).
5. The deploy script runs migrations, builds and pushes the backend container,
   deploys Cloud Run, and runs the post-deploy smoke test.

Do not describe a local script run as the final production deployment step. The
human-facing deployment trigger is GitHub Actions.

## Recommended Automation Path

For the guided combined flow, run the scenario engine when the human wants a
single resumable CLI flow:

```bash
npm --prefix deploy/providers/cloudrun run build
npm --prefix deploy/providers/cloudflare-pages run build
npm --prefix deploy/wizard run cloudrun-cloudflare-neon-upstash
```

Use this path after the Neon and Upstash resources exist and the user has the
final connection URLs that should be stored in Secret Manager. If a separate
least-privilege Neon runtime user is required, create or rotate it before
syncing the final `DATABASE_URL`.

Start from [../../config/.env.example](../../config/.env.example). Copy it to
`deploy/cloudrun/config/.env` and fill the deployment values.

1. Prepare the shared deploy config.
   - `PROJECT_ID`: Google Cloud project id.
   - `PROJECT_NAME`: display name, usually the same as `PROJECT_ID`.
   - `GITHUB_REPOSITORY`: owner/name repository slug.
   - `BILLING_ACCOUNT_ID`: optional, used when the script should link billing.
   - `CLOUD_RUN_REGION`: defaults to `europe-west4`.
   - `ARTIFACT_REGISTRY_REPOSITORY`: defaults to `cloud-run-backend`.
   - `CLOUD_RUN_SERVICE`: defaults to `api`.
   - `CLOUD_RUN_CORS_ORIGIN`: the real webapp origin in production.
   - `DATABASE_URL`: pooled runtime PostgreSQL URL.
   - `DATABASE_URL_DIRECT`: direct migration/admin PostgreSQL URL.
   - `REDIS_URL`: production Redis URL for distributed pub/sub.

2. Bootstrap Google Cloud.
   Run [../../scripts/bootstrap-gcp.sh](../../scripts/bootstrap-gcp.sh).
   This creates or verifies the project, enables required APIs, creates Artifact
   Registry, creates deployer and runtime service accounts, configures Workload
   Identity Federation for GitHub Actions, and grants the required IAM roles.

3. Provision the data stores.
   Neon and Redis resource creation is currently a provider/manual step. Store
   the pooled Neon URL as `DATABASE_URL`, the direct Neon URL as
   `DATABASE_URL_DIRECT`, and the Redis TLS URL as `REDIS_URL`.

4. Create the least-privilege Neon runtime role when using Neon.
   Run [../../scripts/create-neon-app-user.sh](../../scripts/create-neon-app-user.sh).
   It connects through `DATABASE_URL_DIRECT`, creates or rotates a runtime role,
   writes the low-privilege pooled `DATABASE_URL` override into
   `deploy/cloudrun/config/.env.local`, and syncs the updated secret unless
   `--no-sync-secrets` is passed.

5. Sync runtime secrets.
   Run [../../scripts/sync-secrets.sh](../../scripts/sync-secrets.sh) if the
   previous step did not already sync secrets. It creates or updates
   `DATABASE_URL`, `DATABASE_URL_DIRECT`, and `REDIS_URL` in Secret Manager. The
   deployer service account receives access to all three; the Cloud Run runtime
   service account receives access to `DATABASE_URL` and `REDIS_URL`.

6. Configure GitHub repository variables.
   Run [../../scripts/configure-github-vars.sh](../../scripts/configure-github-vars.sh).
   It sets the Cloud Run GitHub variables used by Rush Delivery.

7. Configure production auth before claiming authenticated production readiness.
   Browser production should use memory-only access tokens plus an HttpOnly
   refresh cookie. The server needs a strong `AUTH_ACCESS_TOKEN_SECRET` and
   aligned refresh-cookie settings. If the active deploy script or metadata does
   not inject these settings yet, add them to the deployment path before saying
   production auth is complete.

8. Configure monitoring when the environment is ready.
   Use [../../scripts/create-monitoring-email-channel.sh](../../scripts/create-monitoring-email-channel.sh)
   if an email channel should be created, then run
   [../../scripts/setup-monitoring-alerts.sh](../../scripts/setup-monitoring-alerts.sh).
   The monitoring helper creates or updates the `/health` uptime check,
   log-based backend failure metrics, and alert policies.

9. Deploy through GitHub Actions.
   Push to `main` for the normal full workflow, or manually run
   `force-deploy-server` for a targeted backend deployment.

10. Verify the deployed backend.
    The deploy script runs
    [../../tests/validate-post-deploy-smoke.sh](../../tests/validate-post-deploy-smoke.sh),
    which checks `/health`, GraphQL HTTP query/mutation behavior, and GraphQL
    WS subscription delivery. For deeper checks, use
    [../../tests/validate-multi-instance.sh](../../tests/validate-multi-instance.sh)
    and [../../tests/validate-redeploy-reconnect.sh](../../tests/validate-redeploy-reconnect.sh).

## Manual Equivalent

When the scripts cannot be used, explain the same setup manually.

Google Cloud manual setup:

- Create or select the Google Cloud project.
- Link billing if the project is new.
- Enable `artifactregistry.googleapis.com`, `cloudresourcemanager.googleapis.com`,
  `iam.googleapis.com`, `iamcredentials.googleapis.com`, `run.googleapis.com`,
  `secretmanager.googleapis.com`, `serviceusage.googleapis.com`, and
  `sts.googleapis.com`.
- Create the Docker Artifact Registry repository in the Cloud Run region.
- Create a deployer service account for GitHub Actions.
- Create a Cloud Run runtime service account for the backend.
- Create a Workload Identity pool and OIDC provider for the GitHub repository.
- Bind the GitHub repository principal to the deployer service account with
  `roles/iam.workloadIdentityUser`.
- Grant the deployer `roles/run.admin` on the project.
- Grant the deployer `roles/artifactregistry.writer` on the Artifact Registry
  repository.
- Grant the deployer permission to act as the runtime service account with
  `roles/iam.serviceAccountUser`.

Secret Manager manual setup:

- Create `DATABASE_URL`, `DATABASE_URL_DIRECT`, and `REDIS_URL`.
- Grant the deployer service account access to all three secrets.
- Grant the runtime service account access to `DATABASE_URL` and `REDIS_URL`.
- Keep `DATABASE_URL` as the pooled low-privilege runtime URL.
- Keep `DATABASE_URL_DIRECT` as the direct higher-privilege migration URL.

GitHub manual setup:

- Set repository variables `GCP_PROJECT_ID`,
  `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`,
  `GCP_ARTIFACT_REGISTRY_REPOSITORY`, `CLOUD_RUN_SERVICE`,
  `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT`, and `CLOUD_RUN_CORS_ORIGIN`.
- Confirm `.github/workflows/main-workflow.yaml` still maps those variables into
  Rush Delivery deploy environment values.
- Trigger `main-workflow` by pushing to `main`, or manually run
  `force-deploy-server`.

## Required GitHub Variables

The backend deployment expects:

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `GCP_ARTIFACT_REGISTRY_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT`
- `CLOUD_RUN_CORS_ORIGIN`

`CLOUD_RUN_REGION` currently comes from `.github/workflows/main-workflow.yaml`
and defaults to `europe-west4`.

## Runtime Configuration

The current Cloud Run deploy script sets these production runtime values:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `GRAPHQL_PATH=/graphql`
- `PUBSUB_DRIVER=redis`
- `DATABASE_SYNCHRONIZE=false`
- `DATABASE_SSL=true`
- `DATABASE_SSL_REJECT_UNAUTHORIZED=false`
- `CORS_ORIGIN=${CLOUD_RUN_CORS_ORIGIN}`
- `LOG_VERBOSE_PUBSUB=false`
- `LOG_GRAPHQL_SUBSCRIPTIONS=false`

The script injects these Secret Manager secrets into the runtime:

- `DATABASE_URL`
- `REDIS_URL`

The script reads `DATABASE_URL_DIRECT` before deploy to run TypeORM migrations
from the packaged backend artifact.

Auth settings that matter for production browser sessions:

- `AUTH_ACCESS_TOKEN_SECRET`: strong signing secret, at least 32 characters.
- `AUTH_ACCESS_TOKEN_TTL_SECONDS`: short access-token lifetime.
- `AUTH_REFRESH_TOKEN_TTL_SECONDS`: refresh-token lifetime.
- `AUTH_REFRESH_TOKEN_TRANSPORT=cookie`: preferred browser transport.
- `AUTH_REFRESH_COOKIE_NAME`: default is `refresh_token`.
- `AUTH_REFRESH_COOKIE_PATH`: default is `/graphql`.
- `AUTH_REFRESH_COOKIE_SAME_SITE=lax`, unless cross-site cookies require
  `none`.
- `AUTH_REFRESH_COOKIE_SECURE=true` for HTTPS production.
- `AUTH_PROVIDERS`, `AUTH_DEFAULT_LOGIN_PROVIDER`,
  `AUTH_REGISTRATION_PROVIDER`, and `AUTH_LOCAL_DEFAULT_ROLE` when changing
  identity-provider behavior.

Do not recommend wildcard production CORS when cookie refresh transport is in
use. Credentialed browser requests require an exact allowed origin.

## Cross-Provider Coordination

Cloud Run and Cloudflare Pages settings must agree:

- `CLOUD_RUN_CORS_ORIGIN` must include the deployed webapp origin, usually
  `https://<CLOUDFLARE_PAGES_PROJECT_NAME>.pages.dev`.
- `WEBAPP_VITE_GRAPHQL_HTTP` must point to the deployed backend
  `https://.../graphql` URL.
- `WEBAPP_VITE_GRAPHQL_WS` must point to the deployed backend
  `wss://.../graphql` URL.
- `GRAPHQL_PATH` and `AUTH_REFRESH_COOKIE_PATH` should stay aligned with the
  frontend GraphQL path.
- If either side moves to a custom domain, update and redeploy the other side
  when its configuration depends on that origin or endpoint.

## Validation

Before deployment, prefer repository validation when possible:

```bash
npm run rush -- verify
```

After backend deployment:

- Confirm the Cloud Run service URL from Cloud Run or the workflow logs.
- Check `https://<service-url>/health`.
- Check GraphQL HTTP at `https://<service-url>/graphql`.
- Check GraphQL WS subscriptions at `wss://<service-url>/graphql`.
- Confirm the post-deploy smoke test passed in the workflow.
- For multi-instance readiness, run the multi-instance validation against the
  deployed service.
- For reconnect diagnostics, run the redeploy reconnect validation. Treat it as
  a diagnostic probe, not the only browser reconnect acceptance test.

## Common Mistakes

- Treating local script output as a finished production deployment instead of
  ending with GitHub Actions.
- Leaving `CLOUD_RUN_CORS_ORIGIN` at `http://localhost:5173` for production.
- Forgetting `/graphql` in frontend endpoint variables.
- Swapping `DATABASE_URL` and `DATABASE_URL_DIRECT`.
- Running production with `DATABASE_SYNCHRONIZE=true`.
- Missing `REDIS_URL` while `PUBSUB_DRIVER=redis`.
- Assuming HTTP logout changes already-open GraphQL WS identity. Websocket
  authentication is connection-scoped; the webapp closes/restarts sockets on
  local auth changes.
