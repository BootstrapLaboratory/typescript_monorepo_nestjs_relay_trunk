import { Directory, File, Socket } from "@dagger.io/dagger";

import { deployRelease } from "../stages/deploy/deploy-release.ts";
import { logSection } from "../logging/sections.ts";
import { validateMetadataContract } from "../metadata/dagger-metadata-contract.ts";
import { formatMetadataContractValidationResult } from "../metadata/metadata-contract.ts";
import {
  parseToolchainImagePolicy,
  parseToolchainImageProvider,
} from "../toolchain-images/options.ts";
import { parseToolchainImageProviders } from "../toolchain-images/parse-providers.ts";
import { toolchainImageProvidersPath } from "../toolchain-images/metadata-paths.ts";
import {
  parseRushCachePolicy,
  parseRushCacheProvider,
} from "../rush-cache/options.ts";
import { parseRushCacheProviders } from "../rush-cache/parse-providers.ts";
import { rushCacheProvidersPath } from "../rush-cache/metadata-paths.ts";
import { parseDeployEnvFile } from "../stages/deploy/runtime-env.ts";
import { buildSourcePlan } from "../source/source-plan.ts";
import { resolveSource } from "../source/resolve-source.ts";
import { runBuildPackageWorkflow } from "./build-package-runner.ts";

const PACKAGE_MANIFEST_PATH = ".dagger/runtime/package-manifest.json";

export async function workflow(
  repo: Directory,
  gitSha: string,
  eventName: string = "push",
  forceTargetsJson: string = "[]",
  prBaseSha: string = "",
  deployTagPrefix: string = "deploy/prod",
  artifactPrefix: string = "deploy-target",
  environment: string = "prod",
  dryRun: boolean = true,
  deployEnvFile?: File,
  hostWorkspaceDir: string = "",
  toolchainImageProvider: string = "off",
  toolchainImagePolicy: string = "lazy",
  rushCacheProvider: string = "off",
  rushCachePolicy: string = "lazy",
  sourceMode: string = "local_copy",
  sourceRepositoryUrl: string = "",
  sourceRef: string = "",
  sourceAuthTokenEnv: string = "",
  sourceAuthUsername: string = "",
  dockerSocket?: Socket,
): Promise<string> {
  logSection("Release workflow");
  const hostEnv = deployEnvFile
    ? parseDeployEnvFile(await deployEnvFile.contents())
    : {};
  const sourcePlan = buildSourcePlan({
    authTokenEnv:
      sourceAuthTokenEnv.length === 0 ? undefined : sourceAuthTokenEnv,
    authUsername:
      sourceAuthUsername.length === 0 ? undefined : sourceAuthUsername,
    commitSha: gitSha,
    deployTagPrefix,
    mode: sourceMode,
    prBaseSha,
    ref: sourceRef.length === 0 ? undefined : sourceRef,
    repositoryUrl:
      sourceRepositoryUrl.length === 0 ? undefined : sourceRepositoryUrl,
  });

  logSection("Source acquisition");
  console.log(`[source] mode=${sourcePlan.mode}`);

  const sourceRepo = resolveSource(sourcePlan, {
    hostEnv,
    repo,
  });

  logSection("Metadata contract");

  console.log(
    formatMetadataContractValidationResult(
      await validateMetadataContract(sourceRepo),
    ),
  );

  const parsedToolchainImageProvider =
    parseToolchainImageProvider(toolchainImageProvider);
  parseToolchainImagePolicy(toolchainImagePolicy);
  const parsedRushCacheProvider = parseRushCacheProvider(rushCacheProvider);
  parseRushCachePolicy(rushCachePolicy);
  const toolchainImageProviders =
    parsedToolchainImageProvider === "off"
      ? undefined
      : parseToolchainImageProviders(
          await sourceRepo.file(toolchainImageProvidersPath).contents(),
        );
  const rushCacheProviders = parseRushCacheProviders(
    await sourceRepo.file(rushCacheProvidersPath).contents(),
  );

  const { ciPlan, repo: packagedRepo } = await runBuildPackageWorkflow(
    sourceRepo,
    eventName,
    forceTargetsJson,
    prBaseSha,
    deployTagPrefix,
    artifactPrefix,
    {
      hostEnv,
      rushCacheProvider: parsedRushCacheProvider,
      rushCacheProviders,
      toolchainImageProvider: parsedToolchainImageProvider,
      toolchainImageProviders,
    },
  );

  console.log(
    `[workflow] mode=${ciPlan.mode} deploy_targets=${JSON.stringify(ciPlan.deploy_targets)} validate_targets=${JSON.stringify(ciPlan.validate_targets)}`,
  );

  const gitAuthTokenEnv =
    sourcePlan.mode === "git" ? (sourcePlan.auth?.tokenEnv ?? "") : "";
  const gitAuthUsername =
    sourcePlan.mode === "git"
      ? (sourcePlan.auth?.username ?? "x-access-token")
      : "x-access-token";

  return deployRelease(
    packagedRepo,
    gitSha,
    JSON.stringify(ciPlan.deploy_targets),
    environment,
    dryRun,
    deployEnvFile,
    packagedRepo.file(PACKAGE_MANIFEST_PATH),
    hostWorkspaceDir,
    toolchainImageProvider,
    toolchainImagePolicy,
    dockerSocket,
    repo,
    gitAuthTokenEnv,
    gitAuthUsername,
  );
}
