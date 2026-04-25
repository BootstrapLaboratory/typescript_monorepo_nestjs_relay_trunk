import { parse as parseYaml } from "yaml";

import { assertKnownKeys } from "../../metadata/parse-utils.ts";
import type {
  PackageArtifactDefinition,
  PackageTargetDefinition,
} from "../../model/package-target.ts";

function parseRequiredString(rawValue: unknown, name: string): string {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return rawValue;
}

function parsePackageArtifact(rawValue: unknown): PackageArtifactDefinition {
  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error("Package target artifact must be a mapping.");
  }

  const kind = parseRequiredString(
    "kind" in rawValue ? rawValue.kind : undefined,
    "Package target artifact kind",
  );

  switch (kind) {
    case "directory":
      assertKnownKeys(
        rawValue as Record<string, unknown>,
        ["kind", "path"],
        "Package target artifact",
      );
      return {
        kind,
        path: parseRequiredString(
          "path" in rawValue ? rawValue.path : undefined,
          "Package target artifact path",
        ),
      };

    case "rush_deploy_archive":
      assertKnownKeys(
        rawValue as Record<string, unknown>,
        ["kind", "output", "project", "scenario"],
        "Package target artifact",
      );
      return {
        kind,
        output: parseRequiredString(
          "output" in rawValue ? rawValue.output : undefined,
          "Package target artifact output",
        ),
        project: parseRequiredString(
          "project" in rawValue ? rawValue.project : undefined,
          "Package target artifact project",
        ),
        scenario: parseRequiredString(
          "scenario" in rawValue ? rawValue.scenario : undefined,
          "Package target artifact scenario",
        ),
      };

    default:
      throw new Error(`Unsupported package target artifact kind "${kind}".`);
  }
}

export function parsePackageTarget(
  packageTargetYaml: string,
): PackageTargetDefinition {
  const parsedValue = parseYaml(packageTargetYaml);

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error("Package target file must define a top-level mapping.");
  }

  assertKnownKeys(
    parsedValue as Record<string, unknown>,
    ["artifact", "name"],
    "Package target file",
  );

  return {
    artifact: parsePackageArtifact(
      "artifact" in parsedValue ? parsedValue.artifact : undefined,
    ),
    name: parseRequiredString(
      "name" in parsedValue ? parsedValue.name : undefined,
      "Package target name",
    ),
  };
}
