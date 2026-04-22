import { Directory, File } from "@dagger.io/dagger"
import type { DeployReleaseResult } from "../model/deploy-result.ts"
import { buildDeploymentPlan } from "../planning/build-deployment-plan.ts"
import { parseReleaseTargets } from "../planning/parse-release-targets.ts"
import { executeDeploymentPlan } from "./execute-deployment-plan.ts"
import { loadServicesMesh } from "./load-deploy-metadata.ts"
import { parseDeployEnvFile } from "./runtime-env.ts"

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
  deployEnvFile?: File,
  hostWorkspaceDir: string = "",
): Promise<string> {
  const hostEnv = deployEnvFile ? parseDeployEnvFile(await deployEnvFile.contents()) : {}
  const servicesMesh = await loadServicesMesh(repo)
  const deploymentPlan = buildDeploymentPlan(servicesMesh, parseReleaseTargets(releaseTargetsJson))

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
    hostEnv,
    hostWorkspaceDir,
  )
  const deployResult: DeployReleaseResult = {
    dryRun,
    environment,
    plan: deploymentPlan,
    results,
  }

  return JSON.stringify(deployResult, null, 2)
}
