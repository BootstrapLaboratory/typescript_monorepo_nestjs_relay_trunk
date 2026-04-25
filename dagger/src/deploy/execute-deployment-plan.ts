import { Directory, Socket } from "@dagger.io/dagger";
import type { DeploymentPlan } from "../model/deployment-plan.ts";
import type { DeployTargetResult } from "../model/deploy-result.ts";
import type { PackageManifest } from "../model/package-manifest.ts";
import { logSubsection } from "../logging/sections.ts";
import { executeTarget } from "./execute-target.ts";

export async function executeDeploymentPlan(
  repo: Directory,
  plan: DeploymentPlan,
  packageManifest: PackageManifest,
  gitSha: string,
  environment: string,
  dryRun: boolean,
  hostEnv: Record<string, string>,
  hostWorkspaceDir: string,
  dockerSocket?: Socket,
): Promise<DeployTargetResult[]> {
  const results: DeployTargetResult[] = [];

  for (const [index, wave] of plan.waves.entries()) {
    const waveNumber = index + 1;
    const waveTargets = wave.map((entry) => entry.target).join(", ");

    logSubsection(`Deploy wave ${waveNumber}: ${waveTargets || "(empty)"}`);
    console.log(
      `[deploy-release] wave ${waveNumber}: ${waveTargets || "(empty)"}`,
    );

    const waveResults = await Promise.all(
      wave.map(async (entry) => {
        try {
          const artifact = packageManifest.artifacts[entry.target];

          if (artifact === undefined) {
            throw new Error(
              `package manifest does not define artifact for target "${entry.target}".`,
            );
          }

          return await executeTarget(
            repo,
            entry.target,
            artifact,
            gitSha,
            environment,
            dryRun,
            hostEnv,
            hostWorkspaceDir,
            waveNumber,
            dockerSocket,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          throw new Error(
            `deploy-release failed for target "${entry.target}" in wave ${waveNumber}: ${message}`,
          );
        }
      }),
    );

    results.push(...waveResults);
  }

  return results;
}
