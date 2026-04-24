import { Directory, File } from "@dagger.io/dagger";

import { buildDeployTargets } from "../build-stage/build-deploy-targets.ts";
import { packageDeployTargets } from "./package-deploy-targets.ts";

export async function buildAndPackageDeployTargets(
  repo: Directory,
  ciPlanFile: File,
  artifactPrefix: string = "deploy-target",
): Promise<Directory> {
  const builtRepo = await buildDeployTargets(repo, ciPlanFile);

  return packageDeployTargets(builtRepo, ciPlanFile, artifactPrefix);
}
