import { Directory, File, Socket } from "@dagger.io/dagger";

import { deployRelease } from "../stages/deploy/deploy-release.ts";
import { logSection } from "../logging/sections.ts";
import { runBuildPackageWorkflow } from "./build-package-runner.ts";

const PACKAGE_MANIFEST_PATH = ".dagger/runtime/package-manifest.json";

export async function workflow(
  repo: Directory,
  gitSha: string,
  eventName: string = "push",
  forceTargetsJson: string = "[]",
  prBaseSha: string = "",
  deployTagPrefix: string = "deploy/prod",
  artifactPrefix: string = "deploy-target",
  environment: string = "prod",
  dryRun: boolean = true,
  deployEnvFile?: File,
  hostWorkspaceDir: string = "",
  dockerSocket?: Socket,
): Promise<string> {
  logSection("Release workflow");

  const { ciPlan, repo: packagedRepo } = await runBuildPackageWorkflow(
    repo,
    eventName,
    forceTargetsJson,
    prBaseSha,
    deployTagPrefix,
    artifactPrefix,
  );

  console.log(
    `[workflow] mode=${ciPlan.mode} deploy_targets=${JSON.stringify(ciPlan.deploy_targets)} validate_targets=${JSON.stringify(ciPlan.validate_targets)}`,
  );

  return deployRelease(
    packagedRepo,
    gitSha,
    JSON.stringify(ciPlan.deploy_targets),
    environment,
    dryRun,
    deployEnvFile,
    packagedRepo.file(PACKAGE_MANIFEST_PATH),
    hostWorkspaceDir,
    dockerSocket,
  );
}
