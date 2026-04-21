import { dag, Directory, File, Socket } from "@dagger.io/dagger"

import type { DeployConfig } from "../model/deploy-config.ts"
import type { DeployTargetResult } from "../model/deploy-result.ts"
import type { ResolvedService } from "../model/service-mesh.ts"
import { getDeployExecutor } from "./executors/registry.ts"

function deployTagPrefixForEnvironment(environment: string): string {
  return `deploy/${environment}`
}

export async function executeTarget(
  repo: Directory,
  service: ResolvedService,
  gitSha: string,
  environment: string,
  dryRun: boolean,
  deployConfig: DeployConfig,
  wave: number,
  dockerSocket?: Socket,
  gcpCredentialsFile?: File,
): Promise<DeployTargetResult> {
  const deployExecutor = getDeployExecutor(service.executor)
  const deployExecutorContext = {
    deployConfig,
    dockerSocket,
    dryRun,
    environment,
    gcpCredentialsFile,
    gitSha,
    service,
  }
  const envVars = {
    ARTIFACT_PATH: service.artifact_path,
    DEPLOY_TAG_PREFIX: deployTagPrefixForEnvironment(environment),
    DRY_RUN: dryRun ? "1" : "0",
    GIT_SHA: gitSha,
    ...deployExecutor.buildEnvironment(deployExecutorContext),
  }
  const commandParts = [`bash ${service.deploy_script}`]
  const dryRunPreparationCommand = dryRun ? deployExecutor.dryRunPreparationCommand?.(deployExecutorContext) : undefined

  if (dryRunPreparationCommand) {
    commandParts.unshift(dryRunPreparationCommand)
  }

  console.log(`[deploy-release] wave ${wave}: starting ${service.target} via ${service.executor}`)

  let container = dag.container().from(deployExecutor.image).withDirectory("/workspace", repo).withWorkdir("/workspace")

  if (deployExecutor.prepareContainer) {
    container = deployExecutor.prepareContainer(container, deployExecutorContext)
  }

  for (const [name, value] of Object.entries(envVars)) {
    container = container.withEnvVariable(name, value)
  }

  const output = await container.withExec(["bash", "-lc", commandParts.join(" && ")]).stdout()

  console.log(`[deploy-release] wave ${wave}: finished ${service.target}`)

  return {
    artifactPath: envVars.ARTIFACT_PATH,
    executor: service.executor,
    output,
    status: "success",
    target: service.target,
    wave,
  }
}
