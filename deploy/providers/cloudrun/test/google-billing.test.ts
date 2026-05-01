import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  billingAccountResourceName,
  billingProjectResourceName,
  createGoogleBillingDependency,
  type CloudBillingClientLike,
} from "../src/google/billing.js";

describe("Google Cloud Billing dependency", () => {
  it("does not update a project already linked to the billing account", async () => {
    const client = new FakeCloudBillingClient({
      "projects/demo-project": {
        billingAccountName: "billingAccounts/012345-567890-ABCDEF",
        billingEnabled: true,
        name: "projects/demo-project/billingInfo",
        projectId: "demo-project",
      },
    });
    const billing = createGoogleBillingDependency(client);

    await billing.linkProject({
      billingAccountId: "012345-567890-ABCDEF",
      projectId: "demo-project",
    });

    assert.deepEqual(client.updateProjectBillingInfoCalls, []);
  });

  it("links a project without a billing account", async () => {
    const client = new FakeCloudBillingClient({
      "projects/demo-project": {
        billingEnabled: false,
        name: "projects/demo-project/billingInfo",
        projectId: "demo-project",
      },
    });
    const billing = createGoogleBillingDependency(client);

    await billing.linkProject({
      billingAccountId: "012345-567890-ABCDEF",
      projectId: "demo-project",
    });

    assert.deepEqual(client.updateProjectBillingInfoCalls, [
      {
        name: "projects/demo-project",
        projectBillingInfo: {
          billingAccountName: "billingAccounts/012345-567890-ABCDEF",
        },
      },
    ]);
  });

  it("updates a project linked to another billing account", async () => {
    const client = new FakeCloudBillingClient({
      "projects/demo-project": {
        billingAccountName: "billingAccounts/111111-222222-333333",
        billingEnabled: true,
        name: "projects/demo-project/billingInfo",
        projectId: "demo-project",
      },
    });
    const billing = createGoogleBillingDependency(client);

    await billing.linkProject({
      billingAccountId: "billingAccounts/012345-567890-ABCDEF",
      projectId: "projects/demo-project",
    });

    assert.deepEqual(client.updateProjectBillingInfoCalls, [
      {
        name: "projects/demo-project",
        projectBillingInfo: {
          billingAccountName: "billingAccounts/012345-567890-ABCDEF",
        },
      },
    ]);
  });

  it("updates when the target billing account is present but billing is disabled", async () => {
    const client = new FakeCloudBillingClient({
      "projects/demo-project": {
        billingAccountName: "billingAccounts/012345-567890-ABCDEF",
        billingEnabled: false,
        name: "projects/demo-project/billingInfo",
        projectId: "demo-project",
      },
    });
    const billing = createGoogleBillingDependency(client);

    await billing.linkProject({
      billingAccountId: "012345-567890-ABCDEF",
      projectId: "demo-project",
    });

    assert.equal(client.updateProjectBillingInfoCalls.length, 1);
  });

  it("propagates get project billing errors", async () => {
    const client = new FakeCloudBillingClient();
    const error = Object.assign(new Error("permission denied"), {
      code: 7,
    });
    client.getProjectBillingInfoError = error;
    const billing = createGoogleBillingDependency(client);

    await assert.rejects(
      () =>
        billing.linkProject({
          billingAccountId: "012345-567890-ABCDEF",
          projectId: "demo-project",
        }),
      error,
    );
    assert.deepEqual(client.updateProjectBillingInfoCalls, []);
  });

  it("propagates update project billing errors", async () => {
    const client = new FakeCloudBillingClient({
      "projects/demo-project": {
        billingEnabled: false,
        name: "projects/demo-project/billingInfo",
        projectId: "demo-project",
      },
    });
    const error = Object.assign(new Error("quota exceeded"), {
      code: 9,
    });
    client.updateProjectBillingInfoError = error;
    const billing = createGoogleBillingDependency(client);

    await assert.rejects(
      () =>
        billing.linkProject({
          billingAccountId: "012345-567890-ABCDEF",
          projectId: "demo-project",
        }),
      error,
    );
  });

  it("formats billing resource names", () => {
    assert.equal(
      billingAccountResourceName("012345-567890-ABCDEF"),
      "billingAccounts/012345-567890-ABCDEF",
    );
    assert.equal(
      billingAccountResourceName("billingAccounts/012345-567890-ABCDEF"),
      "billingAccounts/012345-567890-ABCDEF",
    );
    assert.equal(
      billingProjectResourceName("demo-project"),
      "projects/demo-project",
    );
    assert.equal(
      billingProjectResourceName("projects/demo-project"),
      "projects/demo-project",
    );
  });
});

type ProjectBillingInfo = Awaited<
  ReturnType<CloudBillingClientLike["getProjectBillingInfo"]>
>[0];

class FakeCloudBillingClient implements CloudBillingClientLike {
  getProjectBillingInfoError?: Error & { code?: number };
  updateProjectBillingInfoCalls: Array<{
    name: string;
    projectBillingInfo: {
      billingAccountName: string;
    };
  }> = [];
  updateProjectBillingInfoError?: Error & { code?: number };

  constructor(
    private readonly billingInfo: Record<string, ProjectBillingInfo> = {},
  ) {}

  async getProjectBillingInfo(request: { name: string }) {
    if (this.getProjectBillingInfoError !== undefined) {
      throw this.getProjectBillingInfoError;
    }

    return [this.billingInfo[request.name] ?? {}] satisfies Awaited<
      ReturnType<CloudBillingClientLike["getProjectBillingInfo"]>
    >;
  }

  async updateProjectBillingInfo(request: {
    name: string;
    projectBillingInfo: {
      billingAccountName: string;
    };
  }) {
    if (this.updateProjectBillingInfoError !== undefined) {
      throw this.updateProjectBillingInfoError;
    }

    this.updateProjectBillingInfoCalls.push(request);

    const nextBillingInfo = {
      billingAccountName: request.projectBillingInfo.billingAccountName,
      billingEnabled: true,
      name: `${request.name}/billingInfo`,
      projectId: request.name.replace(/^projects\//, ""),
    };
    this.billingInfo[request.name] = nextBillingInfo;

    return [nextBillingInfo] satisfies Awaited<
      ReturnType<CloudBillingClientLike["updateProjectBillingInfo"]>
    >;
  }
}
