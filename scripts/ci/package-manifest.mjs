import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const DEFAULT_PACKAGE_MANIFEST_RELATIVE_PATH =
  ".dagger/runtime/package-manifest.json";

function assertObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
}

function normalizeArtifact(value, targetName) {
  assertObject(
    value,
    `Package manifest artifact "${targetName}" must be an object.`,
  );

  switch (value.kind) {
    case "archive":
      if (typeof value.path !== "string" || value.path.length === 0) {
        throw new Error(
          `Package manifest artifact "${targetName}" path must be a non-empty string.`,
        );
      }

      return {
        kind: "archive",
        path: value.path,
      };

    case "directory":
      if (typeof value.path !== "string" || value.path.length === 0) {
        throw new Error(
          `Package manifest artifact "${targetName}" path must be a non-empty string.`,
        );
      }

      return {
        kind: "directory",
        path: value.path,
      };

    default:
      throw new Error(
        `Package manifest artifact "${targetName}" kind must be "archive" or "directory".`,
      );
  }
}

export function resolvePackageManifestPath(
  path = DEFAULT_PACKAGE_MANIFEST_RELATIVE_PATH,
) {
  return resolve(REPO_ROOT, path);
}

export function validatePackageManifest(value) {
  assertObject(value, "Package manifest must be a JSON object.");
  assertObject(
    value.artifacts,
    'Package manifest field "artifacts" must be an object.',
  );

  return {
    artifacts: Object.fromEntries(
      Object.entries(value.artifacts).map(([targetName, artifact]) => {
        if (typeof targetName !== "string" || targetName.length === 0) {
          throw new Error(
            'Package manifest field "artifacts" must use non-empty target names.',
          );
        }

        return [targetName, normalizeArtifact(artifact, targetName)];
      }),
    ),
  };
}

export function writePackageManifestFile(
  manifest,
  filePath = resolvePackageManifestPath(),
) {
  const packageManifest = validatePackageManifest(manifest);

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `${JSON.stringify(packageManifest, null, 2)}\n`,
    "utf8",
  );

  return packageManifest;
}

export function readPackageManifestFile(
  filePath = resolvePackageManifestPath(),
) {
  return validatePackageManifest(JSON.parse(readFileSync(filePath, "utf8")));
}
