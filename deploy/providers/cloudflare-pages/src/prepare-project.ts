import type {
  CloudflarePagesAutomaticDeploymentStatus,
  CloudflarePagesProject,
  CloudflarePagesProviderDeps,
  PrepareCloudflarePagesProjectInput,
  PrepareCloudflarePagesProjectOutput,
  ResolvedPrepareCloudflarePagesProjectInput,
} from "./types.js";

export async function prepareCloudflarePagesProject(
  input: PrepareCloudflarePagesProjectInput,
  deps: Pick<CloudflarePagesProviderDeps, "pages">,
): Promise<PrepareCloudflarePagesProjectOutput> {
  const resolved = resolvePrepareCloudflarePagesProjectInput(input);

  const project = await deps.pages.ensureProject({
    accountId: resolved.CLOUDFLARE_ACCOUNT_ID,
    productionBranch: resolved.CLOUDFLARE_PAGES_PRODUCTION_BRANCH,
    projectName: resolved.CLOUDFLARE_PAGES_PROJECT_NAME,
  });

  const shouldDisableAutomaticDeployments =
    resolved.CLOUDFLARE_PAGES_DISABLE_AUTOMATIC_DEPLOYMENTS &&
    automaticDeploymentStatus(project) !== "not_applicable";

  const configuredProject = shouldDisableAutomaticDeployments
    ? await deps.pages.disableAutomaticDeployments({
        accountId: resolved.CLOUDFLARE_ACCOUNT_ID,
        productionBranch: resolved.CLOUDFLARE_PAGES_PRODUCTION_BRANCH,
        projectName: resolved.CLOUDFLARE_PAGES_PROJECT_NAME,
      })
    : project;

  return {
    CLOUDFLARE_ACCOUNT_ID: resolved.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS:
      resolved.CLOUDFLARE_PAGES_DISABLE_AUTOMATIC_DEPLOYMENTS
        ? automaticDeploymentStatus(configuredProject)
        : "unchanged",
    CLOUDFLARE_PAGES_PRODUCTION_BRANCH:
      resolved.CLOUDFLARE_PAGES_PRODUCTION_BRANCH,
    CLOUDFLARE_PAGES_PROJECT_NAME: resolved.CLOUDFLARE_PAGES_PROJECT_NAME,
    CLOUDFLARE_PAGES_PROJECT_READY: "true",
    WEBAPP_URL: pagesUrl(resolved.CLOUDFLARE_PAGES_PROJECT_NAME),
  };
}

export function resolvePrepareCloudflarePagesProjectInput(
  input: PrepareCloudflarePagesProjectInput,
): ResolvedPrepareCloudflarePagesProjectInput {
  return {
    CLOUDFLARE_ACCOUNT_ID: requiredText(
      input.CLOUDFLARE_ACCOUNT_ID,
      "CLOUDFLARE_ACCOUNT_ID",
    ),
    CLOUDFLARE_PAGES_DISABLE_AUTOMATIC_DEPLOYMENTS:
      input.CLOUDFLARE_PAGES_DISABLE_AUTOMATIC_DEPLOYMENTS ?? true,
    CLOUDFLARE_PAGES_PRODUCTION_BRANCH:
      input.CLOUDFLARE_PAGES_PRODUCTION_BRANCH ?? "main",
    CLOUDFLARE_PAGES_PROJECT_NAME: requiredText(
      input.CLOUDFLARE_PAGES_PROJECT_NAME,
      "CLOUDFLARE_PAGES_PROJECT_NAME",
    ),
  };
}

export function automaticDeploymentStatus(
  project: CloudflarePagesProject,
): CloudflarePagesAutomaticDeploymentStatus {
  const config = project.source?.config;

  if (config === undefined || config === null) {
    return "not_applicable";
  }

  if (
    config.deployments_enabled === false &&
    config.production_deployments_enabled === false &&
    config.preview_deployment_setting === "none"
  ) {
    return "disabled";
  }

  return "unchanged";
}

export function pagesUrl(projectName: string): string {
  return `https://${projectName}.pages.dev`;
}

function requiredText(value: string, name: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${name} is required.`);
  }

  return trimmed;
}
