import { Directory, File, Socket } from "@dagger.io/dagger";

import { parseCiPlan } from "../ci-plan/parse-ci-plan.ts";
import { deployRelease } from "../deploy/deploy-release.ts";
import { detect } from "../detect/detect.ts";
import { buildAndPackageDeployTargets } from "../package-stage/build-and-package-deploy-targets.ts";

const CI_PLAN_PATH = ".dagger/runtime/ci-plan.json";
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
  const ciPlanJson = await detect(
    repo,
    eventName,
    forceTargetsJson,
    prBaseSha,
    deployTagPrefix,
  );
  const ciPlan = parseCiPlan(ciPlanJson);
  const repoWithCiPlan = repo.withNewFile(CI_PLAN_PATH, ciPlanJson);

  console.log(
    `[workflow] mode=${ciPlan.mode} deploy_targets=${JSON.stringify(ciPlan.deploy_targets)} validate_targets=${JSON.stringify(ciPlan.validate_targets)}`,
  );

  const packagedRepo = await buildAndPackageDeployTargets(
    repoWithCiPlan,
    repoWithCiPlan.file(CI_PLAN_PATH),
    artifactPrefix,
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
