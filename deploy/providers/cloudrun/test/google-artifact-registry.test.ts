import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
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
});

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
}
