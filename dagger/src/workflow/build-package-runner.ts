import { CacheSharingMode, dag, Container, Directory } from "@dagger.io/dagger";

import type { CiPlan } from "../model/ci-plan.ts";
import type { PackageManifestArtifact } from "../model/package-manifest.ts";
import { buildRushBuildSteps } from "../build-stage/rush-build-plan.ts";
import { formatCiPlan } from "../ci-plan/parse-ci-plan.ts";
import { computeCiPlan } from "../detect/compute-ci-plan.ts";
import { loadPackageTargetDefinition } from "../package-stage/load-package-metadata.ts";
import { buildPackageActionPlan } from "../package-stage/package-action-plan.ts";
import {
  createEmptyPackageManifest,
  formatPackageManifest,
} from "../package-stage/package-manifest.ts";

const WORKDIR = "/workspace";
const WORKFLOW_IMAGE = "node:24-bookworm-slim";
const WORKFLOW_INSTALL_COMMAND =
  "apt-get update && apt-get install -y ca-certificates git";
const CI_PLAN_PATH = ".dagger/runtime/ci-plan.json";
const CI_PLAN_CONTAINER_PATH = `${WORKDIR}/${CI_PLAN_PATH}`;
const PACKAGE_MANIFEST_PATH = ".dagger/runtime/package-manifest.json";
const RUSH_HOME_CACHE_PATH = "/root/.rush";
const RUSH_INSTALL_RUN_CACHE_PATH = `${WORKDIR}/common/temp/install-run`;
const RUSH_PNPM_STORE_CACHE_PATH = `${WORKDIR}/common/temp/pnpm-store`;

function withRushCaches(container: Container): Container {
  return container
    .withMountedCache(
      RUSH_HOME_CACHE_PATH,
      dag.cacheVolume("cache-rush-home"),
      { sharing: CacheSharingMode.Locked },
    )
    .withMountedCache(
      RUSH_INSTALL_RUN_CACHE_PATH,
      dag.cacheVolume("cache-rush-install-run"),
      { sharing: CacheSharingMode.Locked },
    )
    .withMountedCache(
      RUSH_PNPM_STORE_CACHE_PATH,
      dag.cacheVolume("cache-rush-pnpm-store"),
      { sharing: CacheSharingMode.Locked },
    );
}

function prepareContainer(repo: Directory): Container {
  return dag
    .container()
    .from(WORKFLOW_IMAGE)
    .withDirectory(WORKDIR, repo)
    .withWorkdir(WORKDIR)
    .withExec(["bash", "-lc", WORKFLOW_INSTALL_COMMAND]);
}

function installRush(container: Container): Container {
  return withRushCaches(container).withExec([
    "node",
    "common/scripts/install-run-rush.js",
    "install",
    "--max-install-attempts",
    "1",
  ]);
}

function buildDetectedContainer(
  container: Container,
  ciPlan: CiPlan,
): Container {
  return container.withNewFile(CI_PLAN_CONTAINER_PATH, formatCiPlan(ciPlan));
}

function runBuildStage(container: Container, ciPlan: CiPlan): Container {
  if (ciPlan.deploy_targets.length === 0) {
    console.log("[build] no deploy targets selected");
    return container;
  }

  let nextContainer = container.withEnvVariable("FAILURE_MODE", "deploy");

  for (const { command, args } of buildRushBuildSteps(ciPlan)) {
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
  if (ciPlan.deploy_targets.length === 0) {
    console.log("[package] no deploy targets selected");
    return container.withNewFile(
      `${WORKDIR}/${PACKAGE_MANIFEST_PATH}`,
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
    `${WORKDIR}/${PACKAGE_MANIFEST_PATH}`,
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
  const baseContainer = prepareContainer(repo);
  const ciPlan = await computeCiPlan(
    repo,
    baseContainer,
    eventName,
    forceTargetsJson,
    prBaseSha,
    deployTagPrefix,
  );
  const detectedContainer = buildDetectedContainer(baseContainer, ciPlan);

  if (ciPlan.deploy_targets.length === 0) {
    return {
      ciPlan,
      repo: (
        await runPackageStage(repo, detectedContainer, ciPlan, artifactPrefix)
      ).directory(WORKDIR),
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
    repo: packagedContainer.directory(WORKDIR),
  };
}
