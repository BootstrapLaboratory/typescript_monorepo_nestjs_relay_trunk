import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGoogleIamDependency,
  projectResourceName,
  serviceAccountEmail,
  serviceAccountResourceName,
  serviceAccountResourceNameFromEmail,
  type IamProjectsClientLike,
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
    assert.equal(
      serviceAccountResourceNameFromEmail({
        projectId: "demo-project",
        serviceAccountEmail:
          "github-actions-deployer@demo-project.iam.gserviceaccount.com",
      }),
      "projects/demo-project/serviceAccounts/github-actions-deployer@demo-project.iam.gserviceaccount.com",
    );
  });

  it("adds a project IAM member to an existing role binding", async () => {
    const serviceAccounts = new FakeIamServiceAccountsClient();
    const projects = new FakeIamProjectsClient({
      "projects/demo-project": {
        bindings: [
          {
            members: ["serviceAccount:other@example.test"],
            role: "roles/run.admin",
          },
        ],
        etag: "abc123",
        version: 1,
      },
    });
    const iam = createGoogleIamDependency(serviceAccounts, projects);

    await iam.ensureProjectIamBinding({
      member:
        "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
      projectId: "demo-project",
      role: "roles/run.admin",
    });

    assert.deepEqual(projects.setIamPolicyCalls, [
      {
        policy: {
          bindings: [
            {
              members: [
                "serviceAccount:other@example.test",
                "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
              ],
              role: "roles/run.admin",
            },
          ],
          etag: "abc123",
          version: 1,
        },
        resource: "projects/demo-project",
      },
    ]);
  });

  it("adds a missing project IAM role binding", async () => {
    const serviceAccounts = new FakeIamServiceAccountsClient();
    const projects = new FakeIamProjectsClient({
      "projects/demo-project": {
        bindings: [],
        etag: "abc123",
      },
    });
    const iam = createGoogleIamDependency(serviceAccounts, projects);

    await iam.ensureProjectIamBinding({
      member:
        "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
      projectId: "demo-project",
      role: "roles/run.admin",
    });

    assert.deepEqual(projects.setIamPolicyCalls[0]?.policy.bindings, [
      {
        members: [
          "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
        ],
        role: "roles/run.admin",
      },
    ]);
  });

  it("does not update project IAM when the role member already exists", async () => {
    const serviceAccounts = new FakeIamServiceAccountsClient();
    const projects = new FakeIamProjectsClient({
      "projects/demo-project": {
        bindings: [
          {
            members: [
              "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
            ],
            role: "roles/run.admin",
          },
        ],
        etag: "abc123",
      },
    });
    const iam = createGoogleIamDependency(serviceAccounts, projects);

    await iam.ensureProjectIamBinding({
      member:
        "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
      projectId: "demo-project",
      role: "roles/run.admin",
    });

    assert.deepEqual(projects.setIamPolicyCalls, []);
  });

  it("keeps conditional project IAM bindings separate", async () => {
    const serviceAccounts = new FakeIamServiceAccountsClient();
    const projects = new FakeIamProjectsClient({
      "projects/demo-project": {
        bindings: [
          {
            condition: {
              expression: "request.time < timestamp('2030-01-01T00:00:00Z')",
              title: "temporary",
            },
            members: ["serviceAccount:other@example.test"],
            role: "roles/run.admin",
          },
        ],
      },
    });
    const iam = createGoogleIamDependency(serviceAccounts, projects);

    await iam.ensureProjectIamBinding({
      member:
        "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
      projectId: "demo-project",
      role: "roles/run.admin",
    });

    assert.deepEqual(projects.setIamPolicyCalls[0]?.policy.bindings, [
      {
        condition: {
          expression: "request.time < timestamp('2030-01-01T00:00:00Z')",
          title: "temporary",
        },
        members: ["serviceAccount:other@example.test"],
        role: "roles/run.admin",
      },
      {
        members: [
          "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
        ],
        role: "roles/run.admin",
      },
    ]);
  });

  it("adds a service account IAM member to an existing role binding", async () => {
    const resource =
      "projects/demo-project/serviceAccounts/github-actions-deployer@demo-project.iam.gserviceaccount.com";
    const client = new FakeIamServiceAccountsClient(
      {},
      {
        [resource]: {
          bindings: [
            {
              members: [
                "principalSet://iam.googleapis.com/projects/123456/locations/global/workloadIdentityPools/github/attribute.repository/Other/repo",
              ],
              role: "roles/iam.workloadIdentityUser",
            },
          ],
          etag: "abc123",
          version: 3,
        },
      },
    );
    const iam = createGoogleIamDependency(client);

    await iam.ensureServiceAccountIamBinding({
      member:
        "principalSet://iam.googleapis.com/projects/123456/locations/global/workloadIdentityPools/github/attribute.repository/BeltOrg/beltapp",
      projectId: "demo-project",
      role: "roles/iam.workloadIdentityUser",
      serviceAccountEmail:
        "github-actions-deployer@demo-project.iam.gserviceaccount.com",
    });

    assert.deepEqual(client.getIamPolicyCalls, [
      {
        "options.requestedPolicyVersion": 3,
        resource,
      },
    ]);
    assert.deepEqual(client.setIamPolicyCalls, [
      {
        requestBody: {
          policy: {
            bindings: [
              {
                members: [
                  "principalSet://iam.googleapis.com/projects/123456/locations/global/workloadIdentityPools/github/attribute.repository/Other/repo",
                  "principalSet://iam.googleapis.com/projects/123456/locations/global/workloadIdentityPools/github/attribute.repository/BeltOrg/beltapp",
                ],
                role: "roles/iam.workloadIdentityUser",
              },
            ],
            etag: "abc123",
            version: 3,
          },
        },
        resource,
      },
    ]);
  });

  it("adds a missing service account IAM role binding", async () => {
    const resource =
      "projects/demo-project/serviceAccounts/github-actions-deployer@demo-project.iam.gserviceaccount.com";
    const client = new FakeIamServiceAccountsClient(
      {},
      {
        [resource]: {
          bindings: [],
          etag: "abc123",
        },
      },
    );
    const iam = createGoogleIamDependency(client);

    await iam.ensureServiceAccountIamBinding({
      member:
        "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
      projectId: "demo-project",
      role: "roles/iam.serviceAccountUser",
      serviceAccountEmail:
        "github-actions-deployer@demo-project.iam.gserviceaccount.com",
    });

    assert.deepEqual(
      client.setIamPolicyCalls[0]?.requestBody.policy.bindings,
      [
        {
          members: [
            "serviceAccount:github-actions-deployer@demo-project.iam.gserviceaccount.com",
          ],
          role: "roles/iam.serviceAccountUser",
        },
      ],
    );
  });

  it("does not update service account IAM when the role member already exists", async () => {
    const resource =
      "projects/demo-project/serviceAccounts/github-actions-deployer@demo-project.iam.gserviceaccount.com";
    const client = new FakeIamServiceAccountsClient(
      {},
      {
        [resource]: {
          bindings: [
            {
              members: [
                "principalSet://iam.googleapis.com/projects/123456/locations/global/workloadIdentityPools/github/attribute.repository/BeltOrg/beltapp",
              ],
              role: "roles/iam.workloadIdentityUser",
            },
          ],
          etag: "abc123",
        },
      },
    );
    const iam = createGoogleIamDependency(client);

    await iam.ensureServiceAccountIamBinding({
      member:
        "principalSet://iam.googleapis.com/projects/123456/locations/global/workloadIdentityPools/github/attribute.repository/BeltOrg/beltapp",
      projectId: "demo-project",
      role: "roles/iam.workloadIdentityUser",
      serviceAccountEmail:
        "github-actions-deployer@demo-project.iam.gserviceaccount.com",
    });

    assert.deepEqual(client.setIamPolicyCalls, []);
  });

  it("keeps conditional service account IAM bindings separate", async () => {
    const resource =
      "projects/demo-project/serviceAccounts/github-actions-deployer@demo-project.iam.gserviceaccount.com";
    const client = new FakeIamServiceAccountsClient(
      {},
      {
        [resource]: {
          bindings: [
            {
              condition: {
                expression:
                  "request.time < timestamp('2030-01-01T00:00:00Z')",
                title: "temporary",
              },
              members: [
                "principalSet://iam.googleapis.com/projects/123456/locations/global/workloadIdentityPools/github/attribute.repository/Other/repo",
              ],
              role: "roles/iam.workloadIdentityUser",
            },
          ],
        },
      },
    );
    const iam = createGoogleIamDependency(client);

    await iam.ensureServiceAccountIamBinding({
      member:
        "principalSet://iam.googleapis.com/projects/123456/locations/global/workloadIdentityPools/github/attribute.repository/BeltOrg/beltapp",
      projectId: "demo-project",
      role: "roles/iam.workloadIdentityUser",
      serviceAccountEmail:
        "github-actions-deployer@demo-project.iam.gserviceaccount.com",
    });

    assert.deepEqual(
      client.setIamPolicyCalls[0]?.requestBody.policy.bindings,
      [
        {
          condition: {
            expression: "request.time < timestamp('2030-01-01T00:00:00Z')",
            title: "temporary",
          },
          members: [
            "principalSet://iam.googleapis.com/projects/123456/locations/global/workloadIdentityPools/github/attribute.repository/Other/repo",
          ],
          role: "roles/iam.workloadIdentityUser",
        },
        {
          members: [
            "principalSet://iam.googleapis.com/projects/123456/locations/global/workloadIdentityPools/github/attribute.repository/BeltOrg/beltapp",
          ],
          role: "roles/iam.workloadIdentityUser",
        },
      ],
    );
  });
});

