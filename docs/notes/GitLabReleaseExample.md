# GitLab Release Example

This note shows one way to invoke the external Rush Delivery Dagger module from
GitLab CI. GitHub Actions is the supported production path for this repository,
but the metadata contract is CI-provider neutral.

The GitLab example uses the same repository metadata:

- [.dagger/deploy/services-mesh.yaml](../../.dagger/deploy/services-mesh.yaml)
- [.dagger/deploy/targets](../../.dagger/deploy/targets)
- [.dagger/package/targets](../../.dagger/package/targets)
- [.dagger/validate/targets](../../.dagger/validate/targets)

## Assumptions

This example assumes:

- a GitLab runner with `bash`, `curl`, Docker, and `/var/run/docker.sock`
  available
- a token that can read the repository and tags
- provider variables are available as GitLab CI variables
- `GCP_CREDENTIALS_FILE` is a GitLab file variable when `server` can deploy

## Required Variables

Common variables:

- `SOURCE_REPOSITORY_URL`
- `SOURCE_AUTH_TOKEN`
- `DEPLOY_ARTIFACT_PREFIX`
- `CLOUD_RUN_REGION`

Server variables:

- `GCP_PROJECT_ID`
- `GCP_ARTIFACT_REGISTRY_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT`
- `CLOUD_RUN_CORS_ORIGIN`
- `GCP_CREDENTIALS_FILE`

Webapp variables:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `WEBAPP_VITE_GRAPHQL_HTTP`
- `WEBAPP_VITE_GRAPHQL_WS`
- `WEBAPP_URL`

## Example `.gitlab-ci.yml`

The ready-to-adapt wrapper example lives at
[../../examples/gitlab/ci-release.gitlab-ci.yml](../../examples/gitlab/ci-release.gitlab-ci.yml).

The example calls:

```bash
dagger -m github.com/BootstrapLaboratory/rush-delivery@v0.3.3 call workflow
```

and passes `source-mode=git`, so Rush Delivery owns source acquisition the same
way it does in GitHub Actions.

## Notes

- The GitLab example is intentionally small and adapter-shaped. It prepares
  runtime files and deploy env, then delegates detect, build, package, deploy,
  and tag updates to Rush Delivery.
- Deploy semantics stay aligned with GitHub Actions because both providers use
  the same `.dagger` metadata and provider scripts.
- If this repository starts using GitLab in production, prefer moving any
  GitLab-specific hardening into the example wrapper rather than adding
  provider-specific behavior to app metadata.
