import { Directory, File, Socket } from "@dagger.io/dagger"

import { parseDeployConfig } from "../model/deploy-config.ts"
import type { DeployReleaseResult } from "../model/deploy-result.ts"
import { buildDeploymentPlan } from "../planning/build-deployment-plan.ts"
import { parseReleaseTargets } from "../planning/parse-release-targets.ts"
import { parseServicesMesh } from "../planning/parse-services-mesh.ts"
import { executeDeploymentPlan } from "./execute-deployment-plan.ts"

async function loadServicesMesh(repo: Directory) {
  return parseServicesMesh(await repo.file("deploy/services-mesh.yaml").contents())
}

export async function planRelease(repo: Directory, releaseTargetsJson: string = "[]"): Promise<string> {
  const servicesMesh = await loadServicesMesh(repo)
  const deploymentPlan = buildDeploymentPlan(servicesMesh, parseReleaseTargets(releaseTargetsJson))

  return JSON.stringify(deploymentPlan, null, 2)
}

export async function deployRelease(
  repo: Directory,
  gitSha: string,
  releaseTargetsJson: string = "[]",
  environment: string = "prod",
  dryRun: boolean = true,
  deployConfigFile?: File,
  dockerSocket?: Socket,
  gcpCredentialsFile?: File,
): Promise<string> {
  const servicesMesh = await loadServicesMesh(repo)
  const deploymentPlan = buildDeploymentPlan(servicesMesh, parseReleaseTargets(releaseTargetsJson))
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
    servicesMesh,
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
