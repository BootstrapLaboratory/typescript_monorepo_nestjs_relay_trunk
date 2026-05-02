import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGoogleWorkloadIdentityDependency,
  workloadIdentityLocationParent,
  workloadIdentityPoolResourceName,
  workloadIdentityProviderResourceName,
  type WorkloadIdentityPoolOperationsClientLike,
  type WorkloadIdentityPoolProvidersClientLike,
  type WorkloadIdentityPoolsClientLike,
} from "../src/google/workload-identity.js";

describe("Google Workload Identity dependency", () => {
  it("does not create an existing GitHub OIDC provider", async () => {
    const poolName =
      "projects/123456789/locations/global/workloadIdentityPools/github-actions";
    const providerName = `${poolName}/providers/github`;
    const client = new FakeWorkloadIdentityPoolsClient(
      {
        [poolName]: {
          displayName: "GitHub Actions Pool",
          name: poolName,
        },
      },
      {
        [providerName]: {
          displayName: "GitHub repository provider",
          name: providerName,
        },
      },
    );
    const workloadIdentity = createGoogleWorkloadIdentityDependency(client, {
      pollIntervalMs: 0,
    });

    const output =
      await workloadIdentity.ensureGithubOidcProvider(githubOidcInput());

    assert.deepEqual(output, {
      poolName,
      providerName,
    });
    assert.deepEqual(client.createCalls, []);
    assert.deepEqual(client.providers.createCalls, []);
  });

  it("creates a missing pool and provider and waits for operations", async () => {
    const client = new FakeWorkloadIdentityPoolsClient();
    client.nextCreateOperation = {
      done: false,
      name: "operations/create-pool",
    };
    client.operations.operationResponses["operations/create-pool"] = [
      {
        done: true,
        name: "operations/create-pool",
      },
    ];
    client.providers.nextCreateOperation = {
      done: false,
      name: "operations/create-provider",
    };
    client.providers.operations.operationResponses[
      "operations/create-provider"
    ] = [
      {
        done: true,
        name: "operations/create-provider",
      },
    ];
    const workloadIdentity = createGoogleWorkloadIdentityDependency(client, {
      pollIntervalMs: 0,
    });

    await workloadIdentity.ensureGithubOidcProvider(githubOidcInput());

    assert.deepEqual(client.createCalls, [
      {
        parent: "projects/demo-project/locations/global",
        requestBody: {
          displayName: "GitHub Actions Pool",
        },
        workloadIdentityPoolId: "github-actions",
      },
    ]);
    assert.deepEqual(client.operations.getCalls, [
      {
        name: "operations/create-pool",
      },
    ]);
    assert.deepEqual(client.providers.createCalls, [
      {
        parent:
          "projects/123456789/locations/global/workloadIdentityPools/github-actions",
        requestBody: {
          attributeCondition: "assertion.repository == 'BeltOrg/beltapp'",
          attributeMapping: {
            "attribute.actor": "assertion.actor",
            "attribute.ref": "assertion.ref",
            "attribute.repository": "assertion.repository",
            "attribute.repository_owner": "assertion.repository_owner",
            "google.subject": "assertion.sub",
          },
          displayName: "GitHub repository provider",
          oidc: {
            issuerUri: "https://token.actions.githubusercontent.com",
          },
        },
        workloadIdentityPoolProviderId: "github",
      },
    ]);
    assert.deepEqual(client.providers.operations.getCalls, [
      {
        name: "operations/create-provider",
      },
    ]);
  });

  it("creates only the provider when the pool already exists", async () => {
    const poolName =
      "projects/123456789/locations/global/workloadIdentityPools/github-actions";
    const client = new FakeWorkloadIdentityPoolsClient({
      [poolName]: {
        displayName: "GitHub Actions Pool",
        name: poolName,
      },
    });
    const workloadIdentity = createGoogleWorkloadIdentityDependency(client, {
      pollIntervalMs: 0,
    });

    await workloadIdentity.ensureGithubOidcProvider(githubOidcInput());

    assert.deepEqual(client.createCalls, []);
    assert.equal(client.providers.createCalls.length, 1);
  });

  it("rethrows non-not-found pool errors", async () => {
    const client = new FakeWorkloadIdentityPoolsClient();
    const error = Object.assign(new Error("permission denied"), {
      code: 403,
    });
    client.getError = error;
    const workloadIdentity = createGoogleWorkloadIdentityDependency(client, {
      pollIntervalMs: 0,
    });

    await assert.rejects(
      () => workloadIdentity.ensureGithubOidcProvider(githubOidcInput()),
      error,
    );
    assert.deepEqual(client.createCalls, []);
    assert.deepEqual(client.providers.createCalls, []);
  });

  it("rethrows non-not-found provider errors", async () => {
    const poolName =
      "projects/123456789/locations/global/workloadIdentityPools/github-actions";
    const client = new FakeWorkloadIdentityPoolsClient({
      [poolName]: {
        displayName: "GitHub Actions Pool",
        name: poolName,
      },
    });
    const error = Object.assign(new Error("permission denied"), {
      code: 403,
    });
    client.providers.getError = error;
    const workloadIdentity = createGoogleWorkloadIdentityDependency(client, {
      pollIntervalMs: 0,
    });

    await assert.rejects(
      () => workloadIdentity.ensureGithubOidcProvider(githubOidcInput()),
      error,
    );
    assert.deepEqual(client.providers.createCalls, []);
  });

  it("surfaces failed create operations", async () => {
    const client = new FakeWorkloadIdentityPoolsClient();
    client.nextCreateOperation = {
      done: false,
      name: "operations/create-pool",
    };
    client.operations.operationResponses["operations/create-pool"] = [
      {
        done: true,
        error: {
          code: 7,
          message: "permission denied",
        },
        name: "operations/create-pool",
      },
    ];
    const workloadIdentity = createGoogleWorkloadIdentityDependency(client, {
      pollIntervalMs: 0,
    });

    await assert.rejects(
      () => workloadIdentity.ensureGithubOidcProvider(githubOidcInput()),
      /Google IAM operation operations\/create-pool failed with code 7: permission denied/,
    );
  });

  it("formats Workload Identity resource names", () => {
    assert.equal(
      workloadIdentityLocationParent({
        location: "global",
        projectId: "demo-project",
      }),
      "projects/demo-project/locations/global",
    );
    assert.equal(
      workloadIdentityPoolResourceName({
        location: "global",
        poolId: "github-actions",
        projectNumber: "123456789",
      }),
      "projects/123456789/locations/global/workloadIdentityPools/github-actions",
    );
    assert.equal(
      workloadIdentityProviderResourceName({
        location: "global",
        poolId: "github-actions",
        projectNumber: "123456789",
        providerId: "github",
      }),
      "projects/123456789/locations/global/workloadIdentityPools/github-actions/providers/github",
    );
  });
});

