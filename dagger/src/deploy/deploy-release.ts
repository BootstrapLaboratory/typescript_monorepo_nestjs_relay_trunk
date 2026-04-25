import { Directory, File, Socket } from "@dagger.io/dagger";
import type { DeployReleaseResult } from "../model/deploy-result.ts";
import { buildDeploymentPlan } from "../planning/build-deployment-plan.ts";
import { parseReleaseTargets } from "../planning/parse-release-targets.ts";
import { executeDeploymentPlan } from "./execute-deployment-plan.ts";
import { loadServicesMesh } from "./load-deploy-metadata.ts";
import { parsePackageManifest } from "../package-stage/package-manifest.ts";
import { parseDeployEnvFile } from "./runtime-env.ts";

async function buildReleasePlan(
  repo: Directory,
  releaseTargetsJson: string = "[]",
): Promise<ReturnType<typeof buildDeploymentPlan>> {
  const servicesMesh = await loadServicesMesh(repo);
  return buildDeploymentPlan(
    servicesMesh,
    parseReleaseTargets(releaseTargetsJson),
  );
}

export async function deployRelease(
  repo: Directory,
  gitSha: string,
  releaseTargetsJson: string = "[]",
  environment: string = "prod",
  dryRun: boolean = true,
  deployEnvFile?: File,
  packageManifestFile?: File,
  hostWorkspaceDir: string = "",
  dockerSocket?: Socket,
): Promise<string> {
  const hostEnv = deployEnvFile
    ? parseDeployEnvFile(await deployEnvFile.contents())
    : {};
  const deploymentPlan = await buildReleasePlan(repo, releaseTargetsJson);
  const packageManifest =
    packageManifestFile === undefined
      ? undefined
      : parsePackageManifest(await packageManifestFile.contents());

  if (deploymentPlan.selectedTargets.length === 0) {
    const emptyResult: DeployReleaseResult = {
      dryRun,
      environment,
      plan: deploymentPlan,
      results: [],
    };

    console.log("[deploy-release] no release targets selected");

    return JSON.stringify(emptyResult, null, 2);
  }

  if (packageManifest === undefined) {
    throw new Error(
      "packageManifestFile is required when release targets are selected.",
    );
  }

  console.log(
    `[deploy-release] selected targets: ${deploymentPlan.selectedTargets.join(", ")} | environment=${environment} | dryRun=${dryRun}`,
  );
  console.log(JSON.stringify(deploymentPlan, null, 2));

  const results = await executeDeploymentPlan(
    repo,
    deploymentPlan,
    packageManifest,
    gitSha,
    environment,
    dryRun,
    hostEnv,
    hostWorkspaceDir,
    dockerSocket,
  );
  const deployResult: DeployReleaseResult = {
    dryRun,
    environment,
    plan: deploymentPlan,
    results,
  };

  return JSON.stringify(deployResult, null, 2);
}
