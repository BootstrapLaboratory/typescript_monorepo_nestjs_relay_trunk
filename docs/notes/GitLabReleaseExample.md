# GitLab Release Example

This note shows one way to invoke the same Dagger release entrypoints from
GitLab CI after your packaging stage has produced the same deploy artifacts used
by [ci-release.yaml](../../.github/workflows/ci-release.yaml).

The goal is not to create a second release architecture. The GitLab example
reuses the same Dagger interface:

- `dagger call plan-release`
- `dagger call deploy-release`

It also uses the same repository metadata:

- [.dagger/deploy/services-mesh.yaml](../../.dagger/deploy/services-mesh.yaml)
- [.dagger/deploy/targets](../../.dagger/deploy/targets)

## Assumptions

This example assumes:

- a GitLab shell runner with `bash`, `curl`, `git`, `make`, `tar`, Docker, and
  Node 24 already available
- `/var/run/docker.sock` is available to the job when `server` is in
  `RELEASE_TARGETS_JSON`
- an earlier package stage has already produced:
  - `deploy-target-server.tgz` when `server` is selected
  - `apps/webapp/dist/` when `webapp` is selected
- the checked-out repository remote can push deploy tags back to `origin`

## Required Variables

Common variables:

- `RELEASE_TARGETS_JSON`
- `DEPLOY_ARTIFACT_PREFIX`
- `DEPLOY_TAG_PREFIX`
- `CLOUD_RUN_REGION`

Server variables when `server` is selected:

- `GCP_PROJECT_ID`
- `GCP_ARTIFACT_REGISTRY_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT`
- `CLOUD_RUN_CORS_ORIGIN`
- `GCP_CREDENTIALS_FILE`

`GCP_CREDENTIALS_FILE` should be a GitLab **file** variable so the environment
variable contains the temporary file path to the JSON credentials. The GitLab
wrapper writes that path into `GOOGLE_GHA_CREDS_PATH` inside the flat deploy env
file that Dagger consumes. The wrapper also passes `--host-workspace-dir` so
Dagger can convert absolute workspace-local mount paths into repo-relative
mounts. For the Docker socket, the wrapper first creates a repo-local symlink
under `.dagger/runtime/` and then writes that path into `DOCKER_SOCKET_FILE`.

Webapp variables when `webapp` is selected:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `WEBAPP_VITE_GRAPHQL_HTTP`
- `WEBAPP_VITE_GRAPHQL_WS`
- `WEBAPP_URL`

## Example `.gitlab-ci.yml`

The ready-to-adapt wrapper example lives at
[../../examples/gitlab/ci-release.gitlab-ci.yml](../../examples/gitlab/ci-release.gitlab-ci.yml).

It assumes your packaging job is named `package_release`; if your pipeline uses
another name, update the `needs` entries in the example file.

## Notes

- This example intentionally keeps packaging outside Dagger, matching the
  current GitHub release flow documented in
  [ReleaseFlow.md](./ReleaseFlow.md).
- `deploy-release` still calls the same portable target scripts under
  [scripts/ci](../../scripts/ci), so deploy semantics stay aligned across CI
  providers.
- Dagger runtime behavior now comes from repo metadata under
  [.dagger/deploy](../../.dagger/deploy), not from target-specific TypeScript
  executor modules.
- The current deploy-tag helper still writes the git identity as
  `github-actions[bot]`. That does not block GitLab execution, but if you want
  provider-specific tag attribution, that is a follow-up hardening task rather
  than part of this example.
