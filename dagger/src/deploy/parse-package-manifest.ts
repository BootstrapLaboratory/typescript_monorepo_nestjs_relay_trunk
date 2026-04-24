import type {
  PackageManifest,
  PackageManifestArtifact,
} from "../model/package-manifest.ts";

function parseRequiredString(rawValue: unknown, name: string): string {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return rawValue;
}

function parseDeployPath(rawValue: unknown, name: string): string {
  const deployPath = parseRequiredString(rawValue, name);

  if (deployPath.startsWith("/")) {
    throw new Error(`${name} must be relative.`);
  }

  return deployPath;
}

function parseArtifact(
  rawValue: unknown,
  target: string,
): PackageManifestArtifact {
  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error(`Package manifest artifact "${target}" must be a mapping.`);
  }

  const kind = parseRequiredString(
    "kind" in rawValue ? rawValue.kind : undefined,
    `Package manifest artifact "${target}" kind`,
  );

  switch (kind) {
    case "archive":
      return {
        deploy_path: parseDeployPath(
          "deploy_path" in rawValue ? rawValue.deploy_path : undefined,
          `Package manifest artifact "${target}" deploy_path`,
        ),
        kind,
        path: parseRequiredString(
          "path" in rawValue ? rawValue.path : undefined,
          `Package manifest artifact "${target}" path`,
        ),
      };

    case "directory":
      return {
        deploy_path: parseDeployPath(
          "deploy_path" in rawValue ? rawValue.deploy_path : undefined,
          `Package manifest artifact "${target}" deploy_path`,
        ),
        kind,
        path: parseRequiredString(
          "path" in rawValue ? rawValue.path : undefined,
          `Package manifest artifact "${target}" path`,
        ),
      };

    default:
      throw new Error(
        `Package manifest artifact "${target}" kind must be "archive" or "directory".`,
      );
  }
}

export function parsePackageManifest(source: string): PackageManifest {
  const parsedValue = JSON.parse(source);

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error("Package manifest must be a JSON object.");
  }

  if (
    !("artifacts" in parsedValue) ||
    typeof parsedValue.artifacts !== "object" ||
    parsedValue.artifacts === null ||
    Array.isArray(parsedValue.artifacts)
  ) {
    throw new Error('Package manifest field "artifacts" must be an object.');
  }

  return {
    artifacts: Object.fromEntries(
      Object.entries(parsedValue.artifacts).map(([target, artifact]) => {
        if (target.length === 0) {
          throw new Error(
            'Package manifest field "artifacts" must use non-empty target names.',
          );
        }

        return [target, parseArtifact(artifact, target)];
      }),
    ),
  };
}
