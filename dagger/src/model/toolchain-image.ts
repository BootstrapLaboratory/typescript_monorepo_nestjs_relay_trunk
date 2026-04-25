export type ToolchainImageKind = "deploy-executor";

export type ToolchainImageProvider = "off" | "github";

export type ToolchainImagePolicy = "lazy";

export type ToolchainImageSpec = {
  baseImage: string;
  env: Record<string, string>;
  install: string[];
  kind: ToolchainImageKind;
  name: string;
  version: string;
};

export type NormalizedToolchainImageSpec = {
  base_image: string;
  env: Record<string, string>;
  install: string[];
  kind: ToolchainImageKind;
  name: string;
  version: string;
};

export type ToolchainImageReference = {
  imagePath: string;
  reference: string;
  registry: string;
  repository: string;
  tag: string;
};
