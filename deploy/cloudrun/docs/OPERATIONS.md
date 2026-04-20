# Cloud Run Operations Runbook

This runbook covers the repo-side operational procedures that stay relevant
after the first production deployment:

- reading the structured backend logs
- rolling traffic back to an older Cloud Run revision
- reverting TypeORM migrations
- rotating runtime secrets safely
- keeping local dev aligned as production env requirements evolve

For the base provisioning flow, also see:

- [PROVISIONING.md](PROVISIONING.md)
- [GCP_GUIDE.md](GCP_GUIDE.md)
- [NEON-UPSTASH-GUIDE.md](NEON-UPSTASH-GUIDE.md)

## Structured Log Events

The backend now emits JSON-shaped log lines for these operational events:

- startup:
  - `app_bootstrap_start`
  - `app_bootstrap_configured`
  - `app_listening`
  - `app_bootstrap_failed`
- database:
  - `database_connect_start`
  - `database_connect_ready`
  - `database_connect_failed`
- Redis and pub/sub:
  - `chat_pubsub_driver_selected`
  - `chat_pubsub_init_failed`
  - `redis_client_ready`
  - `redis_client_reconnecting`
  - `redis_client_closed`
  - `redis_client_error`
  - `redis_client_quit_failed`
  - `chat_pubsub_publish`
  - `chat_pubsub_publish_failed`
  - `chat_pubsub_deliver`
  - `chat_pubsub_deliver_failed`
  - `chat_pubsub_deliver_parse_failed`
- subscriptions:
  - `graphql_subscription_connect`
  - `graphql_subscription_disconnect`
  - `graphql_subscription_subscribe`

Verbose success-path tracing is intentionally configurable:

- `LOG_VERBOSE_PUBSUB=true`
  - enables per-message `chat_pubsub_publish` and `chat_pubsub_deliver`
- `LOG_GRAPHQL_SUBSCRIPTIONS=true`
  - enables `graphql_subscription_connect`, `graphql_subscription_disconnect`,
    and `graphql_subscription_subscribe`

Current repo defaults:

- local dev in `apps/server/.env.development`: both flags `true`
- Cloud Run deploy workflow: both flags `false`

That keeps production logs focused on lifecycle and failure events while
preserving rich local tracing when you are debugging subscriptions.

## Read Recent Backend Logs

Load the shared Cloud Run config first:

```bash
source deploy/cloudrun/scripts/load-env.sh
```

Read a recent mixed stream of startup, DB, Redis, pub/sub, and subscription
events:

```bash
gcloud logging read \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${CLOUD_RUN_SERVICE}\" AND resource.labels.location=\"${CLOUD_RUN_REGION}\" AND (textPayload:\"app_bootstrap\" OR textPayload:\"database_connect\" OR textPayload:\"redis_client\" OR textPayload:\"chat_pubsub\" OR textPayload:\"graphql_subscription\")" \
  --project "${PROJECT_ID}" \
  --limit 100 \
  --order=desc \
  --format json
```

Read only boot and DB failures:

```bash
gcloud logging read \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${CLOUD_RUN_SERVICE}\" AND resource.labels.location=\"${CLOUD_RUN_REGION}\" AND (textPayload:\"app_bootstrap_failed\" OR textPayload:\"database_connect_failed\")" \
  --project "${PROJECT_ID}" \
  --limit 50 \
  --order=desc \
  --format json
```

Read only Redis and pub/sub failures:

```bash
gcloud logging read \
  "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${CLOUD_RUN_SERVICE}\" AND resource.labels.location=\"${CLOUD_RUN_REGION}\" AND (textPayload:\"redis_client_error\" OR textPayload:\"chat_pubsub_init_failed\" OR textPayload:\"chat_pubsub_publish_failed\" OR textPayload:\"chat_pubsub_deliver_failed\" OR textPayload:\"chat_pubsub_deliver_parse_failed\")" \
  --project "${PROJECT_ID}" \
  --limit 50 \
  --order=desc \
  --format json
```

## Roll Back The Backend To A Previous Cloud Run Revision

This is the fastest production rollback when a new backend revision is bad but a
previous one is still healthy.

1. Load the shared Cloud Run config:

```bash
source deploy/cloudrun/scripts/load-env.sh
```

2. List the recent revisions:

```bash
gcloud run revisions list \
  --project "${PROJECT_ID}" \
  --region "${CLOUD_RUN_REGION}" \
  --service "${CLOUD_RUN_SERVICE}"
```

3. Send all traffic to the last known good revision:

