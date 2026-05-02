import { createGitHubCliRepositoryDependency } from "./cli.js";
import type { GitHubProviderDeps } from "../types.js";

export type GitHubProviderDepsFactories = {
  repository?: () => GitHubProviderDeps["repository"];
};

export function createGitHubProviderDeps(
  factories: GitHubProviderDepsFactories = {},
): GitHubProviderDeps {
  return {
    repository:
      factories.repository?.() ?? createGitHubCliRepositoryDependency(),
  };
}
