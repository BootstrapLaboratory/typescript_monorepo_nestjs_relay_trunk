import { Directory, File } from "@dagger.io/dagger";

import { parseCiPlan } from "../../ci-plan/parse-ci-plan.ts";
import { logSection } from "../../logging/sections.ts";
import { installRush, prepareRushContainer } from "../../rush/container.ts";
import { buildRushBuildSteps } from "./rush-build-plan.ts";

const WORKDIR = "/workspace";

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

  let container = installRush(
    await prepareRushContainer(repo),
  ).withEnvVariable("FAILURE_MODE", "deploy");

  for (const { command, args } of buildRushBuildSteps(ciPlan)) {
    console.log(`[build] Rush command: ${args[1]}`);
    container = container.withExec([command, ...args], {
      expand: false,
    });
  }

  return container.directory(WORKDIR);
}
