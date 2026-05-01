import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGoogleIamDependency,
  projectResourceName,
  serviceAccountEmail,
  serviceAccountResourceName,
  type IamServiceAccountsClientLike,
} from "../src/google/iam.js";

describe("Google IAM dependency", () => {
  it("does not create an existing service account", async () => {
    const client = new FakeIamServiceAccountsClient({
      "projects/demo-project/serviceAccounts/cloud-run-runtime@demo-project.iam.gserviceaccount.com":
        {
          email: "cloud-run-runtime@demo-project.iam.gserviceaccount.com",
        },
    });
    const iam = createGoogleIamDependency(client);

    await iam.ensureServiceAccount({
      accountId: "cloud-run-runtime",
      displayName: "Cloud Run runtime",
      projectId: "demo-project",
    });

    assert.deepEqual(client.createCalls, []);
  });

  it("creates a missing service account", async () => {
    const client = new FakeIamServiceAccountsClient();
    const iam = createGoogleIamDependency(client);

    await iam.ensureServiceAccount({
      accountId: "github-actions-deployer",
      displayName: "GitHub Actions deployer",
      projectId: "demo-project",
    });

    assert.deepEqual(client.createCalls, [
      {
        name: "projects/demo-project",
        requestBody: {
          accountId: "github-actions-deployer",
          serviceAccount: {
            displayName: "GitHub Actions deployer",
          },
        },
      },
    ]);
  });

  it("rethrows non-not-found errors during ensureServiceAccount", async () => {
    const client = new FakeIamServiceAccountsClient();
    const error = Object.assign(new Error("permission denied"), {
      code: 403,
    });
    client.getError = error;
    const iam = createGoogleIamDependency(client);

    await assert.rejects(
      () =>
        iam.ensureServiceAccount({
          accountId: "cloud-run-runtime",
          displayName: "Cloud Run runtime",
          projectId: "demo-project",
        }),
      error,
    );
    assert.deepEqual(client.createCalls, []);
  });

  it("formats IAM service account resource names", () => {
    assert.equal(projectResourceName("demo-project"), "projects/demo-project");
    assert.equal(
      serviceAccountEmail({
        accountId: "cloud-run-runtime",
        projectId: "demo-project",
      }),
      "cloud-run-runtime@demo-project.iam.gserviceaccount.com",
    );
    assert.equal(
      serviceAccountResourceName({
        accountId: "cloud-run-runtime",
        projectId: "demo-project",
      }),
      "projects/demo-project/serviceAccounts/cloud-run-runtime@demo-project.iam.gserviceaccount.com",
    );
  });
});

type ServiceAccount = Awaited<
  ReturnType<IamServiceAccountsClientLike["get"]>
>["data"];

class FakeIamServiceAccountsClient implements IamServiceAccountsClientLike {
  createCalls: Array<{
    name: string;
    requestBody: {
      accountId: string;
      serviceAccount: {
        displayName: string;
      };
    };
  }> = [];
  getError?: Error & { code?: number };

  constructor(
    private readonly serviceAccounts: Record<string, ServiceAccount> = {},
  ) {}

  async create(request: {
    name: string;
    requestBody: {
      accountId: string;
      serviceAccount: {
        displayName: string;
      };
    };
  }) {
    this.createCalls.push(request);

    const [projectId] = request.name.replace(/^projects\//, "").split("/");
    const email = `${request.requestBody.accountId}@${projectId}.iam.gserviceaccount.com`;
    const serviceAccount = {
      displayName: request.requestBody.serviceAccount.displayName,
      email,
      name: `${request.name}/serviceAccounts/${email}`,
    };

    this.serviceAccounts[serviceAccount.name] = serviceAccount;

    return { data: serviceAccount };
  }

  async get(request: { name: string }) {
    if (this.getError !== undefined) {
      throw this.getError;
    }

    const serviceAccount = this.serviceAccounts[request.name];

    if (serviceAccount === undefined) {
      throw Object.assign(new Error("not found"), {
        code: 404,
      });
    }

    return { data: serviceAccount };
  }
}
