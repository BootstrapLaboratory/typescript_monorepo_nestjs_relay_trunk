import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addIamBindingMember,
  createGoogleArtifactRegistryRepositoryDependency,
  repositoryParent,
  repositoryResourceName,
  type ArtifactRegistryClientLike,
} from "../src/google/artifact-registry.js";

describe("Google Artifact Registry repository dependency", () => {
  it("does not create an existing Docker repository", async () => {
    const client = new FakeArtifactRegistryClient({
      "projects/demo-project/locations/europe-west4/repositories/cloud-run-backend":
        {
          name: "projects/demo-project/locations/europe-west4/repositories/cloud-run-backend",
        },
    });
    const artifactRegistry =
      createGoogleArtifactRegistryRepositoryDependency(client);

    await artifactRegistry.ensureDockerRepository({
      description: "Cloud Run backend images",
      projectId: "demo-project",
      region: "europe-west4",
      repository: "cloud-run-backend",
    });

    assert.deepEqual(client.createRepositoryCalls, []);
  });

  it("creates a missing Docker repository and waits for the operation", async () => {
    const client = new FakeArtifactRegistryClient();
    const artifactRegistry =
      createGoogleArtifactRegistryRepositoryDependency(client);

    await artifactRegistry.ensureDockerRepository({
      description: "Cloud Run backend images",
      projectId: "demo-project",
      region: "europe-west4",
      repository: "cloud-run-backend",
    });

    assert.deepEqual(client.createRepositoryCalls, [
      {
        parent: "projects/demo-project/locations/europe-west4",
        repository: {
          description: "Cloud Run backend images",
          format: 1,
        },
        repositoryId: "cloud-run-backend",
      },
    ]);
    assert.equal(client.createdOperationAwaited, true);
  });

  it("rethrows non-not-found errors during ensureDockerRepository", async () => {
    const client = new FakeArtifactRegistryClient();
    client.getRepositoryError = Object.assign(new Error("permission denied"), {
      code: 7,
    });
    const artifactRegistry =
      createGoogleArtifactRegistryRepositoryDependency(client);

    await assert.rejects(
      artifactRegistry.ensureDockerRepository({
        description: "Cloud Run backend images",
        projectId: "demo-project",
        region: "europe-west4",
        repository: "cloud-run-backend",
      }),
      /permission denied/,
    );
    assert.deepEqual(client.createRepositoryCalls, []);
  });

  it("formats Artifact Registry resource names", () => {
    assert.equal(
      repositoryParent({
        projectId: "demo-project",
        region: "europe-west4",
      }),
      "projects/demo-project/locations/europe-west4",
    );
    assert.equal(
      repositoryResourceName({
        projectId: "demo-project",
        region: "europe-west4",
        repository: "cloud-run-backend",
      }),
      "projects/demo-project/locations/europe-west4/repositories/cloud-run-backend",
    );
  });

  it("adds a repository IAM member to an existing role binding", async () => {
    const client = new FakeArtifactRegistryClient();
    client.iamPolicies[
      "projects/demo-project/locations/europe-west4/repositories/cloud-run-backend"
    ] = {
      bindings: [
        {
          members: ["serviceAccount:other@example.test"],
          role: "roles/artifactregistry.writer",
        },
      ],
      etag: "abc123",
      version: 1,
    };
    const artifactRegistry =
      createGoogleArtifactRegistryRepositoryDependency(client);

    await artifactRegistry.ensureRepositoryIamBinding({
      member:
        "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
      projectId: "demo-project",
      region: "europe-west4",
      repository: "cloud-run-backend",
      role: "roles/artifactregistry.writer",
    });

    assert.deepEqual(client.setIamPolicyCalls, [
      {
        policy: {
          bindings: [
            {
              members: [
                "serviceAccount:other@example.test",
                "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
              ],
              role: "roles/artifactregistry.writer",
            },
          ],
          etag: "abc123",
          version: 1,
        },
        resource:
          "projects/demo-project/locations/europe-west4/repositories/cloud-run-backend",
      },
    ]);
  });

  it("adds a new repository IAM role binding when the role is missing", async () => {
    const client = new FakeArtifactRegistryClient();
    client.iamPolicies[
      "projects/demo-project/locations/europe-west4/repositories/cloud-run-backend"
    ] = {
      bindings: [],
      etag: "abc123",
    };
    const artifactRegistry =
      createGoogleArtifactRegistryRepositoryDependency(client);

    await artifactRegistry.ensureRepositoryIamBinding({
      member:
        "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
      projectId: "demo-project",
      region: "europe-west4",
      repository: "cloud-run-backend",
      role: "roles/artifactregistry.writer",
    });

    assert.deepEqual(client.setIamPolicyCalls[0]?.policy.bindings, [
      {
        members: [
          "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
        ],
        role: "roles/artifactregistry.writer",
      },
    ]);
  });

  it("does not update repository IAM when the role member already exists", async () => {
    const client = new FakeArtifactRegistryClient();
    client.iamPolicies[
      "projects/demo-project/locations/europe-west4/repositories/cloud-run-backend"
    ] = {
      bindings: [
        {
          members: [
            "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
          ],
          role: "roles/artifactregistry.writer",
        },
      ],
      etag: "abc123",
    };
    const artifactRegistry =
      createGoogleArtifactRegistryRepositoryDependency(client);

    await artifactRegistry.ensureRepositoryIamBinding({
      member:
        "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
      projectId: "demo-project",
      region: "europe-west4",
      repository: "cloud-run-backend",
      role: "roles/artifactregistry.writer",
    });

    assert.deepEqual(client.setIamPolicyCalls, []);
  });

  it("keeps conditional bindings separate from unconditional repository IAM bindings", () => {
    const nextPolicy = addIamBindingMember(
      {
        bindings: [
          {
            condition: {
              expression: "request.time < timestamp('2030-01-01T00:00:00Z')",
              title: "temporary",
            },
            members: ["serviceAccount:other@example.test"],
            role: "roles/artifactregistry.writer",
          },
        ],
      },
      {
        member:
          "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
        role: "roles/artifactregistry.writer",
      },
    );

    assert.deepEqual(nextPolicy.bindings, [
      {
        condition: {
          expression: "request.time < timestamp('2030-01-01T00:00:00Z')",
          title: "temporary",
        },
        members: ["serviceAccount:other@example.test"],
        role: "roles/artifactregistry.writer",
      },
      {
        members: [
          "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
        ],
        role: "roles/artifactregistry.writer",
      },
    ]);
  });
});

