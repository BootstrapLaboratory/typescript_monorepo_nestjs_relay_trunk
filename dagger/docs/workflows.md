# Workflow Guide

## Local Framework Check

Use `self-check` before changing metadata, schemas, or Dagger source:

```sh
dagger call self-check --repo=..
```

## Local Provider-Off Dry Run

This exercises the full release composition without GHCR, cloud credentials, or
a Docker socket:

```sh
dagger call workflow \
  --repo=.. \
  --git-sha="$(git -C .. rev-parse HEAD)" \
  --event-name=workflow_call \
  --force-targets-json='["server","webapp"]' \
  --dry-run=true \
  --toolchain-image-provider=off \
  --rush-cache-provider=off \
  --source-mode=local_copy
```

Dry-runs use target `dry_run_defaults` for allowed runtime environment values.

## CI Release Workflow

A CI provider should keep provider-specific setup small, then call the Dagger
workflow. For GitHub Actions this means:

- Checkout the repository while this Dagger module lives inside the same repo.
- Install the Dagger CLI.
- Authenticate to external providers when live deploy targets need it.
- Write a deploy environment file with provider secrets and configuration.
- Call `dagger call workflow`.

The CI provider should pass source coordinates rather than doing release logic
itself. Dagger owns source acquisition, deploy tag fetching, detection, build,
package, deployment, and deploy tag updates.

## Recommended CI Shape

```sh
dagger call workflow \
  --repo=.. \
  --git-sha="$GITHUB_SHA" \
  --event-name="$GITHUB_EVENT_NAME" \
  --force-targets-json="$FORCE_TARGETS_JSON" \
  --pr-base-sha="$PR_BASE_SHA" \
  --deploy-tag-prefix="$DEPLOY_TAG_PREFIX" \
  --artifact-prefix="$DEPLOY_ARTIFACT_PREFIX" \
  --environment=prod \
  --dry-run=false \
  --deploy-env-file="$DEPLOY_ENV_FILE" \
  --host-workspace-dir="$GITHUB_WORKSPACE" \
  --toolchain-image-provider="$TOOLCHAIN_IMAGE_PROVIDER" \
  --toolchain-image-policy="$TOOLCHAIN_IMAGE_POLICY" \
  --rush-cache-provider="$RUSH_CACHE_PROVIDER" \
  --rush-cache-policy="$RUSH_CACHE_POLICY" \
  --source-mode=git \
  --source-repository-url="$SOURCE_REPOSITORY_URL" \
  --source-ref="$SOURCE_REF" \
  --source-auth-token-env=GITHUB_TOKEN \
  --docker-socket=/var/run/docker.sock
```

## Split Stage Workflows

The stage-level APIs exist for CI systems that need separate jobs. Prefer the
single `workflow` entrypoint unless there is a provider-specific reason to split
handoff between detect, build, package, and deploy.

When splitting stages, persist the CI plan and package manifest as files rather
than re-encoding stage state in CI-specific outputs.
