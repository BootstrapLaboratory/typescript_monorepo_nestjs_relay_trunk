export type RushCacheProvider = "off" | "github";

export type RushCachePolicy = "lazy";

export type RushCacheConfig = {
  key_files: string[];
  paths: string[];
  version: string;
};

export type RushCacheKeyFile = {
  contents: string;
  path: string;
};

export type RushCacheSpec = {
  keyFiles: RushCacheKeyFile[];
  paths: string[];
  toolchainIdentity: string;
  version: string;
};

export type NormalizedRushCacheSpec = {
  key_files: RushCacheKeyFile[];
  paths: string[];
  toolchain_identity: string;
  version: string;
};

export type RushCacheReference = {
  imagePath: string;
  reference: string;
  registry: string;
  repository: string;
  tag: string;
};

export type RushCacheResolution = {
  cacheHit: boolean;
  paths: string[];
  provider: RushCacheProvider;
  reference?: RushCacheReference;
  spec: RushCacheSpec;
  tempFolder: string;
};

export type GithubRushCacheProviderDefinition = {
  image_namespace: string;
  kind: "github_container_registry";
  registry: string;
  repository_env: string;
  token_env: string;
  username_env: string;
};

export type RushCacheProvidersDefinition = {
  cache: RushCacheConfig;
  providers: {
    github?: GithubRushCacheProviderDefinition;
  };
};
