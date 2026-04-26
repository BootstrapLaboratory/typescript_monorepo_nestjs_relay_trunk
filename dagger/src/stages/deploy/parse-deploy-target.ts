import { parse as parseYaml } from "yaml";

import { assertKnownKeys } from "../../metadata/parse-utils.ts";
import type {
  DeployRuntimeSpec,
  DeployTargetDefinition,
  DeployWorkspaceSpec,
  FileMountSpec,
} from "../../model/deploy-target.ts";

const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function parseRequiredString(rawValue: unknown, name: string): string {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return rawValue;
}

function parseStringArray(
  rawValue: unknown,
  name: string,
  itemName: string,
): string[] {
  if (rawValue === undefined) {
    return [];
  }

  if (!Array.isArray(rawValue)) {
    throw new Error(`${name} must be an array.`);
  }

  const normalizedValues: string[] = [];

  for (const rawEntry of rawValue) {
    normalizedValues.push(parseRequiredString(rawEntry, itemName));
  }

  return normalizedValues;
}

function parseEnvNameArray(
  rawValue: unknown,
  name: string,
  itemName: string,
): string[] {
  const values = parseStringArray(rawValue, name, itemName);
  const normalizedValues: string[] = [];

  for (const value of values) {
    if (!ENV_NAME_PATTERN.test(value)) {
      throw new Error(`${itemName} must match ${ENV_NAME_PATTERN}.`);
    }

    if (!normalizedValues.includes(value)) {
      normalizedValues.push(value);
    }
  }

  return normalizedValues;
}

function parseRepoRelativePath(rawValue: unknown, name: string): string {
  const value = parseRequiredString(rawValue, name).replace(/\\/g, "/");
  const normalizedValue = value.replace(/^\.\/+/, "").replace(/\/+$/, "");

  if (normalizedValue.length === 0 || normalizedValue === ".") {
    throw new Error(`${name} must be a repository-relative path.`);
  }

  if (normalizedValue.startsWith("/") || /^[A-Za-z]:\//.test(normalizedValue)) {
    throw new Error(`${name} must be a repository-relative path.`);
  }

  if (normalizedValue.split("/").some((segment) => segment === "..")) {
    throw new Error(`${name} must stay inside the repository.`);
  }

  return normalizedValue;
}

function parseRepoRelativePathArray(
  rawValue: unknown,
  name: string,
  itemName: string,
): string[] {
  const values = parseStringArray(rawValue, name, itemName);
  const normalizedValues: string[] = [];

  for (const value of values) {
    const normalizedValue = parseRepoRelativePath(value, itemName);

    if (!normalizedValues.includes(normalizedValue)) {
      normalizedValues.push(normalizedValue);
    }
  }

  return normalizedValues;
}

function parseStringRecord(
  rawValue: unknown,
  name: string,
  keyName: string,
): Record<string, string> {
  if (rawValue === undefined) {
    return {};
  }

  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error(`${name} must be a mapping.`);
  }

  const normalizedValues: Record<string, string> = {};

  for (const [rawKey, rawEntry] of Object.entries(rawValue)) {
    if (!ENV_NAME_PATTERN.test(rawKey)) {
      throw new Error(`${keyName} "${rawKey}" must match ${ENV_NAME_PATTERN}.`);
    }

    if (typeof rawEntry !== "string") {
      throw new Error(`${name} value for "${rawKey}" must be a string.`);
    }

    normalizedValues[rawKey] = rawEntry;
  }

  return normalizedValues;
}

function parseFileMountSpecs(rawValue: unknown, name: string): FileMountSpec[] {
  if (rawValue === undefined) {
    return [];
  }

  if (!Array.isArray(rawValue)) {
    throw new Error(`${name} must be an array.`);
  }

  const normalizedSpecs: FileMountSpec[] = [];

  for (const rawEntry of rawValue) {
    if (
      typeof rawEntry !== "object" ||
      rawEntry === null ||
      Array.isArray(rawEntry)
    ) {
      throw new Error(`${name} entries must be mappings.`);
    }

    assertKnownKeys(
      rawEntry as Record<string, unknown>,
      ["source_var", "target"],
      "Deploy target runtime file_mounts entry",
    );

    const sourceVar = parseRequiredString(
      "source_var" in rawEntry ? rawEntry.source_var : undefined,
      "file mount source_var",
    );
    const target = parseRequiredString(
      "target" in rawEntry ? rawEntry.target : undefined,
      "file mount target",
    );

    if (!ENV_NAME_PATTERN.test(sourceVar)) {
      throw new Error(
        `file mount source_var "${sourceVar}" must match ${ENV_NAME_PATTERN}.`,
      );
    }

    normalizedSpecs.push({
      source_var: sourceVar,
      target,
    });
  }

  return normalizedSpecs;
}

