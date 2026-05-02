import { v1 } from "@google-cloud/secret-manager";

import { addIamBindingMember, type IamPolicyLike } from "./iam-policy.js";
import type { CloudRunProviderDeps } from "../types.js";

type SecretManagerSecretLike = object;

export type SecretManagerClientLike = {
  addSecretVersion(request: {
    parent: string;
    payload: {
      data: Buffer;
    };
  }): Promise<[unknown, unknown?, unknown?]>;
  createSecret(request: {
    parent: string;
    secret: {
      replication: {
        automatic: Record<string, never>;
      };
    };
    secretId: string;
  }): Promise<[SecretManagerSecretLike, unknown?, unknown?]>;
  getIamPolicy(request: {
    resource: string;
  }): Promise<[IamPolicyLike, unknown?, unknown?]>;
  getSecret(request: {
    name: string;
  }): Promise<[SecretManagerSecretLike, unknown?, unknown?]>;
  setIamPolicy(request: {
    policy: IamPolicyLike;
    resource: string;
  }): Promise<[IamPolicyLike, unknown?, unknown?]>;
};

export function createGoogleSecretManagerDependency(
  client: SecretManagerClientLike = new v1.SecretManagerServiceClient() as unknown as SecretManagerClientLike,
): CloudRunProviderDeps["secretManager"] {
  return {
    async ensureSecretIamBinding(input) {
      const resource = secretResourceName({
        projectId: input.projectId,
        secretName: input.secretName,
      });
      const [policy] = await client.getIamPolicy({
        resource,
      });
      const nextPolicy = addIamBindingMember(policy, {
        member: input.member,
        role: input.role,
      });

      if (nextPolicy === policy) {
        return;
      }

      await client.setIamPolicy({
        policy: nextPolicy,
        resource,
      });
    },
    async upsertSecretVersion(input) {
      const resource = secretResourceName({
        projectId: input.projectId,
        secretName: input.secretName,
      });

      try {
        await client.getSecret({
          name: resource,
        });
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }

        await client.createSecret({
          parent: projectParent(input.projectId),
          secret: {
            replication: {
              automatic: {},
            },
          },
          secretId: input.secretName,
        });
      }

      await client.addSecretVersion({
        parent: resource,
        payload: {
          data: Buffer.from(input.value, "utf8"),
        },
      });
    },
  };
}

export function projectParent(projectId: string): string {
  return projectId.startsWith("projects/")
    ? projectId
    : `projects/${projectId}`;
}

export function secretResourceName(input: {
  projectId: string;
  secretName: string;
}): string {
  return `${projectParent(input.projectId)}/secrets/${input.secretName}`;
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
