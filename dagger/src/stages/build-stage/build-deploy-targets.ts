import { dag, Directory, File } from "@dagger.io/dagger";

import { parseCiPlan } from "../../ci-plan/parse-ci-plan.ts";
import { logSection } from "../../logging/sections.ts";
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

  logSection("Rush build");

  if (ciPlan.deploy_targets.length === 0) {
    console.log("[build] no deploy targets selected");
    return repo;
  }

  console.log(`[build] Rush targets: ${ciPlan.deploy_targets.join(", ")}`);

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
    console.log(`[build] Rush command: ${args[1]}`);
    container = container.withExec([command, ...args], {
      expand: false,
    });
  }

  return container.directory(WORKDIR);
}
