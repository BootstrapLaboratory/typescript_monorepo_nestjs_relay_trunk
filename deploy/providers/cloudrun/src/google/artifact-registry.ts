import { protos, v1 } from "@google-cloud/artifact-registry";

import { addIamBindingMember } from "./iam-policy.js";
import type { CloudRunProviderDeps } from "../types.js";

const DOCKER_FORMAT =
  protos.google.devtools.artifactregistry.v1.Repository.Format.DOCKER;

type ArtifactRepository = {
  name?: null | string;
};

type IamPolicy = protos.google.iam.v1.IPolicy;

type RepositoryOperation = {
  promise(): Promise<[ArtifactRepository, unknown?, unknown?]>;
};

export type ArtifactRegistryClientLike = {
  createRepository(request: {
    parent: string;
    repository: {
      description: string;
      format: number;
    };
    repositoryId: string;
  }): Promise<[RepositoryOperation, unknown?, unknown?]>;
  getRepository(request: {
    name: string;
  }): Promise<[ArtifactRepository, unknown?, unknown?]>;
  getIamPolicy(request: {
    resource: string;
  }): Promise<[IamPolicy, unknown?, unknown?]>;
  setIamPolicy(request: {
    policy: IamPolicy;
    resource: string;
  }): Promise<[IamPolicy, unknown?, unknown?]>;
};

export type ArtifactRegistryRepositoryDependency = Pick<
  CloudRunProviderDeps["artifactRegistry"],
  "ensureDockerRepository" | "ensureRepositoryIamBinding"
>;

export function createGoogleArtifactRegistryRepositoryDependency(
  client: ArtifactRegistryClientLike = new v1.ArtifactRegistryClient() as ArtifactRegistryClientLike,
): ArtifactRegistryRepositoryDependency {
  return {
    async ensureDockerRepository(input) {
      try {
        await client.getRepository({
          name: repositoryResourceName(input),
        });
        return;
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error;
        }
      }

      const [operation] = await client.createRepository({
        parent: repositoryParent(input),
        repository: {
          description: input.description,
          format: DOCKER_FORMAT,
        },
        repositoryId: input.repository,
      });
      await operation.promise();
    },
    async ensureRepositoryIamBinding(input) {
      const resource = repositoryResourceName(input);
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
  };
}

export function repositoryParent(input: {
  projectId: string;
  region: string;
}): string {
  return `projects/${input.projectId}/locations/${input.region}`;
}

export function repositoryResourceName(input: {
  projectId: string;
  region: string;
  repository: string;
}): string {
  return `${repositoryParent(input)}/repositories/${input.repository}`;
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
