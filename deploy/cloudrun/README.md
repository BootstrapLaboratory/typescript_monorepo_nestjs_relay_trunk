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

## GitHub Actions configuration

The Cloud Run deployment workflow expects these GitHub repository variables:

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`
- `GCP_ARTIFACT_REGISTRY_REPOSITORY`
- `CLOUD_RUN_SERVICE`
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
