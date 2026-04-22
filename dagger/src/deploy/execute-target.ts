import { dag, Directory, Socket } from "@dagger.io/dagger"

import type { DeployTargetDefinition } from "../model/deploy-target.ts"
import type { DeployTargetResult } from "../model/deploy-result.ts"
import { loadDeployTargetDefinition } from "./load-deploy-metadata.ts"
import {
  getRequiredRepoRelativeHostPathSource,
  resolveSpecEnvironment,
  validateRequiredHostEnv,
} from "./runtime-env.ts"

function deployTagPrefixForEnvironment(environment: string): string {
  return `deploy/${environment}`
}

function formatDryRunSummary(
  definition: DeployTargetDefinition,
  envVars: Record<string, string>,
  environment: string,
  gitSha: string,
  dockerSocketEnabled: boolean,
  wave: number,
): string {
  const lines = [
    `[deploy-release] dry-run target=${definition.name} wave=${wave}`,
    `environment=${environment}`,
    `gitSha=${gitSha}`,
    `deploy_script=${definition.deploy_script}`,
    `artifact_path=${definition.artifact_path}`,
    `image=${definition.runtime.image}`,
  ]

  if (definition.runtime.install.length > 0) {
    lines.push("install:")
    lines.push(...definition.runtime.install.map((command) => `  - ${command}`))
  }

  const envEntries = Object.entries(envVars).sort(([left], [right]) => left.localeCompare(right))
  if (envEntries.length > 0) {
    lines.push("env:")
    lines.push(...envEntries.map(([name, value]) => `  - ${name}=${value}`))
  }

  if (definition.runtime.file_mounts.length > 0) {
    lines.push("file_mounts:")
    lines.push(
      ...definition.runtime.file_mounts.map(
        (mount) => `  - source_var=${mount.source_var} target=${mount.target}`,
      ),
    )
  }

  if (dockerSocketEnabled) {
    lines.push("docker_socket:")
    lines.push("  - /var/run/docker.sock")
  }

  return `${lines.join("\n")}\n`
}

export async function executeTarget(
  repo: Directory,
  target: string,
  gitSha: string,
  environment: string,
  dryRun: boolean,
  hostEnv: Record<string, string>,
  hostWorkspaceDir: string,
  wave: number,
  dockerSocket?: Socket,
): Promise<DeployTargetResult> {
  const definition = await loadDeployTargetDefinition(repo, target)
  validateRequiredHostEnv(definition.runtime, hostEnv, dryRun, target)
  const envVars = {
    ARTIFACT_PATH: definition.artifact_path,
    DEPLOY_TAG_PREFIX: deployTagPrefixForEnvironment(environment),
    DRY_RUN: dryRun ? "1" : "0",
    GIT_SHA: gitSha,
    ...resolveSpecEnvironment(definition.runtime, hostEnv, dryRun, target),
  }
  const commandParts = [`bash ${definition.deploy_script}`]

  console.log(`[deploy-release] wave ${wave}: starting ${target}`)

  if (dryRun) {
    const output = formatDryRunSummary(definition, envVars, environment, gitSha, dockerSocket !== undefined, wave)
    console.log(output.trimEnd())

    return {
      artifactPath: envVars.ARTIFACT_PATH,
      output,
      status: "success",
      target,
      wave,
    }
  }

  let container = dag.container().from(definition.runtime.image).withDirectory("/workspace", repo).withWorkdir("/workspace")

  if (definition.runtime.install.length > 0) {
    container = container.withExec(["bash", "-lc", definition.runtime.install.join(" && ")])
  }

  for (const fileMount of definition.runtime.file_mounts) {
    const sourcePath = getRequiredRepoRelativeHostPathSource(hostEnv, fileMount.source_var, target, hostWorkspaceDir)
    container = container.withMountedFile(fileMount.target, repo.file(sourcePath))
  }

  if (dockerSocket !== undefined) {
    container = container.withUnixSocket("/var/run/docker.sock", dockerSocket)
  }

  for (const [name, value] of Object.entries(envVars)) {
    container = container.withEnvVariable(name, value)
  }

  const output = await container.withExec(["bash", "-lc", commandParts.join(" && ")]).stdout()

  console.log(`[deploy-release] wave ${wave}: finished ${target}`)

  return {
    artifactPath: envVars.ARTIFACT_PATH,
    output,
    status: "success",
    target,
    wave,
  }
}