type ServiceAccount = Awaited<
  ReturnType<IamServiceAccountsClientLike["get"]>
>["data"];
type ServiceAccountIamPolicy = Awaited<
  ReturnType<IamServiceAccountsClientLike["getIamPolicy"]>
>["data"];
type ProjectIamPolicy = Awaited<
  ReturnType<IamProjectsClientLike["getIamPolicy"]>
>[0];

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
  getIamPolicyCalls: Array<{
    "options.requestedPolicyVersion"?: number;
    resource: string;
  }> = [];
  setIamPolicyCalls: Array<{
    requestBody: {
      policy: ServiceAccountIamPolicy;
    };
    resource: string;
  }> = [];

  constructor(
    private readonly serviceAccounts: Record<string, ServiceAccount> = {},
    private readonly policies: Record<string, ServiceAccountIamPolicy> = {},
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

  async getIamPolicy(request: {
    "options.requestedPolicyVersion"?: number;
    resource: string;
  }) {
    this.getIamPolicyCalls.push(request);

    return { data: this.policies[request.resource] ?? {} };
  }

  async setIamPolicy(request: {
    requestBody: {
      policy: ServiceAccountIamPolicy;
    };
    resource: string;
  }) {
    this.setIamPolicyCalls.push(request);
    this.policies[request.resource] = request.requestBody.policy;

    return { data: request.requestBody.policy };
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

class FakeIamProjectsClient implements IamProjectsClientLike {
  setIamPolicyCalls: Array<{
    policy: ProjectIamPolicy;
    resource: string;
  }> = [];

  constructor(
    private readonly policies: Record<string, ProjectIamPolicy> = {},
  ) {}

  async getIamPolicy(request: { resource: string }) {
    return [this.policies[request.resource] ?? {}] satisfies Awaited<
      ReturnType<IamProjectsClientLike["getIamPolicy"]>
    >;
  }

  async setIamPolicy(request: {
    policy: ProjectIamPolicy;
    resource: string;
  }) {
    this.setIamPolicyCalls.push(request);
    this.policies[request.resource] = request.policy;

    return [request.policy] satisfies Awaited<
      ReturnType<IamProjectsClientLike["setIamPolicy"]>
    >;
  }
}
