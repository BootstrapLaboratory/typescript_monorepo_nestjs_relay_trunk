import { dag, Directory, File } from "@dagger.io/dagger";

import type { CiPlan } from "../model/ci-plan.ts";
import { parseCiPlan } from "../ci-plan/parse-ci-plan.ts";

const WORKDIR = "/workspace";
const BUILD_IMAGE = "node:24-bookworm-slim";
const BUILD_INSTALL_COMMAND =
  "apt-get update && apt-get install -y ca-certificates git";

function deployTargetsJson(ciPlan: CiPlan): string {
  return JSON.stringify(ciPlan.deploy_targets);
}

function hasDeployTargets(ciPlan: CiPlan): boolean {
  return ciPlan.deploy_targets.length > 0;
}

export async function buildDeployTargets(
  repo: Directory,
  ciPlanFile: File,
): Promise<Directory> {
  const ciPlan = parseCiPlan(await ciPlanFile.contents());

  if (!hasDeployTargets(ciPlan)) {
    console.log("[build] no deploy targets selected");
    return repo;
  }

  const container = dag
    .container()
    .from(BUILD_IMAGE)
    .withDirectory(WORKDIR, repo)
    .withWorkdir(WORKDIR)
    .withExec(["bash", "-lc", BUILD_INSTALL_COMMAND])
    .withExec([
      "node",
      "common/scripts/install-run-rush.js",
      "install",
      "--max-install-attempts",
      "1",
    ])
    .withEnvVariable("DEPLOY_TARGETS_JSON", deployTargetsJson(ciPlan))
    .withExec(["bash", "scripts/ci/build-deploy-targets.sh"]);

  return container.directory(WORKDIR);
}
