export type PackageArtifactDefinition =
  | {
      kind: "directory";
      path: string;
    }
  | {
      kind: "rush_deploy_archive";
      output: string;
      project: string;
      scenario: string;
    };

export type PackageTargetDefinition = {
  artifact: PackageArtifactDefinition;
  name: string;
};
