import Cloudflare from "cloudflare";

import type {
  CloudflarePagesProject,
  CloudflarePagesProviderDeps,
} from "../types.js";

export type CloudflarePagesClientLike = {
  pages: {
    projects: {
      create(params: {
        account_id: string;
        name: string;
        production_branch: string;
      }): Promise<CloudflarePagesProject>;
      edit(
        projectName: string,
        params: {
          account_id: string;
          production_branch?: string;
          source?: {
            config: {
              deployments_enabled: false;
              preview_deployment_setting: "none";
              production_deployments_enabled: false;
            };
          };
        },
      ): Promise<CloudflarePagesProject>;
      get(
        projectName: string,
        params: {
          account_id: string;
        },
      ): Promise<CloudflarePagesProject>;
    };
  };
};

export function createCloudflarePagesDependency(
  client: CloudflarePagesClientLike,
): CloudflarePagesProviderDeps["pages"] {
  return {
    async disableAutomaticDeployments(input) {
      await client.pages.projects.edit(input.projectName, {
        account_id: input.accountId,
        production_branch: input.productionBranch,
        source: {
          config: {
            deployments_enabled: false,
            preview_deployment_setting: "none",
            production_deployments_enabled: false,
          },
        },
      });

      const verifiedProject = await client.pages.projects.get(
        input.projectName,
        {
          account_id: input.accountId,
        },
      );

      assertAutomaticDeploymentsDisabled(verifiedProject);

      return verifiedProject;
    },
    async ensureProject(input) {
      try {
        const project = await client.pages.projects.get(input.projectName, {
          account_id: input.accountId,
        });

        if (project.production_branch !== input.productionBranch) {
          return await client.pages.projects.edit(input.projectName, {
            account_id: input.accountId,
            production_branch: input.productionBranch,
          });
        }

        return project;
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }

        return await client.pages.projects.create({
          account_id: input.accountId,
          name: input.projectName,
          production_branch: input.productionBranch,
        });
      }
    },
  };
}

export function createCloudflarePagesClient(
  input: {
    apiToken?: string;
  } = {},
): CloudflarePagesClientLike {
  const apiToken = input.apiToken ?? process.env.CLOUDFLARE_API_TOKEN;

  if (apiToken === undefined || apiToken.trim().length === 0) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN is required to create the Cloudflare Pages provider client.",
    );
  }

  return new Cloudflare({
    apiToken,
  }) as unknown as CloudflarePagesClientLike;
}

function assertAutomaticDeploymentsDisabled(
  project: CloudflarePagesProject,
): void {
  const config = project.source?.config;

  if (config === undefined || config === null) {
    return;
  }

  if (
    config.deployments_enabled === false &&
    config.production_deployments_enabled === false &&
    config.preview_deployment_setting === "none"
  ) {
    return;
  }

  throw new Error(
    `Cloudflare Pages project "${project.name}" still has automatic deployments enabled.`,
  );
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as {
    message?: unknown;
    status?: unknown;
  };

  return (
    maybeError.status === 404 ||
    (typeof maybeError.message === "string" &&
      maybeError.message.includes("404"))
  );
}
