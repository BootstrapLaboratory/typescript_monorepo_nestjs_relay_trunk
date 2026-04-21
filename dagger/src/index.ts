import { dag, Directory, File, func, object, Socket } from "@dagger.io/dagger"

import type { DeploymentPlan, DeploymentWaveEntry } from "./planner.ts"
import { buildDeploymentPlan, parseReleaseTargets, parseServicesMesh } from "./planner.ts"

const EXECUTOR_IMAGE = "node:24-bookworm-slim"
const SERVER_EXECUTOR_TOOLS_IMAGE = "node:24-bookworm-slim"
const SERVER_EXECUTOR_GCP_CREDENTIALS_PATH = "/tmp/gcp-credentials.json"

type DeployTargetResult = {
  artifactPath: string
  executor: string
  output: string
  status: "success"
  target: string
  wave: number
}

type DeployReleaseResult = {
  dryRun: boolean
  environment: string
  plan: DeploymentPlan
  results: DeployTargetResult[]
}

type ServerDeployConfig = {
  artifactPath?: string
  cloudRunCorsOrigin?: string
  cloudRunRegion?: string
  cloudRunRuntimeServiceAccount?: string
  cloudRunService?: string
  gcpArtifactRegistryRepository?: string
  gcpProjectId?: string
}

type WebappDeployConfig = {
  artifactPath?: string
  cloudflareAccountId?: string
  cloudflareApiToken?: string
  cloudflarePagesProjectName?: string
  webappGraphqlHttp?: string
  webappGraphqlWs?: string
  webappUrl?: string
}

type DeployConfig = {
  server?: ServerDeployConfig
  webapp?: WebappDeployConfig
}

const SERVER_EXECUTOR_TOOLCHAIN_INSTALL = [
  "apt-get update",
  "apt-get install -y ca-certificates curl gnupg git docker.io",
  "install -d -m 0755 /etc/apt/keyrings",
  "curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /etc/apt/keyrings/google-cloud-cli.gpg",
  'echo "deb [signed-by=/etc/apt/keyrings/google-cloud-cli.gpg] https://packages.cloud.google.com/apt cloud-sdk main" > /etc/apt/sources.list.d/google-cloud-sdk.list',
  "apt-get update",
  "apt-get install -y google-cloud-cli",
].join(" && ")

function computeDeploymentPlan(servicesMeshYaml: string, releaseTargetsJson: string): DeploymentPlan {
  const selectedTargets = parseReleaseTargets(releaseTargetsJson)
  const servicesMesh = parseServicesMesh(servicesMeshYaml)

  return buildDeploymentPlan(servicesMesh, selectedTargets)
}

function deployTagPrefixForEnvironment(environment: string): string {
  return `deploy/${environment}`
}

function parseDeployConfig(deployConfigJson: string): DeployConfig {
  const parsedValue = JSON.parse(deployConfigJson)

  if (typeof parsedValue !== "object" || parsedValue === null || Array.isArray(parsedValue)) {
    throw new Error("deployConfigFile must contain a top-level JSON object.")
  }

  return parsedValue as DeployConfig
}

function resolveArtifactPath(target: string, deployConfig: DeployConfig): string {
  switch (target) {
    case "server":
      return deployConfig.server?.artifactPath ?? "/workspace/common/deploy/server"
    case "webapp":
      return deployConfig.webapp?.artifactPath ?? "/workspace/apps/webapp/dist"
    default:
      throw new Error(`Unsupported release target "${target}".`)
  }
}

function resolveConfigValue(
  rawValue: string | undefined,
  name: string,
  dryRunDefault: string,
  dryRun: boolean,
  target: string,
): string {
  if (rawValue !== undefined && rawValue.length > 0) {
    return rawValue
  }

  if (dryRun) {
    return dryRunDefault
  }

  throw new Error(`Missing required deploy config value "${name}" for target "${target}".`)
}

function targetScriptPath(target: string): string {
  switch (target) {
    case "server":
      return "scripts/ci/deploy-server.sh"
    case "webapp":
      return "scripts/ci/deploy-webapp.sh"
    default:
      throw new Error(`Unsupported release target "${target}".`)
  }
}

function dryRunPreparationCommand(target: string): string {
  switch (target) {
    case "server":
      return "mkdir -p /workspace/common/deploy/server/apps/server"
    case "webapp":
      return "mkdir -p /workspace/apps/webapp/dist"
    default:
      throw new Error(`Unsupported release target "${target}".`)
  }
}