type IamPolicy = Awaited<
  ReturnType<ArtifactRegistryClientLike["getIamPolicy"]>
>[0];

class FakeArtifactRegistryClient implements ArtifactRegistryClientLike {
  createdOperationAwaited = false;
  createRepositoryCalls: Array<{
    parent: string;
    repository: {
      description: string;
      format: number;
    };
    repositoryId: string;
  }> = [];
  getRepositoryError?: Error & { code?: number };
  iamPolicies: Record<string, IamPolicy> = {};
  setIamPolicyCalls: Array<{
    policy: IamPolicy;
    resource: string;
  }> = [];

  constructor(
    private readonly repositories: Record<string, { name: string }> = {},
  ) {}

  async createRepository(request: {
    parent: string;
    repository: {
      description: string;
      format: number;
    };
    repositoryId: string;
  }) {
    this.createRepositoryCalls.push(request);

    return [
      {
        promise: async () => {
          this.createdOperationAwaited = true;
          return [
            {
              name: `${request.parent}/repositories/${request.repositoryId}`,
            },
          ] as [{ name: string }];
        },
      },
    ] satisfies Awaited<ReturnType<ArtifactRegistryClientLike["createRepository"]>>;
  }

  async getRepository(request: { name: string }) {
    if (this.getRepositoryError !== undefined) {
      throw this.getRepositoryError;
    }

    const repository = this.repositories[request.name];

    if (repository === undefined) {
      throw Object.assign(new Error("NOT_FOUND"), {
        code: 5,
      });
    }

    return [repository] satisfies Awaited<
      ReturnType<ArtifactRegistryClientLike["getRepository"]>
    >;
  }

  async getIamPolicy(request: { resource: string }) {
    return [this.iamPolicies[request.resource] ?? {}] satisfies Awaited<
      ReturnType<ArtifactRegistryClientLike["getIamPolicy"]>
    >;
  }

  async setIamPolicy(request: { policy: IamPolicy; resource: string }) {
    this.setIamPolicyCalls.push(request);
    this.iamPolicies[request.resource] = request.policy;

    return [request.policy] satisfies Awaited<
      ReturnType<ArtifactRegistryClientLike["setIamPolicy"]>
    >;
  }
}
