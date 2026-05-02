import type {
  ConfigureGitHubRepositoryInput,
  ConfigureGitHubRepositoryOutput,
  GitHubProviderDeps,
  ResolvedConfigureGitHubRepositoryInput,
} from "./types.js";

export const GITHUB_REPOSITORY_VARIABLE_NAMES = [
  "GCP_PROJECT_ID",
  "GCP_WORKLOAD_IDENTITY_PROVIDER",
  "GCP_SERVICE_ACCOUNT",
  "GCP_ARTIFACT_REGISTRY_REPOSITORY",
  "CLOUD_RUN_SERVICE",
  "CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT",
  "CLOUD_RUN_CORS_ORIGIN",
  "CLOUDFLARE_PAGES_PROJECT_NAME",
  "WEBAPP_VITE_GRAPHQL_HTTP",
  "WEBAPP_VITE_GRAPHQL_WS",
] as const;

export const GITHUB_REPOSITORY_SECRET_NAMES = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
] as const;

export async function configureGitHubRepository(
  input: ConfigureGitHubRepositoryInput,
  deps: Pick<GitHubProviderDeps, "repository">,
): Promise<ConfigureGitHubRepositoryOutput> {
  const resolved = resolveConfigureGitHubRepositoryInput(input);

  for (const name of GITHUB_REPOSITORY_VARIABLE_NAMES) {
    await deps.repository.setVariable({
      name,
      repository: resolved.GITHUB_REPOSITORY,
      value: resolved[name],
    });
  }

  for (const name of GITHUB_REPOSITORY_SECRET_NAMES) {
    await deps.repository.setSecret({
      name,
      repository: resolved.GITHUB_REPOSITORY,
      value: resolved[name],
    });
  }

  return {
    GITHUB_REPOSITORY_CONFIGURED: "true",
  };
}

export function resolveConfigureGitHubRepositoryInput(
  input: ConfigureGitHubRepositoryInput,
): ResolvedConfigureGitHubRepositoryInput {
  return {
    CLOUDFLARE_ACCOUNT_ID: requiredText(
      input.CLOUDFLARE_ACCOUNT_ID,
      "CLOUDFLARE_ACCOUNT_ID",
    ),
    CLOUDFLARE_API_TOKEN: requiredText(
      input.CLOUDFLARE_API_TOKEN,
      "CLOUDFLARE_API_TOKEN",
    ),
    CLOUDFLARE_PAGES_PROJECT_NAME: requiredText(
      input.CLOUDFLARE_PAGES_PROJECT_NAME,
      "CLOUDFLARE_PAGES_PROJECT_NAME",
    ),
    CLOUD_RUN_CORS_ORIGIN: requiredText(
      input.CLOUD_RUN_CORS_ORIGIN,
      "CLOUD_RUN_CORS_ORIGIN",
    ),
    CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT: requiredText(
      input.CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT,
      "CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT",
    ),
    CLOUD_RUN_SERVICE: requiredText(
      input.CLOUD_RUN_SERVICE,
      "CLOUD_RUN_SERVICE",
    ),
    GCP_ARTIFACT_REGISTRY_REPOSITORY: requiredText(
      input.GCP_ARTIFACT_REGISTRY_REPOSITORY,
      "GCP_ARTIFACT_REGISTRY_REPOSITORY",
    ),
    GCP_PROJECT_ID: requiredText(input.GCP_PROJECT_ID, "GCP_PROJECT_ID"),
    GCP_SERVICE_ACCOUNT: requiredText(
      input.GCP_SERVICE_ACCOUNT,
      "GCP_SERVICE_ACCOUNT",
    ),
    GCP_WORKLOAD_IDENTITY_PROVIDER: requiredText(
      input.GCP_WORKLOAD_IDENTITY_PROVIDER,
      "GCP_WORKLOAD_IDENTITY_PROVIDER",
    ),
    GITHUB_REPOSITORY: requiredRepository(input.GITHUB_REPOSITORY),
    WEBAPP_VITE_GRAPHQL_HTTP: requiredText(
      input.WEBAPP_VITE_GRAPHQL_HTTP,
      "WEBAPP_VITE_GRAPHQL_HTTP",
    ),
    WEBAPP_VITE_GRAPHQL_WS: requiredText(
      input.WEBAPP_VITE_GRAPHQL_WS,
      "WEBAPP_VITE_GRAPHQL_WS",
    ),
  };
}

function requiredRepository(value: string): string {
  const repository = requiredText(value, "GITHUB_REPOSITORY");

  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error("GITHUB_REPOSITORY must use owner/repo format.");
  }

  return repository;
}

function requiredText(value: string, name: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${name} is required.`);
  }

  return trimmed;
}