function targetEnvironment(
  entry: DeploymentWaveEntry,
  gitSha: string,
  environment: string,
  dryRun: boolean,
  deployConfig: DeployConfig,
): Record<string, string> {
  const baseEnvironment = {
    ARTIFACT_PATH: resolveArtifactPath(entry.target, deployConfig),
    DEPLOY_TAG_PREFIX: deployTagPrefixForEnvironment(environment),
    DRY_RUN: dryRun ? "1" : "0",
    GIT_SHA: gitSha,
  }

  switch (entry.executor) {
    case "server": {
      const serverConfig = deployConfig.server ?? {}

      return {
        ...baseEnvironment,
        CLOUD_RUN_CORS_ORIGIN: resolveConfigValue(
          serverConfig.cloudRunCorsOrigin,
          "server.cloudRunCorsOrigin",
          "https://example.invalid",
          dryRun,
          entry.target,
        ),
        CLOUD_RUN_REGION: resolveConfigValue(
          serverConfig.cloudRunRegion,
          "server.cloudRunRegion",
          "europe-west4",
          dryRun,
          entry.target,
        ),
        CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT: resolveConfigValue(
          serverConfig.cloudRunRuntimeServiceAccount,
          "server.cloudRunRuntimeServiceAccount",
          "dry-run-runtime@example.invalid",
          dryRun,
          entry.target,
        ),
        CLOUD_RUN_SERVICE: resolveConfigValue(
          serverConfig.cloudRunService,
          "server.cloudRunService",
          "server",
          dryRun,
          entry.target,
        ),
        GCP_ARTIFACT_REGISTRY_REPOSITORY: resolveConfigValue(
          serverConfig.gcpArtifactRegistryRepository,
          "server.gcpArtifactRegistryRepository",
          "dry-run-repository",
          dryRun,
          entry.target,
        ),
        GCP_PROJECT_ID: resolveConfigValue(
          serverConfig.gcpProjectId,
          "server.gcpProjectId",
          "dry-run-project",
          dryRun,
          entry.target,
        ),
      }
    }
    case "webapp": {
      const webappConfig = deployConfig.webapp ?? {}
      const cloudflarePagesProjectName = resolveConfigValue(
        webappConfig.cloudflarePagesProjectName,
        "webapp.cloudflarePagesProjectName",
        "webapp",
        dryRun,
        entry.target,
      )

      return {
        ...baseEnvironment,
        CLOUDFLARE_ACCOUNT_ID: resolveConfigValue(
          webappConfig.cloudflareAccountId,
          "webapp.cloudflareAccountId",
          "dry-run-account",
          dryRun,
          entry.target,
        ),
        CLOUDFLARE_API_TOKEN: resolveConfigValue(
          webappConfig.cloudflareApiToken,
          "webapp.cloudflareApiToken",
          "dry-run-token",
          dryRun,
          entry.target,
        ),
        CLOUDFLARE_PAGES_PROJECT_NAME: cloudflarePagesProjectName,
        WEBAPP_URL: resolveConfigValue(
          webappConfig.webappUrl,
          "webapp.webappUrl",
          `https://${cloudflarePagesProjectName}.pages.dev`,
          dryRun,
          entry.target,
        ),
        WEBAPP_VITE_GRAPHQL_HTTP: resolveConfigValue(
          webappConfig.webappGraphqlHttp,
          "webapp.webappGraphqlHttp",
          "https://api.example.invalid/graphql",
          dryRun,
          entry.target,
        ),
        WEBAPP_VITE_GRAPHQL_WS: resolveConfigValue(
          webappConfig.webappGraphqlWs,
          "webapp.webappGraphqlWs",
          "wss://api.example.invalid/graphql",
          dryRun,
          entry.target,
        ),
      }
    }
    default:
      throw new Error(`Unsupported deploy executor "${entry.executor}" for target "${entry.target}".`)
  }
}

async function executeTarget(
  repo: Directory,
  entry: DeploymentWaveEntry,
  gitSha: string,
  environment: string,
  dryRun: boolean,
  deployConfig: DeployConfig,
  wave: number,
  dockerSocket?: Socket,
  gcpCredentialsFile?: File,
): Promise<DeployTargetResult> {
  const envVars = targetEnvironment(entry, gitSha, environment, dryRun, deployConfig)
  const scriptPath = targetScriptPath(entry.target)
  const commandParts = dryRun ? [dryRunPreparationCommand(entry.target), `bash ${scriptPath}`] : [`bash ${scriptPath}`]

  console.log(`[deploy-release] wave ${wave}: starting ${entry.target} via ${entry.executor}`)

  let container = dag
    .container()
    .from(entry.executor === "server" ? SERVER_EXECUTOR_TOOLS_IMAGE : EXECUTOR_IMAGE)
    .withDirectory("/workspace", repo)
    .withWorkdir("/workspace")

  if (entry.executor === "server" && !dryRun) {
    container = container.withExec(["bash", "-lc", SERVER_EXECUTOR_TOOLCHAIN_INSTALL])

    if (!dockerSocket) {
      throw new Error('dockerSocket is required for live "server" deploy-release execution.')
    }

    if (!gcpCredentialsFile) {
      throw new Error('gcpCredentialsFile is required for live "server" deploy-release execution.')
    }

    container = container
      .withUnixSocket("/var/run/docker.sock", dockerSocket)
      .withEnvVariable("DOCKER_HOST", "unix:///var/run/docker.sock")
      .withMountedFile(SERVER_EXECUTOR_GCP_CREDENTIALS_PATH, gcpCredentialsFile)
      .withEnvVariable("GOOGLE_APPLICATION_CREDENTIALS", SERVER_EXECUTOR_GCP_CREDENTIALS_PATH)
      .withEnvVariable("CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE", SERVER_EXECUTOR_GCP_CREDENTIALS_PATH)
      .withEnvVariable("GOOGLE_GHA_CREDS_PATH", SERVER_EXECUTOR_GCP_CREDENTIALS_PATH)
  }

  for (const [name, value] of Object.entries(envVars)) {
    container = container.withEnvVariable(name, value)
  }

  const output = await container.withExec(["bash", "-lc", commandParts.join(" && ")]).stdout()

  console.log(`[deploy-release] wave ${wave}: finished ${entry.target}`)

  return {
    artifactPath: envVars.ARTIFACT_PATH,
    executor: entry.executor,
    output,
    status: "success",
    target: entry.target,
    wave,
  }
}

