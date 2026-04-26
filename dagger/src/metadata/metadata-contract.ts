import path from "node:path";

import type { DeployRuntimeSpec } from "../model/deploy-target.ts";
import type { PackageTargetDefinition } from "../model/package-target.ts";
import { buildDeploymentPlan } from "../planning/build-deployment-plan.ts";
import { parseServicesMesh } from "../planning/parse-services-mesh.ts";
import {
  deployTargetsDirectory,
  servicesMeshPath,
  targetDefinitionPath,
} from "../stages/deploy/metadata-paths.ts";
import { parseDeployTarget } from "../stages/deploy/parse-deploy-target.ts";
import {
  packageTargetDefinitionPath,
  packageTargetsDirectory,
} from "../stages/package-stage/metadata-paths.ts";
import { parsePackageTarget } from "../stages/package-stage/parse-package-target.ts";
import {
  validationTargetDefinitionPath,
  validationTargetsDirectory,
} from "../stages/validate/metadata-paths.ts";
import { parseValidationTarget } from "../stages/validate/parse-validation-target.ts";
import {
  parseRushProjects,
  type RushProjectDefinition,
} from "./rush-projects.ts";
import { parseRushCacheProviders } from "../rush-cache/parse-providers.ts";
import { rushCacheProvidersPath } from "../rush-cache/metadata-paths.ts";

type RepositoryPathType = "directory" | "file";

export type MetadataContractRepository = {
  entries(path: string): Promise<string[]>;
  exists(path: string, expectedType: RepositoryPathType): Promise<boolean>;
  readTextFile(path: string): Promise<string>;
};

export type MetadataContractValidationResult = {
  deploy_targets: string[];
  package_targets: string[];
  rush_projects: string[];
  validation_targets: string[];
};

