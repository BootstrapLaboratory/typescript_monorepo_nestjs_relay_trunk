export type PrepareCloudflarePagesProjectInput = {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_PAGES_DISABLE_AUTOMATIC_DEPLOYMENTS?: boolean;
  CLOUDFLARE_PAGES_PRODUCTION_BRANCH?: string;
  CLOUDFLARE_PAGES_PROJECT_NAME: string;
};

export type ResolvedPrepareCloudflarePagesProjectInput = {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_PAGES_DISABLE_AUTOMATIC_DEPLOYMENTS: boolean;
  CLOUDFLARE_PAGES_PRODUCTION_BRANCH: string;
  CLOUDFLARE_PAGES_PROJECT_NAME: string;
};

export type CloudflarePagesAutomaticDeploymentStatus =
  | "disabled"
  | "not_applicable"
  | "unchanged";

export type PrepareCloudflarePagesProjectOutput = {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS: CloudflarePagesAutomaticDeploymentStatus;
  CLOUDFLARE_PAGES_PRODUCTION_BRANCH: string;
  CLOUDFLARE_PAGES_PROJECT_NAME: string;
  CLOUDFLARE_PAGES_PROJECT_READY: "true";
  WEBAPP_URL: string;
};

export type CloudflarePagesProject = {
  name: string;
  production_branch?: null | string;
  source?: null | {
    config?: null | {
      deployments_enabled?: null | boolean;
      preview_deployment_setting?: null | "all" | "custom" | "none";
      production_deployments_enabled?: null | boolean;
    };
  };
};

export type CloudflarePagesProviderDeps = {
  pages: {
    disableAutomaticDeployments(input: {
      accountId: string;
      productionBranch: string;
      projectName: string;
    }): Promise<CloudflarePagesProject>;
    ensureProject(input: {
      accountId: string;
      productionBranch: string;
      projectName: string;
    }): Promise<CloudflarePagesProject>;
  };
};
