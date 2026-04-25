import path from "node:path";

import type { PackageManifestArtifact } from "../../model/package-manifest.ts";
import type { PackageTargetDefinition } from "../../model/package-target.ts";

export type PackageCommand = {
  args: string[];
  command: "node" | "tar";
};

export type PackageValidation = {
  kind: "directory";
  path: string;
};

export type PackageActionPlan = {
  artifact: PackageManifestArtifact;
  commands: PackageCommand[];
  validations: PackageValidation[];
};

export function buildPackageActionPlan(
  target: string,
  definition: PackageTargetDefinition,
  artifactPrefix: string,
): PackageActionPlan {
  if (definition.name !== target) {
    throw new Error(
      `Package target metadata for "${target}" must declare name "${target}", got "${definition.name}".`,
    );
  }

  switch (definition.artifact.kind) {
    case "directory":
      return {
        artifact: {
          deploy_path: definition.artifact.path,
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
      const outputParent = path.posix.dirname(definition.artifact.output);
      const outputName = path.posix.basename(definition.artifact.output);

      return {
        artifact: {
          deploy_path: definition.artifact.output,
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
      throw new Error("Unsupported package target artifact kind.");
  }
}
