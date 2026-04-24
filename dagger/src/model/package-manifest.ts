export type PackageManifestArtifact =
  | {
      deploy_path: string;
      kind: "archive";
      path: string;
    }
  | {
      deploy_path: string;
      kind: "directory";
      path: string;
    };

export type PackageManifest = {
  artifacts: Record<string, PackageManifestArtifact>;
};
