import { auth, iam, type iam_v1 } from "@googleapis/iam";

import type { CloudRunProviderDeps } from "../types.js";

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

type CreateServiceAccountRequest = {
  name: string;
  requestBody: {
    accountId: string;
    serviceAccount: {
      displayName: string;
    };
  };
};

type GetServiceAccountRequest = {
  name: string;
};

type ServiceAccount = iam_v1.Schema$ServiceAccount;

type Response<T> = {
  data: T;
};

export type IamServiceAccountsClientLike = {
  create(request: CreateServiceAccountRequest): Promise<Response<ServiceAccount>>;
  get(request: GetServiceAccountRequest): Promise<Response<ServiceAccount>>;
};

export type GoogleIamDependency = Pick<
  CloudRunProviderDeps["iam"],
  "ensureServiceAccount"
>;

export function createGoogleIamDependency(
  serviceAccounts: IamServiceAccountsClientLike =
    createDefaultIamServiceAccountsClient(),
): GoogleIamDependency {
  return {
    async ensureServiceAccount(input) {
      try {
        await serviceAccounts.get({
          name: serviceAccountResourceName(input),
        });
        return;
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }

      await serviceAccounts.create({
        name: projectResourceName(input.projectId),
        requestBody: {
          accountId: input.accountId,
          serviceAccount: {
            displayName: input.displayName,
          },
        },
      });
    },
  };
}

function createDefaultIamServiceAccountsClient(): IamServiceAccountsClientLike {
  const googleAuth = new auth.GoogleAuth({
    scopes: [CLOUD_PLATFORM_SCOPE],
  });

  return iam({
    auth: googleAuth,
    version: "v1",
  }).projects.serviceAccounts as IamServiceAccountsClientLike;
}

export function projectResourceName(projectId: string): string {
  return `projects/${projectId}`;
}

export function serviceAccountEmail(input: {
  accountId: string;
  projectId: string;
}): string {
  return `${input.accountId}@${input.projectId}.iam.gserviceaccount.com`;
}

export function serviceAccountResourceName(input: {
  accountId: string;
  projectId: string;
}): string {
  return `${projectResourceName(input.projectId)}/serviceAccounts/${serviceAccountEmail(input)}`;
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as {
    code?: unknown;
    response?: {
      status?: unknown;
    };
    status?: unknown;
  };

  return (
    maybeError.code === 404 ||
    maybeError.status === 404 ||
    maybeError.response?.status === 404
  );
}
