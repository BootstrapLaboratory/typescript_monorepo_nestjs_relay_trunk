export type RushCacheProvider = "off" | "github";

export type RushCachePolicy = "lazy";

export type RushCacheConfig = {
  key_files: string[];
  paths: string[];
  version: string;
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
