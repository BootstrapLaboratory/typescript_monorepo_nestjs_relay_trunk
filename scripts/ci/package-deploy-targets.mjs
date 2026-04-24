#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  resolvePackageManifestPath,
  writePackageManifestFile,
} from "./package-manifest.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

function stripYamlComment(value) {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (character === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (character === "#" && !inSingleQuote && !inDoubleQuote) {
      return value.slice(0, index).trimEnd();
    }
  }

  return value.trimEnd();
}

function parseYamlScalar(value) {
  const normalizedValue = stripYamlComment(value).trim();

  if (!normalizedValue) {
    return "";
  }

  if (
    (normalizedValue.startsWith('"') && normalizedValue.endsWith('"')) ||
    (normalizedValue.startsWith("'") && normalizedValue.endsWith("'"))
  ) {
    return normalizedValue.slice(1, -1);
  }

  return normalizedValue;
}

function requireString(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return value;
}

export function parseDeployTargetsJson(rawValue) {
  const parsedValue = JSON.parse(rawValue ?? "[]");

  if (!Array.isArray(parsedValue)) {
    throw new Error("DEPLOY_TARGETS_JSON must be a JSON array.");
  }

  const targets = [];

  for (const target of parsedValue) {
    if (typeof target !== "string" || target.length === 0) {
      throw new Error("DEPLOY_TARGETS_JSON entries must be non-empty strings.");
    }

    if (!targets.includes(target)) {
      targets.push(target);
    }
  }

  return targets;
}

export function parsePackageTargetMetadata(source, filePath) {
  const lines = source.split(/\r?\n/);
  const metadata = {
    artifact: {},
    name: "",
  };
  let section = "";

  for (const line of lines) {
    const normalizedLine = stripYamlComment(line).trimEnd();

    if (normalizedLine.trim().length === 0) {
      continue;
    }

    const topLevelMatch = normalizedLine.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);

    if (topLevelMatch) {
      const [, key, rawValue] = topLevelMatch;

      section = "";

      if (key === "name") {
        metadata.name = parseYamlScalar(rawValue);
      } else if (key === "artifact") {
        section = "artifact";
      }

      continue;
    }

    const nestedMatch = normalizedLine.match(/^  ([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);

    if (section === "artifact" && nestedMatch) {
      const [, key, rawValue] = nestedMatch;
      metadata.artifact[key] = parseYamlScalar(rawValue);
    }
  }

  const name = requireString(
    metadata.name,
    `Package target metadata file "${filePath}" name`,
  );
  const kind = requireString(
    metadata.artifact.kind,
    `Package target metadata file "${filePath}" artifact kind`,
  );

  switch (kind) {
    case "directory":
      return {
        artifact: {
          kind,
          path: requireString(
            metadata.artifact.path,
            `Package target metadata file "${filePath}" artifact path`,
          ),
        },
        name,
      };

    case "rush_deploy_archive":
      return {
        artifact: {
          kind,
          output: requireString(
            metadata.artifact.output,
            `Package target metadata file "${filePath}" artifact output`,
          ),
          project: requireString(
            metadata.artifact.project,
            `Package target metadata file "${filePath}" artifact project`,
          ),
          scenario: requireString(
            metadata.artifact.scenario,
            `Package target metadata file "${filePath}" artifact scenario`,
          ),
        },
        name,
      };

    default:
      throw new Error(
        `Package target metadata file "${filePath}" has unsupported artifact kind "${kind}".`,
      );
  }
}

export function buildPackageActions(target, definition, artifactPrefix) {
  if (definition.name !== target) {
    throw new Error(
      `Package target metadata for "${target}" must declare name "${target}", got "${definition.name}".`,
    );
  }

  switch (definition.artifact.kind) {
    case "directory":
      return {
        artifact: {
          kind: "directory",
          path: definition.artifact.path,
        },
        commands: [],
        validations: [
          {
            kind: "directory",
            path: definition.artifact.path,
          },
        ],
      };

    case "rush_deploy_archive": {
      const archivePath = `${artifactPrefix}-${target}.tgz`;
      const outputParent = path.dirname(definition.artifact.output);
      const outputName = path.basename(definition.artifact.output);

      return {
        artifact: {
          kind: "archive",
          path: archivePath,
        },
        commands: [
          {
            args: [
              "common/scripts/install-run-rush.js",
              "deploy",
              "-p",
              definition.artifact.project,
              "-s",
              definition.artifact.scenario,
              "-t",
              definition.artifact.output,
              "--overwrite",
            ],
            command: "node",
          },
          {
            args: ["-czf", archivePath, "-C", outputParent, outputName],
            command: "tar",
          },
        ],
        validations: [],
      };
    }

    default:
      throw new Error(`Unsupported package artifact kind "${definition.artifact.kind}".`);
  }
}

function formatCommand(command, args) {
  return [command, ...args].join(" ");
}

function runCommand(command, args) {
  console.log(`[package] ${formatCommand(command, args)}`);
  execFileSync(command, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
}

async function validateDirectory(relativePath) {
  const fullPath = path.resolve(REPO_ROOT, relativePath);
  await access(fullPath);

  const pathStat = await stat(fullPath);

  if (!pathStat.isDirectory()) {
    throw new Error(`Package artifact path "${relativePath}" must be a directory.`);
  }
}

async function loadPackageTarget(target) {
  const relativePath = `.dagger/package/targets/${target}.yaml`;
  const fullPath = path.resolve(REPO_ROOT, relativePath);

  return parsePackageTargetMetadata(await readFile(fullPath, "utf8"), relativePath);
}

export async function packageDeployTargets({
  artifactPrefix = "deploy-target",
  deployTargetsJson = "[]",
  loadPackageTargetDefinition = loadPackageTarget,
  packageManifestPath = undefined,
  runPackageCommand = runCommand,
  validatePackageDirectory = validateDirectory,
} = {}) {
  const targets = parseDeployTargetsJson(deployTargetsJson);

  if (targets.length === 0) {
    throw new Error("No deploy targets were selected.");
  }

  const artifacts = {};

  for (const target of targets) {
    const definition = await loadPackageTargetDefinition(target);
    const packagePlan = buildPackageActions(target, definition, artifactPrefix);

    console.log(`[package] ${target}: ${packagePlan.artifact.kind}`);

    for (const validation of packagePlan.validations) {
      if (validation.kind === "directory") {
        await validatePackageDirectory(validation.path);
      }
    }

    for (const { command, args } of packagePlan.commands) {
      runPackageCommand(command, args);
    }

    artifacts[target] = packagePlan.artifact;
  }

  const manifest = { artifacts };
  writePackageManifestFile(
    manifest,
    packageManifestPath === undefined
      ? resolvePackageManifestPath()
      : packageManifestPath,
  );

  return manifest;
}

async function main() {
  await packageDeployTargets({
    artifactPrefix: process.env.DEPLOY_ARTIFACT_PREFIX ?? "deploy-target",
    deployTargetsJson: process.env.DEPLOY_TARGETS_JSON ?? "[]",
    packageManifestPath: process.env.PACKAGE_MANIFEST_PATH,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
