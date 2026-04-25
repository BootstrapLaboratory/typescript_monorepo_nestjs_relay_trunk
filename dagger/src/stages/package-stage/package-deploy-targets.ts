import { Directory, File } from "@dagger.io/dagger";

import { parseCiPlan } from "../../ci-plan/parse-ci-plan.ts";
import { logSection, logSubsection } from "../../logging/sections.ts";
import { installRush, prepareRushContainer } from "../../rush/container.ts";
import { loadPackageTargetDefinition } from "./load-package-metadata.ts";
import { buildPackageActionPlan } from "./package-action-plan.ts";
import {
  createEmptyPackageManifest,
  formatPackageManifest,
} from "./package-manifest.ts";

const WORKDIR = "/workspace";
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
  let container = installRush(await prepareRushContainer(repo));

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