function parseWorkspace(rawValue: unknown): DeployWorkspaceSpec {
  if (rawValue === undefined) {
    return {
      dirs: [],
      files: [],
    };
  }

  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error("Deploy target runtime workspace must be a mapping.");
  }

  assertKnownKeys(
    rawValue as Record<string, unknown>,
    ["dirs", "files", "mode"],
    "Deploy target runtime workspace",
  );

  const mode = "mode" in rawValue ? rawValue.mode : undefined;
  if (mode !== undefined && mode !== "full") {
    throw new Error('Deploy target runtime workspace mode must be "full".');
  }

  return {
    dirs: parseRepoRelativePathArray(
      "dirs" in rawValue ? rawValue.dirs : undefined,
      "Deploy target runtime workspace dirs",
      "Deploy target runtime workspace dirs entry",
    ),
    files: parseRepoRelativePathArray(
      "files" in rawValue ? rawValue.files : undefined,
      "Deploy target runtime workspace files",
      "Deploy target runtime workspace files entry",
    ),
    ...(mode === "full" ? { mode } : {}),
  };
}

function parseRuntime(rawValue: unknown): DeployRuntimeSpec {
  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error("Deploy target runtime must be a mapping.");
  }

  assertKnownKeys(
    rawValue as Record<string, unknown>,
    [
      "dry_run_defaults",
      "env",
      "file_mounts",
      "image",
      "install",
      "pass_env",
      "required_host_env",
      "workspace",
    ],
    "Deploy target runtime",
  );

  return {
    dry_run_defaults: parseStringRecord(
      "dry_run_defaults" in rawValue ? rawValue.dry_run_defaults : undefined,
      "Deploy target runtime dry_run_defaults",
      "Deploy target runtime dry_run_defaults key",
    ),
    env: parseStringRecord(
      "env" in rawValue ? rawValue.env : undefined,
      "Deploy target runtime env",
      "Deploy target runtime env key",
    ),
    file_mounts: parseFileMountSpecs(
      "file_mounts" in rawValue ? rawValue.file_mounts : undefined,
      "Deploy target runtime file_mounts",
    ) as FileMountSpec[],
    image: parseRequiredString(
      "image" in rawValue ? rawValue.image : undefined,
      "Deploy target runtime image",
    ),
    install: parseStringArray(
      "install" in rawValue ? rawValue.install : undefined,
      "Deploy target runtime install",
      "Deploy target runtime install entry",
    ),
    pass_env: parseEnvNameArray(
      "pass_env" in rawValue ? rawValue.pass_env : undefined,
      "Deploy target runtime pass_env",
      "Deploy target runtime pass_env entry",
    ),
    required_host_env: parseEnvNameArray(
      "required_host_env" in rawValue ? rawValue.required_host_env : undefined,
      "Deploy target runtime required_host_env",
      "Deploy target runtime required_host_env entry",
    ),
    workspace: parseWorkspace(
      "workspace" in rawValue ? rawValue.workspace : undefined,
    ),
  };
}

export function parseDeployTarget(
  deployTargetYaml: string,
): DeployTargetDefinition {
  const parsedValue = parseYaml(deployTargetYaml);

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error("Deploy target file must define a top-level mapping.");
  }

  assertKnownKeys(
    parsedValue as Record<string, unknown>,
    ["deploy_script", "name", "runtime"],
    "Deploy target file",
  );

  return {
    deploy_script: parseRequiredString(
      "deploy_script" in parsedValue ? parsedValue.deploy_script : undefined,
      "Deploy target deploy_script",
    ),
    name: parseRequiredString(
      "name" in parsedValue ? parsedValue.name : undefined,
      "Deploy target name",
    ),
    runtime: parseRuntime(
      "runtime" in parsedValue ? parsedValue.runtime : undefined,
    ),
  };
}
