import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

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

export function parseServicesMeshServiceNames(source) {
  const lines = source.split(/\r?\n/);
  const serviceNames = [];
  let inServicesSection = false;

  for (const line of lines) {
    if (!inServicesSection) {
      if (line.trim() === "services:") {
        inServicesSection = true;
      }
      continue;
    }

    if (line.trim().length === 0) {
      continue;
    }

    if (/^\S/.test(line)) {
      break;
    }

    const serviceMatch = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);

    if (serviceMatch) {
      serviceNames.push(serviceMatch[1]);
    }
  }

  if (serviceNames.length === 0) {
    throw new Error("No deploy targets were found in .dagger/deploy/services-mesh.yaml.");
  }

  return serviceNames;
}

export function parseDeployTargetMetadata(source, filePath) {
  const lines = source.split(/\r?\n/);
  const nameLine = lines.find((line) => line.startsWith("name:"));
  const name = nameLine ? parseYamlScalar(nameLine.slice("name:".length)) : "";

  if (!name) {
    throw new Error(
      `Deploy target metadata file "${filePath}" must declare a non-empty name.`,
    );
  }

  return {
    name,
  };
}

export function loadDeployTargetsFromRepo(repoRoot) {
  const deployMetadataRoot = resolve(repoRoot, ".dagger", "deploy");
  const deployTargetsDir = join(deployMetadataRoot, "targets");
  const servicesMeshPath = join(deployMetadataRoot, "services-mesh.yaml");
  const serviceNames = parseServicesMeshServiceNames(
    readFileSync(servicesMeshPath, "utf8"),
  );
  const targetFiles = readdirSync(deployTargetsDir)
    .filter((entry) => entry.endsWith(".yaml"))
    .sort();
  const targetMetadataByName = new Map();

  for (const targetFile of targetFiles) {
    const filePath = join(deployTargetsDir, targetFile);
    const targetMetadata = parseDeployTargetMetadata(
      readFileSync(filePath, "utf8"),
      filePath,
    );

    if (targetMetadataByName.has(targetMetadata.name)) {
      throw new Error(
        `Duplicate deploy target name "${targetMetadata.name}" found in .dagger/deploy/targets.`,
      );
    }

    targetMetadataByName.set(targetMetadata.name, targetMetadata);
  }

  return serviceNames.map((serviceName) => {
    const targetMetadata = targetMetadataByName.get(serviceName);

    if (!targetMetadata) {
      throw new Error(
        `Deploy target "${serviceName}" is declared in .dagger/deploy/services-mesh.yaml but has no matching target YAML metadata.`,
      );
    }

    return targetMetadata;
  });
}
