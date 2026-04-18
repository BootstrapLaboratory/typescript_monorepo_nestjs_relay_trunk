# Cloud Run Backend Deployment

## Local image build

Build the production backend container from the repo root:

```bash
npm run server:image:build:local
```

Equivalent direct command:

```bash
docker buildx build --pull --load -f apps/server/Dockerfile -t local/server-cloudrun:dev .
```

`--load` is intentional. In local environments that expose Podman through the
Docker CLI, a plain `docker build` may complete successfully but leave the
result only in the Buildx cache instead of loading a runnable local image tag.
The CI workflows still use the simpler standard-Docker build path because
GitHub Actions runs against a regular Docker daemon.

## Cloud provisioning

For the real Google Cloud, Neon, Redis, Secret Manager, and GitHub Actions
setup, use the provisioning runbook:

- [AUTOMATED_PROVISIONING_GUIDE.md](AUTOMATED_PROVISIONING_GUIDE.md)
- [PROVISIONING.md](PROVISIONING.md)
- [GCP_GUIDE.md](GCP_GUIDE.md)
- [NEON-UPSTASH-GUIDE.md](NEON-UPSTASH-GUIDE.md)

Helper scripts:

- [load-env.sh](load-env.sh)
- [bootstrap-gcp.sh](bootstrap-gcp.sh)
- [sync-secrets.sh](sync-secrets.sh)
- [configure-github-vars.sh](configure-github-vars.sh)

Helper tests:

- [tests/validate-multi-instance.sh](tests/validate-multi-instance.sh)
- [tests/validate-redeploy-reconnect.sh](tests/validate-redeploy-reconnect.sh)

Quick automation map:

- Google Cloud project, IAM, Artifact Registry, and Workload Identity: [bootstrap-gcp.sh](bootstrap-gcp.sh)
- Secret Manager secrets and secret access bindings: [sync-secrets.sh](sync-secrets.sh)
- GitHub repository variables: [configure-github-vars.sh](configure-github-vars.sh)
- Cloud Run image build, migrations, and deploy: [../../.github/workflows/deploy-cloud-run-backend.yaml](../../.github/workflows/deploy-cloud-run-backend.yaml)
- Neon and Upstash resource creation: still manual, documented in [NEON-UPSTASH-GUIDE.md](NEON-UPSTASH-GUIDE.md)
- Temporary scale-up and cross-instance fanout validation: [tests/validate-multi-instance.sh](tests/validate-multi-instance.sh)
- Hard outage plus redeploy reconnect diagnostic: [tests/validate-redeploy-reconnect.sh](tests/validate-redeploy-reconnect.sh)
  This is a useful live probe, but not a definitive browser reconnect approval test, because deleting a Cloud Run service does not always tear down an already-open websocket quickly enough to force a fresh reconnect cycle.

The provisioning scripts automatically load variables from:

- [deploy/cloudrun/.env](.env)
- [deploy/cloudrun/.env.example](.env.example)
- `deploy/cloudrun/.env.local` if you want a second local override file

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

## Notes

- The backend container is built with Rush/Nx in the builder stage.
- `rush deploy` is used to create a pruned runtime bundle before the final
  image is assembled.
- The final container starts from `/app/apps/server` and runs `node dist/main.js`.
- The deploy workflow requires `CLOUD_RUN_CORS_ORIGIN` so production does not
  silently fall back to wildcard CORS.
