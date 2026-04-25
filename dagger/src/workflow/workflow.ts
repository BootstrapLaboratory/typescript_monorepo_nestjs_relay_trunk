import { Directory, File, Socket } from "@dagger.io/dagger";

import { deployRelease } from "../stages/deploy/deploy-release.ts";
import { logSection } from "../logging/sections.ts";
import { validateMetadataContract } from "../metadata/dagger-metadata-contract.ts";
import { formatMetadataContractValidationResult } from "../metadata/metadata-contract.ts";
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
  toolchainImageProvider: string = "off",
  toolchainImagePolicy: string = "lazy",
  dockerSocket?: Socket,
): Promise<string> {
  logSection("Release workflow");
  logSection("Metadata contract");

  console.log(
    formatMetadataContractValidationResult(
      await validateMetadataContract(repo),
    ),
  );

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
    toolchainImageProvider,
    toolchainImagePolicy,
    dockerSocket,
  );
}
