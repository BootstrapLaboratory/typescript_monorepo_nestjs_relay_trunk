# GitLab Release Example

This note shows one way to invoke the same Dagger release entrypoints from
GitLab CI after your packaging stage has produced the same deploy artifacts used
by [ci-release.yaml](../../.github/workflows/ci-release.yaml).

The goal is not to create a second release architecture. The GitLab example
reuses the same Dagger interface:

- `dagger call plan-release`
- `dagger call deploy-release`

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
variable contains the temporary file path to the JSON credentials.

Webapp variables when `webapp` is selected:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `WEBAPP_VITE_GRAPHQL_HTTP`
- `WEBAPP_VITE_GRAPHQL_WS`
- `WEBAPP_URL`

## Example `.gitlab-ci.yml`

This snippet assumes your packaging job is named `package_release`. Rename the
`needs` entries if your pipeline uses a different job name.

```yaml
stages:
  - package
  - plan_deploy
  - deploy

variables:
  DEPLOY_ARTIFACT_PREFIX: "deploy-target"
  DEPLOY_TAG_PREFIX: "deploy/prod"
  CLOUD_RUN_REGION: "europe-west4"
  DAGGER_NO_NAG: "1"
  GIT_DEPTH: "0"

.with_dagger:
  before_script:
    - mkdir -p "${CI_PROJECT_DIR}/.bin"
    - curl -fsSL https://dl.dagger.io/dagger/install.sh | BIN_DIR="${CI_PROJECT_DIR}/.bin" sh
    - export PATH="${CI_PROJECT_DIR}/.bin:${PATH}"
    - git fetch --force --tags origin

plan_deploy:
  stage: plan_deploy
  extends: .with_dagger
  needs:
    - job: package_release
      artifacts: true
  script:
    - cd dagger
    - dagger develop
    - deployment_plan_json="$(dagger call plan-release --repo=.. --release-targets-json="${RELEASE_TARGETS_JSON}")"
    - printf '%s\n' "${deployment_plan_json}" | tee "${CI_PROJECT_DIR}/deployment-plan.json"
  artifacts:
    paths:
      - deployment-plan.json

deploy_release:
  stage: deploy
  extends: .with_dagger
  needs:
    - job: package_release
      artifacts: true
    - job: plan_deploy
      artifacts: true
  script:
    - |
      if [[ "${RELEASE_TARGETS_JSON}" == *'"server"'* ]]; then
        make ci-deploy-extract-target-artifact TARGET=server
      fi
    - cd dagger
    - dagger develop
    - cat "${CI_PROJECT_DIR}/deployment-plan.json"
    - |
      cat > "${CI_PROJECT_DIR}/dagger-deploy-config.json" <<EOF
      {
        "server": {
          "artifactPath": "/workspace/common/deploy/server",
          "gcpProjectId": "${GCP_PROJECT_ID}",
          "gcpArtifactRegistryRepository": "${GCP_ARTIFACT_REGISTRY_REPOSITORY}",
          "cloudRunService": "${CLOUD_RUN_SERVICE}",
          "cloudRunRuntimeServiceAccount": "${CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT}",
          "cloudRunCorsOrigin": "${CLOUD_RUN_CORS_ORIGIN}",
          "cloudRunRegion": "${CLOUD_RUN_REGION}"
        },
        "webapp": {
          "artifactPath": "/workspace/apps/webapp/dist",
          "cloudflareApiToken": "${CLOUDFLARE_API_TOKEN}",
          "cloudflareAccountId": "${CLOUDFLARE_ACCOUNT_ID}",
          "cloudflarePagesProjectName": "${CLOUDFLARE_PAGES_PROJECT_NAME}",
          "webappGraphqlHttp": "${WEBAPP_VITE_GRAPHQL_HTTP}",
          "webappGraphqlWs": "${WEBAPP_VITE_GRAPHQL_WS}",
          "webappUrl": "${WEBAPP_URL}"
        }
      }
      EOF
    - |
      cmd=(
        dagger call deploy-release
        --repo=..
        --git-sha="${CI_COMMIT_SHA}"
        --release-targets-json="${RELEASE_TARGETS_JSON}"
        --environment=prod
        --dry-run=false
        --deploy-config-file="${CI_PROJECT_DIR}/dagger-deploy-config.json"
      )

      if [[ "${RELEASE_TARGETS_JSON}" == *'"server"'* ]]; then
        cmd+=(--docker-socket=/var/run/docker.sock)
        cmd+=(--gcp-credentials-file="${GCP_CREDENTIALS_FILE}")
      fi

      "${cmd[@]}"
```

## Notes

- This example intentionally keeps packaging outside Dagger, matching the
  current GitHub release flow documented in
  [ReleaseFlow.md](./ReleaseFlow.md).
- `deploy-release` still calls the same portable target scripts under
  [scripts/ci](../../scripts/ci), so deploy semantics stay aligned across CI
  providers.
- The current deploy-tag helper still writes the git identity as
  `github-actions[bot]`. That does not block GitLab execution, but if you want
  provider-specific tag attribution, that is a follow-up hardening task rather
  than part of this example.