function formatIssueList(issues: string[]): string {
  return [
    "Dagger metadata contract validation failed:",
    ...issues.map((issue) => `- ${issue}`),
  ].join("\n");
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

function validateRepoRelativePath(
  value: string,
  name: string,
  issues: string[],
): void {
  const normalized = value.replace(/\\/g, "/");

  if (normalized.length === 0 || normalized === ".") {
    issues.push(`${name} must be a repository-relative path.`);
    return;
  }

  if (isAbsolutePath(normalized)) {
    issues.push(`${name} must be a repository-relative path, got "${value}".`);
    return;
  }

  if (normalized.split("/").some((segment) => segment === "..")) {
    issues.push(`${name} must stay inside the repository, got "${value}".`);
  }
}

async function fileExists(
  repository: MetadataContractRepository,
  filePath: string,
  description: string,
  issues: string[],
): Promise<boolean> {
  if (!(await repository.exists(filePath, "file"))) {
    issues.push(`${description} "${filePath}" must exist.`);
    return false;
  }

  return true;
}

async function directoryExists(
  repository: MetadataContractRepository,
  directoryPath: string,
  description: string,
  issues: string[],
): Promise<void> {
  if (!(await repository.exists(directoryPath, "directory"))) {
    issues.push(`${description} "${directoryPath}" must exist.`);
  }
}

async function readParsed<T>(
  repository: MetadataContractRepository,
  filePath: string,
  description: string,
  parser: (contents: string) => T,
  issues: string[],
): Promise<T | undefined> {
  try {
    return parser(await repository.readTextFile(filePath));
  } catch (error) {
    issues.push(
      `${description} "${filePath}" is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}

function yamlTargetNames(entries: string[]): string[] {
  return entries
    .filter((entry) => entry.endsWith(".yaml"))
    .map((entry) => path.posix.basename(entry, ".yaml"))
    .sort();
}

async function listYamlTargets(
  repository: MetadataContractRepository,
  directoryPath: string,
  issues: string[],
): Promise<string[]> {
  try {
    if (!(await repository.exists(directoryPath, "directory"))) {
      return [];
    }

    return yamlTargetNames(await repository.entries(directoryPath));
  } catch (error) {
    issues.push(
      `Unable to list metadata directory "${directoryPath}": ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

async function loadRushProjects(
  repository: MetadataContractRepository,
  issues: string[],
): Promise<Map<string, RushProjectDefinition>> {
  const projects =
    (await readParsed(
      repository,
      "rush.json",
      "Rush project file",
      parseRushProjects,
      issues,
    )) ?? [];
  const projectsByName = new Map(
    projects.map((project) => [project.packageName, project]),
  );

  for (const project of projects) {
    await directoryExists(
      repository,
      project.projectFolder,
      `Rush project "${project.packageName}" folder`,
      issues,
    );
    await fileExists(
      repository,
      `${project.projectFolder}/package.json`,
      `Rush project "${project.packageName}" package file`,
      issues,
    );
  }

  return projectsByName;
}

async function validateRushCacheMetadata(
  repository: MetadataContractRepository,
  issues: string[],
): Promise<void> {
  if (
    !(await fileExists(
      repository,
      rushCacheProvidersPath,
      "Rush cache provider metadata file",
      issues,
    ))
  ) {
    return;
  }

  const definition = await readParsed(
    repository,
    rushCacheProvidersPath,
    "Rush cache provider metadata file",
    parseRushCacheProviders,
    issues,
  );

  if (!definition) {
    return;
  }

  await Promise.all(
    definition.cache.key_files.map((filePath) =>
      fileExists(repository, filePath, `Rush cache key file`, issues),
    ),
  );
}

function validatePackageArtifact(
  target: string,
  definition: PackageTargetDefinition,
  rushProjects: Map<string, RushProjectDefinition>,
  issues: string[],
): void {
  if (definition.artifact.kind === "directory") {
    validateRepoRelativePath(
      definition.artifact.path,
      `Package target "${target}" artifact path`,
      issues,
    );
    return;
  }

  if (!rushProjects.has(definition.artifact.project)) {
    issues.push(
      `Package target "${target}" artifact project "${definition.artifact.project}" must be a Rush project.`,
    );
  }

  validateRepoRelativePath(
    definition.artifact.output,
    `Package target "${target}" artifact output`,
    issues,
  );
}

function validateDeployRuntime(
  target: string,
  runtime: DeployRuntimeSpec,
  issues: string[],
): void {
  for (const envName of runtime.pass_env) {
    if (!(envName in runtime.dry_run_defaults)) {
      issues.push(
        `Deploy target "${target}" pass_env "${envName}" must have a dry_run_defaults value.`,
      );
    }
  }

  for (const fileMount of runtime.file_mounts) {
    if (!runtime.required_host_env.includes(fileMount.source_var)) {
      issues.push(
        `Deploy target "${target}" file mount source_var "${fileMount.source_var}" must be listed in required_host_env.`,
      );
    }
  }

  if (runtime.workspace.mode === "full") {
    return;
  }

  for (const directoryPath of runtime.workspace.dirs) {
    validateRepoRelativePath(
      directoryPath,
      `Deploy target "${target}" runtime workspace dir`,
      issues,
    );
  }

  for (const filePath of runtime.workspace.files) {
    validateRepoRelativePath(
      filePath,
      `Deploy target "${target}" runtime workspace file`,
      issues,
    );
  }
}

function validateTargetIsRushProject(
  target: string,
  rushProjects: Map<string, RushProjectDefinition>,
  kind: string,
  issues: string[],
): void {
  if (!rushProjects.has(target)) {
    issues.push(`${kind} "${target}" must match a Rush project packageName.`);
  }
}

async function validateDeployTarget(
  repository: MetadataContractRepository,
  target: string,
  rushProjects: Map<string, RushProjectDefinition>,
  issues: string[],
): Promise<void> {
  const deployPath = targetDefinitionPath(target);

  if (
    !(await fileExists(
      repository,
      deployPath,
      `Deploy target "${target}" metadata file`,
      issues,
    ))
  ) {
    return;
  }

  const definition = await readParsed(
    repository,
    deployPath,
    `Deploy target "${target}" metadata file`,
    parseDeployTarget,
    issues,
  );

  if (!definition) {
    return;
  }

  if (definition.name !== target) {
    issues.push(
      `Deploy target metadata "${deployPath}" must declare name "${target}", got "${definition.name}".`,
    );
  }

  validateTargetIsRushProject(target, rushProjects, "Deploy target", issues);
  validateRepoRelativePath(
    definition.deploy_script,
    `Deploy target "${target}" deploy_script`,
    issues,
  );
  await fileExists(
    repository,
    definition.deploy_script,
    `Deploy target "${target}" deploy_script`,
    issues,
  );
  validateDeployRuntime(target, definition.runtime, issues);
}

async function validatePackageTarget(
  repository: MetadataContractRepository,
  target: string,
  rushProjects: Map<string, RushProjectDefinition>,
  issues: string[],
): Promise<void> {
  const packagePath = packageTargetDefinitionPath(target);

  if (
    !(await fileExists(
      repository,
      packagePath,
      `Package target "${target}" metadata file`,
      issues,
    ))
  ) {
    return;
  }

  const definition = await readParsed(
    repository,
    packagePath,
    `Package target "${target}" metadata file`,
    parsePackageTarget,
    issues,
  );

  if (!definition) {
    return;
  }

  if (definition.name !== target) {
    issues.push(
      `Package target metadata "${packagePath}" must declare name "${target}", got "${definition.name}".`,
    );
  }

  validateTargetIsRushProject(target, rushProjects, "Package target", issues);
  validatePackageArtifact(target, definition, rushProjects, issues);
}

async function validateValidationTarget(
  repository: MetadataContractRepository,
  target: string,
  rushProjects: Map<string, RushProjectDefinition>,
  issues: string[],
): Promise<void> {
  const validationPath = validationTargetDefinitionPath(target);
  const definition = await readParsed(
    repository,
    validationPath,
    `Validation target "${target}" metadata file`,
    parseValidationTarget,
    issues,
  );

  if (!definition) {
    return;
  }

  if (definition.name !== target) {
    issues.push(
      `Validation target metadata "${validationPath}" must declare name "${target}", got "${definition.name}".`,
    );
  }

  validateTargetIsRushProject(
    target,
    rushProjects,
    "Validation target",
    issues,
  );
}

function validateNoOrphanTargets(
  targetKind: string,
  directoryPath: string,
  metadataTargets: string[],
  meshTargets: string[],
  issues: string[],
): void {
  const meshTargetSet = new Set(meshTargets);
  for (const target of metadataTargets) {
    if (!meshTargetSet.has(target)) {
      issues.push(
        `${targetKind} metadata "${directoryPath}/${target}.yaml" is not referenced by services mesh.`,
      );
    }
  }
}

export async function validateMetadataContractRepository(
  repository: MetadataContractRepository,
): Promise<MetadataContractValidationResult> {
  const issues: string[] = [];
  const rushProjects = await loadRushProjects(repository, issues);
  await validateRushCacheMetadata(repository, issues);
  const servicesMesh = await readParsed(
    repository,
    servicesMeshPath,
    "Services mesh",
    parseServicesMesh,
    issues,
  );

  if (!servicesMesh) {
    throw new Error(formatIssueList(issues));
  }

  const deployTargets = Object.keys(servicesMesh.services).sort();

  try {
    buildDeploymentPlan(servicesMesh, deployTargets);
  } catch (error) {
    issues.push(
      `Services mesh deploy graph is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const deployMetadataTargets = await listYamlTargets(
    repository,
    deployTargetsDirectory,
    issues,
  );
  const packageMetadataTargets = await listYamlTargets(
    repository,
    packageTargetsDirectory,
    issues,
  );
  const validationTargets = await listYamlTargets(
    repository,
    validationTargetsDirectory,
    issues,
  );

  validateNoOrphanTargets(
    "Deploy target",
    deployTargetsDirectory,
    deployMetadataTargets,
    deployTargets,
    issues,
  );
  validateNoOrphanTargets(
    "Package target",
    packageTargetsDirectory,
    packageMetadataTargets,
    deployTargets,
    issues,
  );

  await Promise.all(
    deployTargets.flatMap((target) => [
      validateDeployTarget(repository, target, rushProjects, issues),
      validatePackageTarget(repository, target, rushProjects, issues),
    ]),
  );
  await Promise.all(
    validationTargets.map((target) =>
      validateValidationTarget(repository, target, rushProjects, issues),
    ),
  );

  if (issues.length > 0) {
    throw new Error(formatIssueList(issues));
  }

  return {
    deploy_targets: deployTargets,
    package_targets: packageMetadataTargets,
    rush_projects: [...rushProjects.keys()].sort(),
    validation_targets: validationTargets,
  };
}

export function formatMetadataContractValidationResult(
  result: MetadataContractValidationResult,
): string {
  return JSON.stringify(result, null, 2);
}
