import { v3 } from "@google-cloud/resource-manager";

import type { CloudRunProviderDeps } from "../types.js";

type GoogleProject = {
  name?: null | string;
};

type ProjectOperation = {
  promise(): Promise<[GoogleProject, unknown?, unknown?]>;
};

export type ProjectsClientLike = {
  createProject(request: {
    project: {
      displayName: string;
      projectId: string;
    };
  }): Promise<[ProjectOperation, unknown?, unknown?]>;
  getProject(request: { name: string }): Promise<[GoogleProject, unknown?, unknown?]>;
};

export function createGoogleProjectsDependency(
  client: ProjectsClientLike = new v3.ProjectsClient() as ProjectsClientLike,
): CloudRunProviderDeps["projects"] {
  return {
    async ensureProject(input) {
      try {
        await client.getProject({
          name: projectResourceName(input.projectId),
        });
        return;
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }

      const [operation] = await client.createProject({
        project: {
          displayName: input.displayName,
          projectId: input.projectId,
        },
      });
      await operation.promise();
    },
    async getProjectNumber(projectId) {
      const [project] = await client.getProject({
        name: projectResourceName(projectId),
      });

      return projectNumberFromName(project.name);
    },
  };
}

export function projectNumberFromName(name: null | string | undefined): string {
  const match = name?.match(/^projects\/(?<projectNumber>\d+)$/);
  const projectNumber = match?.groups?.projectNumber;

  if (projectNumber === undefined) {
    throw new Error(`Project response did not include a numeric resource name.`);
  }

  return projectNumber;
}

function projectResourceName(projectId: string): string {
  return projectId.startsWith("projects/") ? projectId : `projects/${projectId}`;
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
  };

  return (
    maybeError.code === 5 ||
    maybeError.status === "NOT_FOUND" ||
    (typeof maybeError.message === "string" &&
      maybeError.message.includes("NOT_FOUND"))
  );
}
