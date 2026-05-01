import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGoogleSecretManagerDependency,
  projectParent,
  secretResourceName,
  type SecretManagerClientLike,
} from "../src/google/secret-manager.js";

describe("Google Secret Manager dependency", () => {
  it("adds a new version to an existing secret", async () => {
    const client = new FakeSecretManagerClient({
      DATABASE_URL: {},
    });
    const secretManager = createGoogleSecretManagerDependency(client);

    await secretManager.upsertSecretVersion({
      projectId: "demo-project",
      secretName: "DATABASE_URL",
      value: "postgres://example",
    });

    assert.deepEqual(client.createSecretCalls, []);
    assert.deepEqual(client.addSecretVersionCalls, [
      {
        parent: "projects/demo-project/secrets/DATABASE_URL",
        value: "postgres://example",
      },
    ]);
  });

  it("creates a missing secret before adding a version", async () => {
    const client = new FakeSecretManagerClient();
    const secretManager = createGoogleSecretManagerDependency(client);

    await secretManager.upsertSecretVersion({
      projectId: "demo-project",
      secretName: "DATABASE_URL",
      value: "postgres://example",
    });

    assert.deepEqual(client.createSecretCalls, [
      {
        parent: "projects/demo-project",
        secretId: "DATABASE_URL",
      },
    ]);
    assert.deepEqual(client.addSecretVersionCalls, [
      {
        parent: "projects/demo-project/secrets/DATABASE_URL",
        value: "postgres://example",
      },
    ]);
  });

  it("rethrows non-not-found get errors", async () => {
    const client = new FakeSecretManagerClient();
    client.getSecretError = Object.assign(new Error("service unavailable"), {
      code: 13,
    });
    const secretManager = createGoogleSecretManagerDependency(client);

    await assert.rejects(
      secretManager.upsertSecretVersion({
        projectId: "demo-project",
        secretName: "DATABASE_URL",
        value: "postgres://example",
      }),
      /service unavailable/,
    );
    assert.deepEqual(client.createSecretCalls, []);
    assert.deepEqual(client.addSecretVersionCalls, []);
  });

  it("adds a secret IAM member to an existing binding", async () => {
    const client = new FakeSecretManagerClient({
      DATABASE_URL: {},
    });
    client.policy = {
      bindings: [
        {
          members: ["serviceAccount:old@example.test"],
          role: "roles/secretmanager.secretAccessor",
        },
      ],
    };
    const secretManager = createGoogleSecretManagerDependency(client);

    await secretManager.ensureSecretIamBinding({
      member: "serviceAccount:new@example.test",
      projectId: "demo-project",
      role: "roles/secretmanager.secretAccessor",
      secretName: "DATABASE_URL",
    });

    assert.deepEqual(client.setIamPolicyCalls, [
      {
        policy: {
          bindings: [
            {
              members: [
                "serviceAccount:old@example.test",
                "serviceAccount:new@example.test",
              ],
              role: "roles/secretmanager.secretAccessor",
            },
          ],
        },
        resource: "projects/demo-project/secrets/DATABASE_URL",
      },
    ]);
  });

  it("adds a missing secret IAM role binding", async () => {
    const client = new FakeSecretManagerClient({
      DATABASE_URL: {},
    });
    client.policy = {
      bindings: [],
    };
    const secretManager = createGoogleSecretManagerDependency(client);

    await secretManager.ensureSecretIamBinding({
      member: "serviceAccount:new@example.test",
      projectId: "demo-project",
      role: "roles/secretmanager.secretAccessor",
      secretName: "DATABASE_URL",
    });

    assert.deepEqual(client.setIamPolicyCalls[0]?.policy, {
      bindings: [
        {
          members: ["serviceAccount:new@example.test"],
          role: "roles/secretmanager.secretAccessor",
        },
      ],
    });
  });

  it("does not update secret IAM when the member already exists", async () => {
    const client = new FakeSecretManagerClient({
      DATABASE_URL: {},
    });
    client.policy = {
      bindings: [
        {
          members: ["serviceAccount:old@example.test"],
          role: "roles/secretmanager.secretAccessor",
        },
      ],
    };
    const secretManager = createGoogleSecretManagerDependency(client);

    await secretManager.ensureSecretIamBinding({
      member: "serviceAccount:old@example.test",
      projectId: "demo-project",
      role: "roles/secretmanager.secretAccessor",
      secretName: "DATABASE_URL",
    });

    assert.deepEqual(client.setIamPolicyCalls, []);
  });

  it("keeps conditional bindings separate from unconditional secret IAM bindings", async () => {
    const client = new FakeSecretManagerClient({
      DATABASE_URL: {},
    });
    client.policy = {
      bindings: [
        {
          condition: {
            expression: "request.time < timestamp('2030-01-01T00:00:00Z')",
          },
          members: ["serviceAccount:old@example.test"],
          role: "roles/secretmanager.secretAccessor",
        },
      ],
    };
    const secretManager = createGoogleSecretManagerDependency(client);

    await secretManager.ensureSecretIamBinding({
      member: "serviceAccount:new@example.test",
      projectId: "demo-project",
      role: "roles/secretmanager.secretAccessor",
      secretName: "DATABASE_URL",
    });

    assert.equal(
      (client.setIamPolicyCalls[0]?.policy as { bindings?: unknown[] })
        .bindings?.length,
      2,
    );
  });

  it("formats resource names", () => {
    assert.equal(projectParent("demo-project"), "projects/demo-project");
    assert.equal(projectParent("projects/demo-project"), "projects/demo-project");
    assert.equal(
      secretResourceName({
        projectId: "demo-project",
        secretName: "DATABASE_URL",
      }),
      "projects/demo-project/secrets/DATABASE_URL",
    );
  });
});

