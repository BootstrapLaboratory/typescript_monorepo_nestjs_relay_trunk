import { Directory } from "@dagger.io/dagger"
import type { DeploymentPlan } from "../model/deployment-plan.ts"
import type { DeployTargetResult } from "../model/deploy-result.ts"
import { executeTarget } from "./execute-target.ts"

export async function executeDeploymentPlan(
  repo: Directory,
  plan: DeploymentPlan,
  gitSha: string,
  environment: string,
  dryRun: boolean,
  hostEnv: Record<string, string>,
  hostWorkspaceDir: string,
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
            entry.target,
            gitSha,
            environment,
            dryRun,
            hostEnv,
            hostWorkspaceDir,
            waveNumber,
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
