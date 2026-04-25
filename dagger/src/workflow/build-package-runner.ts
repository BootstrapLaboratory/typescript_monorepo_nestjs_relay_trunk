import { Container, Directory } from "@dagger.io/dagger";

import type { CiPlan } from "../model/ci-plan.ts";
import type { PackageManifestArtifact } from "../model/package-manifest.ts";
import { buildRushBuildSteps } from "../stages/build-stage/rush-build-plan.ts";
import { formatCiPlan } from "../ci-plan/parse-ci-plan.ts";
import { computeCiPlan } from "../stages/detect/compute-ci-plan.ts";
import { loadPackageTargetDefinition } from "../stages/package-stage/load-package-metadata.ts";
import { buildPackageActionPlan } from "../stages/package-stage/package-action-plan.ts";
import {
  createEmptyPackageManifest,
  formatPackageManifest,
} from "../stages/package-stage/package-manifest.ts";
import {
  installRush,
  prepareRushContainer,
  RUSH_WORKDIR,
} from "../rush/container.ts";
import { logSection, logSubsection } from "../logging/sections.ts";

const CI_PLAN_PATH = ".dagger/runtime/ci-plan.json";
const CI_PLAN_CONTAINER_PATH = `${RUSH_WORKDIR}/${CI_PLAN_PATH}`;
const PACKAGE_MANIFEST_PATH = ".dagger/runtime/package-manifest.json";

function buildDetectedContainer(
  container: Container,
  ciPlan: CiPlan,
): Container {
  return container.withNewFile(CI_PLAN_CONTAINER_PATH, formatCiPlan(ciPlan));
}

function runBuildStage(container: Container, ciPlan: CiPlan): Container {
  logSection("Rush build");

  if (ciPlan.deploy_targets.length === 0) {
    console.log("[build] no deploy targets selected");
    return container;
  }

  console.log(`[build] Rush targets: ${ciPlan.deploy_targets.join(", ")}`);

  let nextContainer = container.withEnvVariable("FAILURE_MODE", "deploy");

  for (const { command, args } of buildRushBuildSteps(ciPlan)) {
    console.log(`[build] Rush command: ${args[1]}`);
    nextContainer = nextContainer.withExec([command, ...args], {
      expand: false,
    });
  }

  return nextContainer;
}

async function runPackageStage(
  repo: Directory,
  container: Container,
  ciPlan: CiPlan,
  artifactPrefix: string,
): Promise<Container> {
  logSection("Package deploy artifacts");

  if (ciPlan.deploy_targets.length === 0) {
    console.log("[package] no deploy targets selected");
    return container.withNewFile(
      `${RUSH_WORKDIR}/${PACKAGE_MANIFEST_PATH}`,
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
  const artifacts: Record<string, PackageManifestArtifact> = Object.fromEntries(
    packagePlans.map(({ plan, target }) => [target, plan.artifact]),
  );
  let nextContainer = container;

  for (const { plan, target } of packagePlans) {
    logSubsection(`Package target: ${target}`);
    console.log(`[package] ${target}: ${plan.artifact.kind}`);

    for (const validation of plan.validations) {
      if (validation.kind === "directory") {
        nextContainer = nextContainer.withExec(
          ["test", "-d", validation.path],
          {
            expand: false,
          },
        );
      }
    }

    for (const { command, args } of plan.commands) {
      nextContainer = nextContainer.withExec([command, ...args], {
        expand: false,
      });
    }
  }

  return nextContainer.withNewFile(
    `${RUSH_WORKDIR}/${PACKAGE_MANIFEST_PATH}`,
    formatPackageManifest({ artifacts }),
  );
}

export type BuildPackageWorkflowResult = {
  ciPlan: CiPlan;
  repo: Directory;
};

export async function runBuildPackageWorkflow(
  repo: Directory,
  eventName: string,
  forceTargetsJson: string,
  prBaseSha: string,
  deployTagPrefix: string,
  artifactPrefix: string,
): Promise<BuildPackageWorkflowResult> {
  logSection("Detect release targets");

  const baseContainer = prepareRushContainer(repo);
  const ciPlan = await computeCiPlan(
    repo,
    baseContainer,
    eventName,
    forceTargetsJson,
    prBaseSha,
    deployTagPrefix,
  );
  const detectedContainer = buildDetectedContainer(baseContainer, ciPlan);

  console.log(
    `[detect] mode=${ciPlan.mode} deploy_targets=${JSON.stringify(ciPlan.deploy_targets)} validate_targets=${JSON.stringify(ciPlan.validate_targets)}`,
  );

  if (ciPlan.deploy_targets.length === 0) {
    return {
      ciPlan,
      repo: (
        await runPackageStage(repo, detectedContainer, ciPlan, artifactPrefix)
      ).directory(RUSH_WORKDIR),
    };
  }

  const rushContainer = installRush(detectedContainer);
  const builtContainer = runBuildStage(rushContainer, ciPlan);
  const packagedContainer = await runPackageStage(
    repo,
    builtContainer,
    ciPlan,
    artifactPrefix,
  );

  return {
    ciPlan,
    repo: packagedContainer.directory(RUSH_WORKDIR),
  };
}
