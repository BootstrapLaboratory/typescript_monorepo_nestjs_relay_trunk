import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGoogleServicesDependency,
  projectParent,
  type ServiceUsageClientLike,
} from "../src/google/services.js";

describe("Google Service Usage dependency", () => {
  it("enables multiple services with batchEnableServices and waits for the operation", async () => {
    const client = new FakeServiceUsageClient();
    const services = createGoogleServicesDependency(client);

    await services.enableServices({
      projectId: "demo-project",
      projectNumber: "123456789",
      services: [
        "run.googleapis.com",
        "secretmanager.googleapis.com",
        "run.googleapis.com",
      ],
    });

    assert.deepEqual(client.batchEnableServicesCalls, [
      {
        parent: "projects/123456789",
        serviceIds: ["run.googleapis.com", "secretmanager.googleapis.com"],
      },
    ]);
    assert.deepEqual(client.enableServiceCalls, []);
    assert.equal(client.awaitedOperations, 1);
  });

  it("uses enableService for a single service", async () => {
    const client = new FakeServiceUsageClient();
    const services = createGoogleServicesDependency(client);

    await services.enableServices({
      projectId: "demo-project",
      projectNumber: "123456789",
      services: ["serviceusage.googleapis.com"],
    });

    assert.deepEqual(client.batchEnableServicesCalls, []);
    assert.deepEqual(client.enableServiceCalls, [
      {
        name: "projects/123456789/services/serviceusage.googleapis.com",
      },
    ]);
    assert.equal(client.awaitedOperations, 1);
  });

  it("splits batch enables at the Service Usage API limit", async () => {
    const client = new FakeServiceUsageClient();
    const services = createGoogleServicesDependency(client);

    await services.enableServices({
      projectId: "demo-project",
      projectNumber: "projects/123456789",
      services: Array.from(
        {
          length: 21,
        },
        (_value, index) => `service-${index}.googleapis.com`,
      ),
    });

    assert.equal(client.batchEnableServicesCalls.length, 1);
    assert.equal(client.batchEnableServicesCalls[0]?.serviceIds.length, 20);
    assert.deepEqual(client.enableServiceCalls, [
      {
        name: "projects/123456789/services/service-20.googleapis.com",
      },
    ]);
    assert.equal(client.awaitedOperations, 2);
  });

  it("does nothing when no services are requested", async () => {
    const client = new FakeServiceUsageClient();
    const services = createGoogleServicesDependency(client);

    await services.enableServices({
      projectId: "demo-project",
      projectNumber: "123456789",
      services: ["", ""],
    });

    assert.deepEqual(client.batchEnableServicesCalls, []);
    assert.deepEqual(client.enableServiceCalls, []);
    assert.equal(client.awaitedOperations, 0);
  });

  it("formats project parents from either project numbers or resource names", () => {
    assert.equal(projectParent("123456789"), "projects/123456789");
    assert.equal(projectParent("projects/123456789"), "projects/123456789");
  });
});

class FakeServiceUsageClient implements ServiceUsageClientLike {
  awaitedOperations = 0;
  batchEnableServicesCalls: Array<{
    parent: string;
    serviceIds: string[];
  }> = [];
  enableServiceCalls: Array<{
    name: string;
  }> = [];

  async batchEnableServices(request: {
    parent: string;
    serviceIds: string[];
  }) {
    this.batchEnableServicesCalls.push(request);
    return [this.operation()] satisfies Awaited<
      ReturnType<ServiceUsageClientLike["batchEnableServices"]>
    >;
  }

  async enableService(request: { name: string }) {
    this.enableServiceCalls.push(request);
    return [this.operation()] satisfies Awaited<
      ReturnType<ServiceUsageClientLike["enableService"]>
    >;
  }

  private operation() {
    return {
      promise: async () => {
        this.awaitedOperations += 1;
        return [{}] as [unknown];
      },
    };
  }
}
