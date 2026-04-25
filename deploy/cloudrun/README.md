# Cloud Run Backend Deployment

## Local image build

Build the production backend container from the repo root:

```bash
npm run server:image:build:local
```

Equivalent direct command:

```bash
node common/scripts/install-run-rush.js build --to server
node common/scripts/install-run-rush.js deploy -p server -s server -t common/deploy/server --overwrite
docker buildx build --pull --load -f apps/server/Dockerfile -t local/server-cloudrun:dev common/deploy/server
```

`--load` is intentional. In local environments that expose Podman through the
Docker CLI, a plain `docker build` may complete successfully but leave the
result only in the Buildx cache instead of loading a runnable local image tag.
CI uses the same pruned deploy artifact as the Docker build context, with
BuildKit enabled for the standard Docker CLI.

## Cloud provisioning

For the real Google Cloud, Neon, Redis, Secret Manager, and GitHub Actions
setup, use the provisioning runbook:

- [AUTOMATED_PROVISIONING_GUIDE.md](docs/AUTOMATED_PROVISIONING_GUIDE.md)
- [PROVISIONING.md](docs/PROVISIONING.md)
- [GCP_GUIDE.md](docs/GCP_GUIDE.md)
- [NEON-UPSTASH-GUIDE.md](docs/NEON-UPSTASH-GUIDE.md)
- [MONITORING.md](docs/MONITORING.md)
- [OPERATIONS.md](docs/OPERATIONS.md)

Helper scripts:

- [load-env.sh](scripts/load-env.sh)
- [bootstrap-gcp.sh](scripts/bootstrap-gcp.sh)
- [create-neon-app-user.sh](scripts/create-neon-app-user.sh)
- [create-monitoring-email-channel.sh](scripts/create-monitoring-email-channel.sh)
- [sync-secrets.sh](scripts/sync-secrets.sh)
- [configure-github-vars.sh](scripts/configure-github-vars.sh)
- [setup-monitoring-alerts.sh](scripts/setup-monitoring-alerts.sh)

Helper tests:

- [tests/validate-post-deploy-smoke.sh](tests/validate-post-deploy-smoke.sh)
- [tests/validate-multi-instance.sh](tests/validate-multi-instance.sh)
- [tests/validate-redeploy-reconnect.sh](tests/validate-redeploy-reconnect.sh)

Quick automation map:

- Google Cloud project, IAM, Artifact Registry, and Workload Identity: [bootstrap-gcp.sh](scripts/bootstrap-gcp.sh)
- Neon least-privilege runtime role creation and `DATABASE_URL` rotation: [create-neon-app-user.sh](scripts/create-neon-app-user.sh)
- Cloud Monitoring email channel helper: [create-monitoring-email-channel.sh](scripts/create-monitoring-email-channel.sh)
- Cloud Run uptime checks, log-based metrics, and alert policies: [setup-monitoring-alerts.sh](scripts/setup-monitoring-alerts.sh)
- Secret Manager secrets and secret access bindings: [sync-secrets.sh](scripts/sync-secrets.sh)
- GitHub repository variables: [configure-github-vars.sh](scripts/configure-github-vars.sh)
- Unified build, backend deploy, and webapp deploy orchestration: [../../.github/workflows/ci-release.yaml](../../.github/workflows/ci-release.yaml)
- Neon and Upstash resource creation: still manual, documented in [NEON-UPSTASH-GUIDE.md](docs/NEON-UPSTASH-GUIDE.md)
- Post-deploy health/query/mutation/subscription smoke validation: [tests/validate-post-deploy-smoke.sh](tests/validate-post-deploy-smoke.sh)
- Temporary scale-up and cross-instance fanout validation: [tests/validate-multi-instance.sh](tests/validate-multi-instance.sh)
- Hard outage plus redeploy reconnect diagnostic: [tests/validate-redeploy-reconnect.sh](tests/validate-redeploy-reconnect.sh)
  This is a useful live probe, but not a definitive browser reconnect approval test, because deleting a Cloud Run service does not always tear down an already-open websocket quickly enough to force a fresh reconnect cycle.

Operational runbooks:

- monitoring and alert setup: [MONITORING.md](docs/MONITORING.md)
- revision rollback, migration rollback, secret rotation, and log queries: [OPERATIONS.md](docs/OPERATIONS.md)

The provisioning scripts automatically load variables from:

- [deploy/cloudrun/config/.env](config/.env)
- [deploy/cloudrun/config/.env.example](config/.env.example)

## GitHub Actions configuration

The Cloud Run deployment workflow expects these GitHub repository variables:

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `GCP_ARTIFACT_REGISTRY_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT`
- `CLOUD_RUN_CORS_ORIGIN`

The workflow uses `europe-west4` by default for both the Cloud Run region and
the Artifact Registry hostname. If you later change regions, update the
workflow to match.

## Secret Manager expectations

The deploy workflow assumes Cloud Run runtime secrets are stored in Google
Secret Manager with these names:

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `REDIS_URL`

The workflow uses `DATABASE_URL_DIRECT` to run TypeORM migrations before the
deploy. The runtime service receives `DATABASE_URL` and `REDIS_URL` as injected
environment variables from Secret Manager.

That split is intentional:

- `DATABASE_URL` should be the pooled low-privilege runtime user
- `DATABASE_URL_DIRECT` should remain the direct higher-privilege migration user

## Optional For Adopters With Their Own Domain

This example project intentionally stops at the generated Cloud Run `run.app`
URL.

If you adopt this stack for a real project and own a backend domain such as
`api.example.com`, treat this as the follow-up checklist:

- map the custom backend domain to Cloud Run
- point the frontend `VITE_GRAPHQL_HTTP` and `VITE_GRAPHQL_WS` values at that custom domain
- keep `CLOUD_RUN_CORS_ORIGIN` aligned with the real frontend origin
- verify `https://<your-api-domain>/health` and `https://<your-api-domain>/graphql`
- verify GraphQL subscriptions over `wss://<your-api-domain>/graphql`
- if the frontend also moves to a custom domain, coordinate that change with [deploy/cloudflare-pages/README.md](../cloudflare-pages/README.md)

## Notes

- The backend container is built with Rush in the builder stage.
- `rush deploy` is used to create a pruned runtime bundle before the final
  image is assembled.
- The final container starts from `/app/apps/server` and runs `node dist/main.js`.
- The deploy workflow requires `CLOUD_RUN_CORS_ORIGIN` so production does not
  silently fall back to wildcard CORS.
