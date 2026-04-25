import { Container, Directory } from "@dagger.io/dagger";

import type { CiPlan } from "../model/ci-plan.ts";
import type { PackageManifestArtifact } from "../model/package-manifest.ts";
import type {
  ToolchainImageProvider,
  ToolchainImageProvidersDefinition,
} from "../model/toolchain-image.ts";
import type {
  RushCacheProvider,
  RushCacheProvidersDefinition,
} from "../model/rush-cache.ts";
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
  rushWorkflowToolchainIdentity,
  RUSH_WORKDIR,
} from "../rush/container.ts";
import {
  publishResolvedRushInstallCache,
  resolveRushInstallCache,
} from "../rush-cache/resolve.ts";
import {
  RUSH_CACHE_TEMP_FOLDER_ENV,
  rushCacheTempFolder,
} from "../rush-cache/resolve-plan.ts";
import { buildRushCacheSpec } from "../rush-cache/spec.ts";
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

export type BuildPackageWorkflowOptions = {
  hostEnv?: Record<string, string>;
  rushCacheProvider?: RushCacheProvider;
  rushCacheProviders?: RushCacheProvidersDefinition;
  toolchainImageProvider?: ToolchainImageProvider;
  toolchainImageProviders?: ToolchainImageProvidersDefinition;
};

async function buildRushInstallCacheSpec(
  repo: Directory,
  providers: RushCacheProvidersDefinition,
) {
  const keyFiles = await Promise.all(
    providers.cache.key_files.map(async (path) => ({
      contents: await repo.file(path).contents(),
      path,
    })),
  );

  return buildRushCacheSpec({
    config: providers.cache,
    keyFiles,
    toolchainIdentity: rushWorkflowToolchainIdentity(),
  });
}

export async function runBuildPackageWorkflow(
  repo: Directory,
  eventName: string,
  forceTargetsJson: string,
  prBaseSha: string,
  deployTagPrefix: string,
  artifactPrefix: string,
  options: BuildPackageWorkflowOptions = {},
): Promise<BuildPackageWorkflowResult> {
  logSection("Detect release targets");

  const baseContainer = await prepareRushContainer(repo, {
    hostEnv: options.hostEnv,
    provider: options.toolchainImageProvider,
    providers: options.toolchainImageProviders,
  });
  const detectContainer =
    options.rushCacheProviders === undefined
      ? baseContainer
      : baseContainer.withEnvVariable(
          RUSH_CACHE_TEMP_FOLDER_ENV,
          rushCacheTempFolder(options.rushCacheProviders.cache),
        );
  const ciPlan = await computeCiPlan(
    repo,
    detectContainer,
    eventName,
    forceTargetsJson,
    prBaseSha,
    deployTagPrefix,
  );
  const detectedContainer = buildDetectedContainer(detectContainer, ciPlan);

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

  logSection("Rush install cache");

  if (options.rushCacheProviders === undefined) {
    throw new Error(
      "Rush cache provider metadata is required before running Rush install.",
    );
  }

  const cacheSpec = await buildRushInstallCacheSpec(
    repo,
    options.rushCacheProviders,
  );
  const resolvedCache = await resolveRushInstallCache(
    detectedContainer,
    cacheSpec,
    {
      hostEnv: options.hostEnv,
      provider: options.rushCacheProvider,
      providers: options.rushCacheProviders,
    },
  );
  const rushContainer = installRush(resolvedCache.container);

  await publishResolvedRushInstallCache(rushContainer, resolvedCache);

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
