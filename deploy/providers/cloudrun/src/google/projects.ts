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
  getProject(request: {
    name: string;
  }): Promise<[GoogleProject, unknown?, unknown?]>;
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
        if (!isInconclusiveProjectLookupError(error)) {
          throw error;
        }
      }

      try {
        const [operation] = await client.createProject({
          project: {
            displayName: input.displayName,
            projectId: input.projectId,
          },
        });
        await operation.promise();
      } catch (error) {
        const deletedProjectId = deletedProjectIdFromError(error);
        if (deletedProjectId !== undefined) {
          throw new Error(
            deletedProjectId === input.projectId
              ? [
                  `Google Cloud project ID "${input.projectId}" belongs to a deleted project and cannot be reused yet.`,
                  "Rerun the scenario with --fresh to generate a new project ID,",
                  "or provide a different PROJECT_ID.",
                  error instanceof Error
                    ? `Cause: ${error.message}`
                    : undefined,
                ]
                  .filter((line) => line !== undefined)
                  .join("\n")
              : [
                  `Google Application Default Credentials use deleted quota project "${deletedProjectId}".`,
                  "The ADC quota project is only used for Google API quota attribution; it is not the deployment target.",
                  "For fresh-project scenarios, recreate ADC without copying the current gcloud project:",
                  "`gcloud auth application-default revoke`",
                  "`gcloud auth application-default login --disable-quota-project`",
                  "Then rerun the scenario.",
                  error instanceof Error
                    ? `Cause: ${error.message}`
                    : undefined,
                ]
                  .filter((line) => line !== undefined)
                  .join("\n"),
          );
        }

        if (isPermissionDeniedError(error)) {
          throw new Error(
            [
              `Unable to create Google Cloud project "${input.projectId}".`,
              "Use credentials with resourcemanager.projects.create permission,",
              "or provide an existing project ID that the account can access.",
              error instanceof Error ? `Cause: ${error.message}` : undefined,
            ]
              .filter((line) => line !== undefined)
              .join("\n"),
          );
        }

        throw error;
      }
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
    throw new Error(
      `Project response did not include a numeric resource name.`,
    );
  }

  return projectNumber;
}

function projectResourceName(projectId: string): string {
  return projectId.startsWith("projects/")
    ? projectId
    : `projects/${projectId}`;
}

function isNotFoundError(error: unknown): boolean {
  return matchesGoogleError(error, {
    code: 5,
    message: "NOT_FOUND",
    status: "NOT_FOUND",
  });
}

function isPermissionDeniedError(error: unknown): boolean {
  return matchesGoogleError(error, {
    code: 7,
    message: "PERMISSION_DENIED",
    status: "PERMISSION_DENIED",
  });
}

function isInconclusiveProjectLookupError(error: unknown): boolean {
  return isNotFoundError(error) || isPermissionDeniedError(error);
}

function matchesGoogleError(
  error: unknown,
  expected: { code: number; message: string; status: string },
): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
  };

  return (
    maybeError.code === expected.code ||
    maybeError.status === expected.status ||
    (typeof maybeError.message === "string" &&
      maybeError.message.includes(expected.message))
  );
}

function deletedProjectIdFromError(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const maybeError = error as {
    message?: unknown;
  };

  if (typeof maybeError.message !== "string") {
    return undefined;
  }

  const match = maybeError.message.match(
    /Project (?<projectId>[a-z][a-z0-9-]+) has been deleted/i,
  );
  return match?.groups?.projectId;
}
