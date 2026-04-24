import { dag, Directory, File } from "@dagger.io/dagger";

import { parseCiPlan } from "../ci-plan/parse-ci-plan.ts";

const WORKDIR = "/workspace";
const PACKAGE_IMAGE = "node:24-bookworm-slim";
const PACKAGE_INSTALL_COMMAND =
  "apt-get update && apt-get install -y ca-certificates git";
const EMPTY_PACKAGE_MANIFEST_PATH = ".dagger/runtime/package-manifest.json";

export async function packageDeployTargets(
  repo: Directory,
  ciPlanFile: File,
  artifactPrefix: string = "deploy-target",
): Promise<Directory> {
  const ciPlan = parseCiPlan(await ciPlanFile.contents());

  if (ciPlan.deploy_targets.length === 0) {
    console.log("[package] no deploy targets selected");
    return repo.withNewFile(
      EMPTY_PACKAGE_MANIFEST_PATH,
      `${JSON.stringify({ artifacts: {} }, null, 2)}\n`,
    );
  }

  const container = dag
    .container()
    .from(PACKAGE_IMAGE)
    .withDirectory(WORKDIR, repo)
    .withWorkdir(WORKDIR)
    .withExec(["bash", "-lc", PACKAGE_INSTALL_COMMAND])
    .withExec([
      "node",
      "common/scripts/install-run-rush.js",
      "install",
      "--max-install-attempts",
      "1",
    ])
    .withEnvVariable(
      "DEPLOY_TARGETS_JSON",
      JSON.stringify(ciPlan.deploy_targets),
    )
    .withEnvVariable("DEPLOY_ARTIFACT_PREFIX", artifactPrefix)
    .withExec(["node", "scripts/ci/package-deploy-targets.mjs"]);

  return container.directory(WORKDIR);
}
