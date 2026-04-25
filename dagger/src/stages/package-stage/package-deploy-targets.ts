import { dag, Directory, File } from "@dagger.io/dagger";

import { parseCiPlan } from "../../ci-plan/parse-ci-plan.ts";
import { logSection, logSubsection } from "../../logging/sections.ts";
import { loadPackageTargetDefinition } from "./load-package-metadata.ts";
import { buildPackageActionPlan } from "./package-action-plan.ts";
import {
  createEmptyPackageManifest,
  formatPackageManifest,
} from "./package-manifest.ts";

const WORKDIR = "/workspace";
const PACKAGE_IMAGE = "node:24-bookworm-slim";
const PACKAGE_INSTALL_COMMAND =
  "apt-get update && apt-get install -y ca-certificates git";
const PACKAGE_MANIFEST_PATH = ".dagger/runtime/package-manifest.json";

export async function packageDeployTargets(
  repo: Directory,
  ciPlanFile: File,
  artifactPrefix: string = "deploy-target",
): Promise<Directory> {
  const ciPlan = parseCiPlan(await ciPlanFile.contents());

  logSection("Package deploy artifacts");

  if (ciPlan.deploy_targets.length === 0) {
    console.log("[package] no deploy targets selected");
    return repo.withNewFile(
      PACKAGE_MANIFEST_PATH,
      formatPackageManifest(createEmptyPackageManifest()),
    );
  }

  const packagePlans = await Promise.all(
    ciPlan.deploy_targets.map(async (target) => ({
      plan: buildPackageActionPlan(
        target,
        await loadPackageTargetDefinition(repo, target),
        artifactPrefix,
      ),
      target,
    })),
  );
  const artifacts = Object.fromEntries(
    packagePlans.map(({ plan, target }) => [target, plan.artifact]),
  );
  let container = dag
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
    ]);

  for (const { plan, target } of packagePlans) {
    logSubsection(`Package target: ${target}`);
    console.log(`[package] ${target}: ${plan.artifact.kind}`);

    for (const validation of plan.validations) {
      if (validation.kind === "directory") {
        container = container.withExec(["test", "-d", validation.path], {
          expand: false,
        });
      }
    }

    for (const { command, args } of plan.commands) {
      container = container.withExec([command, ...args], {
        expand: false,
      });
    }
  }

  return container
    .directory(WORKDIR)
    .withNewFile(PACKAGE_MANIFEST_PATH, formatPackageManifest({ artifacts }));
}
