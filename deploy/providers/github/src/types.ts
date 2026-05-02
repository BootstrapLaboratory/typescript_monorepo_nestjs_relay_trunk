export type ConfigureGitHubRepositoryInput = {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_PAGES_PROJECT_NAME: string;
  CLOUD_RUN_CORS_ORIGIN: string;
  CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT: string;
  CLOUD_RUN_SERVICE: string;
  GCP_ARTIFACT_REGISTRY_REPOSITORY: string;
  GCP_PROJECT_ID: string;
  GCP_SERVICE_ACCOUNT: string;
  GCP_WORKLOAD_IDENTITY_PROVIDER: string;
  GITHUB_REPOSITORY: string;
  WEBAPP_VITE_GRAPHQL_HTTP: string;
  WEBAPP_VITE_GRAPHQL_WS: string;
};

export type ResolvedConfigureGitHubRepositoryInput =
  ConfigureGitHubRepositoryInput;

export type ConfigureGitHubRepositoryOutput = {
  GITHUB_REPOSITORY_CONFIGURED: "true";
};

export type GitHubProviderDeps = {
  repository: {
    setSecret(input: GitHubRepositoryValueInput): Promise<void>;
    setVariable(input: GitHubRepositoryValueInput): Promise<void>;
  };
};

export type GitHubRepositoryValueInput = {
  name: string;
  repository: string;
  value: string;
};
