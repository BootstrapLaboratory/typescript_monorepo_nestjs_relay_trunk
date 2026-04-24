import { dag, Directory, File } from "@dagger.io/dagger";

import { parseCiPlan } from "../ci-plan/parse-ci-plan.ts";
import { buildRushBuildSteps } from "./rush-build-plan.ts";

const WORKDIR = "/workspace";
const BUILD_IMAGE = "node:24-bookworm-slim";
const BUILD_INSTALL_COMMAND =
  "apt-get update && apt-get install -y ca-certificates git";

export async function buildDeployTargets(
  repo: Directory,
  ciPlanFile: File,
): Promise<Directory> {
  const ciPlan = parseCiPlan(await ciPlanFile.contents());

  if (ciPlan.deploy_targets.length === 0) {
    console.log("[build] no deploy targets selected");
    return repo;
  }

  let container = dag
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
    .withEnvVariable("FAILURE_MODE", "deploy");

  for (const { command, args } of buildRushBuildSteps(ciPlan)) {
    container = container.withExec([command, ...args], {
      expand: false,
    });
  }

  return container.directory(WORKDIR);
}
