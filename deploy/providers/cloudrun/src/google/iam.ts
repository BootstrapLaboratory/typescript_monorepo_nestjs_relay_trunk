import { auth, iam, type iam_v1 } from "@googleapis/iam";
import { protos, v3 } from "@google-cloud/resource-manager";

import { addIamBindingMember } from "./iam-policy.js";
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

type GetProjectIamPolicyRequest = {
  resource: string;
};

type SetProjectIamPolicyRequest = {
  policy: ProjectIamPolicy;
  resource: string;
};

type ProjectIamPolicy = protos.google.iam.v1.IPolicy;
type ServiceAccount = iam_v1.Schema$ServiceAccount;

type Response<T> = {
  data: T;
};

export type IamServiceAccountsClientLike = {
  create(request: CreateServiceAccountRequest): Promise<Response<ServiceAccount>>;
  get(request: GetServiceAccountRequest): Promise<Response<ServiceAccount>>;
};

export type IamProjectsClientLike = {
  getIamPolicy(
    request: GetProjectIamPolicyRequest,
  ): Promise<[ProjectIamPolicy, unknown?, unknown?]>;
  setIamPolicy(
    request: SetProjectIamPolicyRequest,
  ): Promise<[ProjectIamPolicy, unknown?, unknown?]>;
};

export type GoogleIamDependency = Pick<
  CloudRunProviderDeps["iam"],
  "ensureProjectIamBinding" | "ensureServiceAccount"
>;

export function createGoogleIamDependency(
  serviceAccounts: IamServiceAccountsClientLike =
    createDefaultIamServiceAccountsClient(),
  projects?: IamProjectsClientLike,
): GoogleIamDependency {
  return {
    async ensureProjectIamBinding(input) {
      const projectIam = projects ?? createDefaultIamProjectsClient();
      const resource = projectResourceName(input.projectId);
      const [policy] = await projectIam.getIamPolicy({
        resource,
      });
      const nextPolicy = addIamBindingMember(policy, {
        member: input.member,
        role: input.role,
      });

      if (nextPolicy === policy) {
        return;
      }

      await projectIam.setIamPolicy({
        policy: nextPolicy,
        resource,
      });
    },
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

function createDefaultIamProjectsClient(): IamProjectsClientLike {
  return new v3.ProjectsClient() as IamProjectsClientLike;
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