type WorkloadIdentityPool = Awaited<
  ReturnType<WorkloadIdentityPoolsClientLike["get"]>
>["data"];
type WorkloadIdentityPoolProvider = Awaited<
  ReturnType<WorkloadIdentityPoolProvidersClientLike["get"]>
>["data"];
type GoogleOperation = Awaited<
  ReturnType<WorkloadIdentityPoolOperationsClientLike["get"]>
>["data"];

class FakeWorkloadIdentityPoolsClient
  implements WorkloadIdentityPoolsClientLike
{
  createCalls: Array<{
    parent: string;
    requestBody: WorkloadIdentityPool;
    workloadIdentityPoolId: string;
  }> = [];
  getError?: Error & { code?: number };
  nextCreateOperation: GoogleOperation = {
    done: true,
    name: "operations/create-pool",
  };
  operations = new FakeWorkloadIdentityOperationsClient();
  providers: FakeWorkloadIdentityPoolProvidersClient;

  constructor(
    private readonly pools: Record<string, WorkloadIdentityPool> = {},
    providers: Record<string, WorkloadIdentityPoolProvider> = {},
  ) {
    this.providers = new FakeWorkloadIdentityPoolProvidersClient(providers);
  }

  async create(request: {
    parent: string;
    requestBody: WorkloadIdentityPool;
    workloadIdentityPoolId: string;
  }) {
    this.createCalls.push(request);
    this.pools[
      `${request.parent}/workloadIdentityPools/${request.workloadIdentityPoolId}`
    ] = {
      ...request.requestBody,
      name: `${request.parent}/workloadIdentityPools/${request.workloadIdentityPoolId}`,
    };

    return { data: this.nextCreateOperation };
  }

  async get(request: { name: string }) {
    if (this.getError !== undefined) {
      throw this.getError;
    }

    const pool = this.pools[request.name];

    if (pool === undefined) {
      throw Object.assign(new Error("not found"), {
        code: 404,
      });
    }

    return { data: pool };
  }
}

class FakeWorkloadIdentityPoolProvidersClient
  implements WorkloadIdentityPoolProvidersClientLike
{
  createCalls: Array<{
    parent: string;
    requestBody: WorkloadIdentityPoolProvider;
    workloadIdentityPoolProviderId: string;
  }> = [];
  getError?: Error & { code?: number };
  nextCreateOperation: GoogleOperation = {
    done: true,
    name: "operations/create-provider",
  };
  operations = new FakeWorkloadIdentityOperationsClient();

  constructor(
    private readonly providers: Record<string, WorkloadIdentityPoolProvider>,
  ) {}

  async create(request: {
    parent: string;
    requestBody: WorkloadIdentityPoolProvider;
    workloadIdentityPoolProviderId: string;
  }) {
    this.createCalls.push(request);
    this.providers[
      `${request.parent}/providers/${request.workloadIdentityPoolProviderId}`
    ] = {
      ...request.requestBody,
      name: `${request.parent}/providers/${request.workloadIdentityPoolProviderId}`,
    };

    return { data: this.nextCreateOperation };
  }

  async get(request: { name: string }) {
    if (this.getError !== undefined) {
      throw this.getError;
    }

    const provider = this.providers[request.name];

    if (provider === undefined) {
      throw Object.assign(new Error("not found"), {
        code: 404,
      });
    }

    return { data: provider };
  }
}

class FakeWorkloadIdentityOperationsClient
  implements WorkloadIdentityPoolOperationsClientLike
{
  getCalls: Array<{ name: string }> = [];
  operationResponses: Record<string, GoogleOperation[]> = {};

  async get(request: { name: string }) {
    this.getCalls.push(request);

    const responses = this.operationResponses[request.name];

    return {
      data: responses?.shift() ?? {
        done: true,
        name: request.name,
      },
    };
  }
}

function githubOidcInput() {
  return {
    attributeCondition: "assertion.repository == 'BeltOrg/beltapp'",
    attributeMapping: {
      "attribute.actor": "assertion.actor",
      "attribute.ref": "assertion.ref",
      "attribute.repository": "assertion.repository",
      "attribute.repository_owner": "assertion.repository_owner",
      "google.subject": "assertion.sub",
    },
    displayName: "GitHub repository provider",
    issuerUri: "https://token.actions.githubusercontent.com",
    location: "global",
    poolId: "github-actions",
    projectId: "demo-project",
    projectNumber: "123456789",
    providerId: "github",
  };
}