async function executeDeploymentPlan(
  repo: Directory,
  plan: DeploymentPlan,
  gitSha: string,
  environment: string,
  dryRun: boolean,
  deployConfig: DeployConfig,
  dockerSocket?: Socket,
  gcpCredentialsFile?: File,
): Promise<DeployTargetResult[]> {
  const results: DeployTargetResult[] = []

  for (const [index, wave] of plan.waves.entries()) {
    const waveNumber = index + 1
    const waveTargets = wave.map((entry) => entry.target).join(", ")

    console.log(`[deploy-release] wave ${waveNumber}: ${waveTargets || "(empty)"}`)

    const waveResults = await Promise.all(
      wave.map(async (entry) => {
        try {
          return await executeTarget(
            repo,
            entry,
            gitSha,
            environment,
            dryRun,
            deployConfig,
            waveNumber,
            dockerSocket,
            gcpCredentialsFile,
          )
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          throw new Error(`deploy-release failed for target "${entry.target}" in wave ${waveNumber}: ${message}`)
        }
      }),
    )

    results.push(...waveResults)
  }

  return results
}

@object()
export class ReleaseOrchestrator {
  /**
   * Returns a simple marker proving the Dagger module is callable.
   */
  @func()
  ping(): string {
    return "release-orchestrator ready"
  }

  /**
   * Validates and normalizes a release target selection for future planning work.
   */
  @func()
  describeReleaseTargets(releaseTargetsJson: string = "[]"): string {
    const normalizedTargets = parseReleaseTargets(releaseTargetsJson)

    if (normalizedTargets.length === 0) {
      return "No release targets selected."
    }

    return `Selected release targets: ${normalizedTargets.join(", ")}`
  }

  /**
   * Computes deployment waves from the canonical services mesh and selected release targets.
   */
  @func()
  async planRelease(repo: Directory, releaseTargetsJson: string = "[]"): Promise<string> {
    const servicesMeshYaml = await repo.file("deploy/services-mesh.yaml").contents()
    const deploymentPlan = computeDeploymentPlan(servicesMeshYaml, releaseTargetsJson)

    return JSON.stringify(deploymentPlan, null, 2)
  }

  /**
   * Executes the release plan in wave order, dispatching target-specific executors in parallel within each wave.
   */
  @func()
  async deployRelease(
    repo: Directory,
    gitSha: string,
    releaseTargetsJson: string = "[]",
    environment: string = "prod",
    dryRun: boolean = true,
    deployConfigFile?: File,
    dockerSocket?: Socket,
    gcpCredentialsFile?: File,
  ): Promise<string> {
    const servicesMeshYaml = await repo.file("deploy/services-mesh.yaml").contents()
    const deploymentPlan = computeDeploymentPlan(servicesMeshYaml, releaseTargetsJson)
    const deployConfig = deployConfigFile ? parseDeployConfig(await deployConfigFile.contents()) : {}

    if (deploymentPlan.selectedTargets.length === 0) {
      const emptyResult: DeployReleaseResult = {
        dryRun,
        environment,
        plan: deploymentPlan,
        results: [],
      }

      console.log("[deploy-release] no release targets selected")

      return JSON.stringify(emptyResult, null, 2)
    }

    console.log(
      `[deploy-release] selected targets: ${deploymentPlan.selectedTargets.join(", ")} | environment=${environment} | dryRun=${dryRun}`,
    )

    const results = await executeDeploymentPlan(
      repo,
      deploymentPlan,
      gitSha,
      environment,
      dryRun,
      deployConfig,
      dockerSocket,
      gcpCredentialsFile,
    )
    const deployResult: DeployReleaseResult = {
      dryRun,
      environment,
      plan: deploymentPlan,
      results,
    }

    return JSON.stringify(deployResult, null, 2)
  }
}