class FakeSecretManagerClient implements SecretManagerClientLike {
  addSecretVersionCalls: Array<{ parent: string; value: string }> = [];
  createSecretCalls: Array<{ parent: string; secretId: string }> = [];
  getSecretError?: Error & { code?: number };
  policy = {};
  setIamPolicyCalls: Array<{ policy: unknown; resource: string }> = [];

  constructor(private readonly secrets: Record<string, object> = {}) {}

  async addSecretVersion(request: {
    parent: string;
    payload: {
      data: Buffer;
    };
  }) {
    this.addSecretVersionCalls.push({
      parent: request.parent,
      value: request.payload.data.toString("utf8"),
    });

    return [{}] satisfies Awaited<ReturnType<SecretManagerClientLike["addSecretVersion"]>>;
  }

  async createSecret(request: {
    parent: string;
    secret: {
      replication: {
        automatic: Record<string, never>;
      };
    };
    secretId: string;
  }) {
    this.createSecretCalls.push({
      parent: request.parent,
      secretId: request.secretId,
    });
    this.secrets[request.secretId] = {};

    return [{}] satisfies Awaited<ReturnType<SecretManagerClientLike["createSecret"]>>;
  }

  async getIamPolicy() {
    return [this.policy] satisfies Awaited<ReturnType<SecretManagerClientLike["getIamPolicy"]>>;
  }

  async getSecret(request: { name: string }) {
    if (this.getSecretError !== undefined) {
      throw this.getSecretError;
    }

    const secretName = request.name.replace(/^projects\/[^/]+\/secrets\//, "");
    const secret = this.secrets[secretName];

    if (secret === undefined) {
      throw Object.assign(new Error("NOT_FOUND"), {
        code: 5,
      });
    }

    return [secret] satisfies Awaited<ReturnType<SecretManagerClientLike["getSecret"]>>;
  }

  async setIamPolicy(request: { policy: object; resource: string }) {
    this.policy = request.policy;
    this.setIamPolicyCalls.push(request);

    return [request.policy] satisfies Awaited<ReturnType<SecretManagerClientLike["setIamPolicy"]>>;
  }
}
