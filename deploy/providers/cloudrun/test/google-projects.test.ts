import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createGoogleProjectsDependency,
  projectNumberFromName,
  type ProjectsClientLike,
} from "../src/google/projects.js";

describe("Google Resource Manager projects dependency", () => {
  it("does not create an existing project", async () => {
    const client = new FakeProjectsClient({
      "demo-project": {
        name: "projects/123456789",
      },
    });
    const projects = createGoogleProjectsDependency(client);

    await projects.ensureProject({
      displayName: "Demo Project",
      projectId: "demo-project",
    });

    assert.deepEqual(client.createProjectCalls, []);
  });

  it("creates a missing project and waits for the operation", async () => {
    const client = new FakeProjectsClient();
    const projects = createGoogleProjectsDependency(client);

    await projects.ensureProject({
      displayName: "Demo Project",
      projectId: "demo-project",
    });

    assert.deepEqual(client.createProjectCalls, [
      {
        project: {
          displayName: "Demo Project",
          projectId: "demo-project",
        },
      },
    ]);
    assert.equal(client.createdOperationAwaited, true);
  });

  it("attempts creation when project lookup is permission denied", async () => {
    const client = new FakeProjectsClient();
    client.getProjectError = Object.assign(
      new Error("7 PERMISSION_DENIED: project may not exist"),
      {
        code: 7,
      },
    );
    const projects = createGoogleProjectsDependency(client);

    await projects.ensureProject({
      displayName: "Demo Project",
      projectId: "demo-project",
    });

    assert.deepEqual(client.createProjectCalls, [
      {
        project: {
          displayName: "Demo Project",
          projectId: "demo-project",
        },
      },
    ]);
    assert.equal(client.createdOperationAwaited, true);
  });

  it("explains missing project creation permission", async () => {
    const client = new FakeProjectsClient();
    client.getProjectError = Object.assign(
      new Error("7 PERMISSION_DENIED: project may not exist"),
      {
        code: 7,
      },
    );
    client.createProjectError = Object.assign(
      new Error("7 PERMISSION_DENIED: caller cannot create projects"),
      {
        code: 7,
      },
    );
    const projects = createGoogleProjectsDependency(client);

    await assert.rejects(
      projects.ensureProject({
        displayName: "Demo Project",
        projectId: "demo-project",
      }),
      /resourcemanager\.projects\.create/,
    );
  });

  it("explains a deleted ADC quota project during project creation", async () => {
    const client = new FakeProjectsClient();
    client.getProjectError = Object.assign(
      new Error("7 PERMISSION_DENIED: project may not exist"),
      {
        code: 7,
      },
    );
    client.createProjectError = Object.assign(
      new Error("7 PERMISSION_DENIED: Project old-quota-project has been deleted."),
      {
        code: 7,
      },
    );
    const projects = createGoogleProjectsDependency(client);

    await assert.rejects(
      projects.ensureProject({
        displayName: "Demo Project",
        projectId: "demo-project",
      }),
      /login --disable-quota-project/,
    );
  });

  it("explains a deleted target project ID during project creation", async () => {
    const client = new FakeProjectsClient();
    client.getProjectError = Object.assign(
      new Error("7 PERMISSION_DENIED: project may not exist"),
      {
        code: 7,
      },
    );
    client.createProjectError = Object.assign(
      new Error("7 PERMISSION_DENIED: Project demo-project has been deleted."),
      {
        code: 7,
      },
    );
    const projects = createGoogleProjectsDependency(client);

    await assert.rejects(
      projects.ensureProject({
        displayName: "Demo Project",
        projectId: "demo-project",
      }),
      /cannot be reused/,
    );
  });

  it("returns the numeric project number from the project resource name", async () => {
    const client = new FakeProjectsClient({
      "demo-project": {
        name: "projects/123456789",
      },
    });
    const projects = createGoogleProjectsDependency(client);

    assert.equal(await projects.getProjectNumber("demo-project"), "123456789");
  });

  it("throws when the project response does not include a numeric resource name", () => {
    assert.throws(
      () => projectNumberFromName("projects/demo-project"),
      /numeric resource name/,
    );
  });

  it("rethrows non-not-found errors during ensureProject", async () => {
    const client = new FakeProjectsClient();
    client.getProjectError = Object.assign(new Error("service unavailable"), {
      code: 13,
    });
    const projects = createGoogleProjectsDependency(client);

    await assert.rejects(
      projects.ensureProject({
        displayName: "Demo Project",
        projectId: "demo-project",
      }),
      /service unavailable/,
    );
    assert.deepEqual(client.createProjectCalls, []);
  });
});

class FakeProjectsClient implements ProjectsClientLike {
  createdOperationAwaited = false;
  createProjectCalls: Array<{
    project: {
      displayName: string;
      projectId: string;
    };
  }> = [];
  createProjectError?: Error & { code?: number };
  getProjectError?: Error & { code?: number };

  constructor(private readonly projects: Record<string, { name: string }> = {}) {}

  async createProject(request: {
    project: {
      displayName: string;
      projectId: string;
    };
  }) {
    if (this.createProjectError !== undefined) {
      throw this.createProjectError;
    }

    this.createProjectCalls.push(request);

    return [
      {
        promise: async () => {
          this.createdOperationAwaited = true;
          return [
            {
              name: "projects/123456789",
            },
          ];
        },
      },
    ] satisfies Awaited<ReturnType<ProjectsClientLike["createProject"]>>;
  }

  async getProject(request: { name: string }) {
    if (this.getProjectError !== undefined) {
      throw this.getProjectError;
    }

    const projectId = request.name.replace(/^projects\//, "");
    const project = this.projects[projectId];

    if (project === undefined) {
      throw Object.assign(new Error("NOT_FOUND"), {
        code: 5,
      });
    }

    return [project] satisfies Awaited<ReturnType<ProjectsClientLike["getProject"]>>;
  }
}
