import type { Container } from "@dagger.io/dagger"

import { resolveConfigValue } from "../resolve-config-value.ts"
import type { DeployExecutor, DeployExecutorContext } from "./types.ts"

const SERVER_EXECUTOR_IMAGE = "node:24-bookworm-slim"
const SERVER_EXECUTOR_GCP_CREDENTIALS_PATH = "/tmp/gcp-credentials.json"

const SERVER_EXECUTOR_TOOLCHAIN_INSTALL = [
  "apt-get update",
  "apt-get install -y ca-certificates curl gnupg git docker.io",
  "install -d -m 0755 /etc/apt/keyrings",
  "curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /etc/apt/keyrings/google-cloud-cli.gpg",
  'echo "deb [signed-by=/etc/apt/keyrings/google-cloud-cli.gpg] https://packages.cloud.google.com/apt cloud-sdk main" > /etc/apt/sources.list.d/google-cloud-sdk.list',
  "apt-get update",
  "apt-get install -y google-cloud-cli",
].join(" && ")

function buildEnvironment(context: DeployExecutorContext): Record<string, string> {
  const serverConfig = context.deployConfig.server ?? {}

  return {
    CLOUD_RUN_CORS_ORIGIN: resolveConfigValue(
      serverConfig.cloudRunCorsOrigin,
      "server.cloudRunCorsOrigin",
      "https://example.invalid",
      context.dryRun,
      context.service.target,
    ),
    CLOUD_RUN_REGION: resolveConfigValue(
      serverConfig.cloudRunRegion,
      "server.cloudRunRegion",
      "europe-west4",
      context.dryRun,
      context.service.target,
    ),
    CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT: resolveConfigValue(
      serverConfig.cloudRunRuntimeServiceAccount,
      "server.cloudRunRuntimeServiceAccount",
      "dry-run-runtime@example.invalid",
      context.dryRun,
      context.service.target,
    ),
    CLOUD_RUN_SERVICE: resolveConfigValue(
      serverConfig.cloudRunService,
      "server.cloudRunService",
      "server",
      context.dryRun,
      context.service.target,
    ),
    GCP_ARTIFACT_REGISTRY_REPOSITORY: resolveConfigValue(
      serverConfig.gcpArtifactRegistryRepository,
      "server.gcpArtifactRegistryRepository",
      "dry-run-repository",
      context.dryRun,
      context.service.target,
    ),
    GCP_PROJECT_ID: resolveConfigValue(
      serverConfig.gcpProjectId,
      "server.gcpProjectId",
      "dry-run-project",
      context.dryRun,
      context.service.target,
    ),
  }
}

function prepareContainer(container: Container, context: DeployExecutorContext): Container {
  if (context.dryRun) {
    return container
  }

  let preparedContainer = container.withExec(["bash", "-lc", SERVER_EXECUTOR_TOOLCHAIN_INSTALL])

  if (!context.dockerSocket) {
    throw new Error('dockerSocket is required for live "deploy_server" execution.')
  }

  if (!context.gcpCredentialsFile) {
    throw new Error('gcpCredentialsFile is required for live "deploy_server" execution.')
  }

  preparedContainer = preparedContainer
    .withUnixSocket("/var/run/docker.sock", context.dockerSocket)
    .withEnvVariable("DOCKER_HOST", "unix:///var/run/docker.sock")
    .withMountedFile(SERVER_EXECUTOR_GCP_CREDENTIALS_PATH, context.gcpCredentialsFile)
    .withEnvVariable("GOOGLE_APPLICATION_CREDENTIALS", SERVER_EXECUTOR_GCP_CREDENTIALS_PATH)
    .withEnvVariable("CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE", SERVER_EXECUTOR_GCP_CREDENTIALS_PATH)
    .withEnvVariable("GOOGLE_GHA_CREDS_PATH", SERVER_EXECUTOR_GCP_CREDENTIALS_PATH)

  return preparedContainer
}

function dryRunPreparationCommand(context: DeployExecutorContext): string {
  return `mkdir -p ${context.service.artifact_path}/apps/server`
}

export const deployServerExecutor: DeployExecutor = {
  buildEnvironment,
  dryRunPreparationCommand,
  image: SERVER_EXECUTOR_IMAGE,
  prepareContainer,
}
