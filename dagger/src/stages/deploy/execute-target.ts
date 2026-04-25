import { Directory, Socket } from "@dagger.io/dagger";

import type { DeployTargetDefinition } from "../../model/deploy-target.ts";
import type { DeployTargetResult } from "../../model/deploy-result.ts";
import type { PackageManifestArtifact } from "../../model/package-manifest.ts";
import type { ToolchainImageProvidersDefinition } from "../../model/toolchain-image.ts";
import { logSubsection } from "../../logging/sections.ts";
import { deployTargetToolchainImageSpec } from "../../toolchain-images/spec.ts";
import {
  buildResolvedToolchainContainer,
  resolveToolchainImage,
} from "../../toolchain-images/resolve.ts";
import { loadDeployTargetDefinition } from "./load-deploy-metadata.ts";
import {
  getRequiredRepoRelativeHostPathSource,
  resolveSpecEnvironment,
  validateRequiredHostEnv,
} from "./runtime-env.ts";
import { buildDeployTargetCommand, deployTagName } from "./deploy-tag.ts";

function formatDryRunSummary(
  definition: DeployTargetDefinition,
  artifact: PackageManifestArtifact,
  artifactPath: string,
  envVars: Record<string, string>,
  environment: string,
  gitSha: string,
  deployTag: string,
  dockerSocketEnabled: boolean,
  wave: number,
): string {
  const lines = [
    `[deploy-release] dry-run target=${definition.name} wave=${wave}`,
    `environment=${environment}`,
    `gitSha=${gitSha}`,
    `deploy_tag=${deployTag}`,
    `deploy_script=${definition.deploy_script}`,
    `package_artifact_kind=${artifact.kind}`,
    `package_artifact_path=${artifact.path}`,
    `artifact_path=${artifactPath}`,
    `image=${definition.runtime.image}`,
  ];

  if (definition.runtime.install.length > 0) {
    lines.push("install:");
    lines.push(
      ...definition.runtime.install.map((command) => `  - ${command}`),
    );
  }

  const envEntries = Object.entries(envVars).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (envEntries.length > 0) {
    lines.push("env:");
    lines.push(...envEntries.map(([name, value]) => `  - ${name}=${value}`));
  }

  if (definition.runtime.file_mounts.length > 0) {
    lines.push("file_mounts:");
    lines.push(
      ...definition.runtime.file_mounts.map(
        (mount) => `  - source_var=${mount.source_var} target=${mount.target}`,
      ),
    );
  }

  if (dockerSocketEnabled) {
    lines.push("docker_socket:");
    lines.push("  - /var/run/docker.sock");
  }

  return `${lines.join("\n")}\n`;
}

export async function executeTarget(
  repo: Directory,
  target: string,
  artifact: PackageManifestArtifact,
  gitSha: string,
  environment: string,
  dryRun: boolean,
  hostEnv: Record<string, string>,
  hostWorkspaceDir: string,
  wave: number,
  toolchainImageProvider: "off" | "github" = "off",
  toolchainImageProviders?: ToolchainImageProvidersDefinition,
  dockerSocket?: Socket,
): Promise<DeployTargetResult> {
  const definition = await loadDeployTargetDefinition(repo, target);
  validateRequiredHostEnv(definition.runtime, hostEnv, dryRun, target);
  const artifactPath = `/workspace/${artifact.deploy_path}`;
  const deployTag = deployTagName(environment, target);
  const envVars = {
    ARTIFACT_PATH: artifactPath,
    DRY_RUN: dryRun ? "1" : "0",
    GIT_SHA: gitSha,
    ...resolveSpecEnvironment(definition.runtime, hostEnv, dryRun, target),
  };
  const command = buildDeployTargetCommand(
    definition.deploy_script,
    environment,
    target,
    gitSha,
  );

  logSubsection(`Deploy target: ${target} (wave ${wave})`);
  console.log(`[deploy-release] wave ${wave}: starting ${target}`);

  if (dryRun) {
    const output = formatDryRunSummary(
      definition,
      artifact,
      artifactPath,
      envVars,
      environment,
      gitSha,
      deployTag,
      dockerSocket !== undefined,
      wave,
    );
    console.log(output.trimEnd());

    return {
      artifactPath: envVars.ARTIFACT_PATH,
      output,
      status: "success",
      target,
      wave,
    };
  }

  const toolchainImage = await resolveToolchainImage(
    deployTargetToolchainImageSpec(definition),
    {
      hostEnv,
      provider: toolchainImageProvider,
      providers: toolchainImageProviders,
    },
  );
  let container = buildResolvedToolchainContainer(toolchainImage)
    .withDirectory("/workspace", repo)
    .withWorkdir("/workspace");

  for (const fileMount of definition.runtime.file_mounts) {
    const sourcePath = getRequiredRepoRelativeHostPathSource(
      hostEnv,
      fileMount.source_var,
      target,
      hostWorkspaceDir,
    );
    container = container.withMountedFile(
      fileMount.target,
      repo.file(sourcePath),
    );
  }

  if (dockerSocket !== undefined) {
    container = container.withUnixSocket("/var/run/docker.sock", dockerSocket);
  }

  for (const [name, value] of Object.entries(envVars)) {
    container = container.withEnvVariable(name, value);
  }

  const output = await container.withExec(["bash", "-lc", command]).stdout();

  console.log(`[deploy-release] wave ${wave}: finished ${target}`);

  return {
    artifactPath: envVars.ARTIFACT_PATH,
    output,
    status: "success",
    target,
    wave,
  };
}