```bash
gcloud run services update-traffic "${CLOUD_RUN_SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${CLOUD_RUN_REGION}" \
  --to-revisions "REVISION_NAME=100"
```

4. Validate the rolled-back service:

```bash
SERVICE_URL="$(
  gcloud run services describe "${CLOUD_RUN_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${CLOUD_RUN_REGION}" \
    --format='value(status.url)'
)"

bash deploy/cloudrun/tests/validate-post-deploy-smoke.sh "${SERVICE_URL}"
```

5. If the rollback should become the new intended state, redeploy the desired
   commit or image instead of leaving traffic pinned manually forever.

## Roll Back Database Migrations

Use this only when the migration itself has a correct `down()` implementation
and the data impact is understood.

1. Load the shared Cloud Run config:

```bash
source deploy/cloudrun/scripts/load-env.sh
```

2. Inspect the current migration state:

```bash
cd apps/server
NODE_ENV=production \
DATABASE_URL_DIRECT="${DATABASE_URL_DIRECT}" \
DATABASE_SYNCHRONIZE=false \
DATABASE_SSL=true \
DATABASE_SSL_REJECT_UNAUTHORIZED=false \
npm run migration:show
```

3. Revert one migration step:

```bash
cd apps/server
NODE_ENV=production \
DATABASE_URL_DIRECT="${DATABASE_URL_DIRECT}" \
DATABASE_SYNCHRONIZE=false \
DATABASE_SSL=true \
DATABASE_SSL_REJECT_UNAUTHORIZED=false \
npm run migration:revert
```

4. Roll back backend traffic or redeploy the matching code if the reverted
   schema is no longer compatible with the currently running revision.

5. Run the post-deploy smoke test again after the service and schema are back in
   sync.

Important notes:

- `DATABASE_URL_DIRECT` is the admin-style migration connection on purpose.
- `DATABASE_URL` should stay the low-privilege runtime connection.
- revert one step at a time unless you are very sure about the full chain.

## Rotate Secrets

### Rotate The Low-Privilege Neon Runtime User

This is the preferred way to rotate the runtime database password:

```bash
bash deploy/cloudrun/scripts/create-neon-app-user.sh
```

That helper:

- rotates or recreates the runtime role password
- rewrites the pooled runtime `DATABASE_URL` override in `deploy/cloudrun/config/.env.local`
- syncs the updated `DATABASE_URL` into Secret Manager

Then redeploy the backend:

```bash
gh workflow run ci-release.yaml --ref main -f force_server=true
```

### Rotate `DATABASE_URL_DIRECT` Or `REDIS_URL`

1. Update the real value in `deploy/cloudrun/config/.env`.
2. If you use a machine-local override, update `deploy/cloudrun/config/.env.local`.
3. Sync secrets:

```bash
bash deploy/cloudrun/scripts/sync-secrets.sh
```

4. Redeploy the backend:

```bash
gh workflow run ci-release.yaml --ref main -f force_server=true
```

5. Validate the running service:

```bash
SERVICE_URL="$(
  gcloud run services describe "${CLOUD_RUN_SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${CLOUD_RUN_REGION}" \
    --format='value(status.url)'
)"

bash deploy/cloudrun/tests/validate-post-deploy-smoke.sh "${SERVICE_URL}"
```

## Keep Local Dev In Sync With Production Env Changes

When production environment requirements change, keep the devcontainer path in
sync using these rules:

- backend runtime env:
  - update `apps/server/.env.development` when local dev needs the same knob
  - update `deploy/cloudrun/config/.env.example` when Cloud Run needs the knob
  - update `.github/workflows/ci-release.yaml` if the value must be injected at deploy time
- backend secrets:
  - add the placeholder to `deploy/cloudrun/config/.env.example`
  - add the real value to `deploy/cloudrun/config/.env` or `.env.local`
  - update `deploy/cloudrun/scripts/sync-secrets.sh` if the new secret belongs in Secret Manager
- web app build-time env:
  - update `apps/webapp/.env.development`
  - update `apps/webapp/.env.production`
  - update the Cloudflare Pages project variables
- local infra parity:
  - if production adds a new local dependency, update `.devcontainer/docker-compose.localdb.yml`
  - keep PostgreSQL and Redis as the standard local stack
- validation:
  - update `deploy/cloudrun/tests/validate-post-deploy-smoke.sh` if the public GraphQL contract changes
  - rerun `npm run dev` in the devcontainer after env-shape changes
- docs:
  - update [README.md](../README.md) and [MIGRATION-TO-CLOUD-RUN-PROD.md](../../MIGRATION-TO-CLOUD-RUN-PROD.md) when the workflow or guarantees change
