import type {
  PackageManifest,
  PackageManifestArtifact,
} from "../../model/package-manifest.ts";

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

export function validatePackageManifest(rawValue: unknown): PackageManifest {
  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error("Package manifest must be a JSON object.");
  }

  if (
    !("artifacts" in rawValue) ||
    typeof rawValue.artifacts !== "object" ||
    rawValue.artifacts === null ||
    Array.isArray(rawValue.artifacts)
  ) {
    throw new Error('Package manifest field "artifacts" must be an object.');
  }

  return {
    artifacts: Object.fromEntries(
      Object.entries(rawValue.artifacts).map(([target, artifact]) => {
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

export function parsePackageManifest(source: string): PackageManifest {
  return validatePackageManifest(JSON.parse(source));
}

export function formatPackageManifest(manifest: PackageManifest): string {
  return `${JSON.stringify(validatePackageManifest(manifest), null, 2)}\n`;
}

export function createEmptyPackageManifest(): PackageManifest {
  return {
    artifacts: {},
  };
}
