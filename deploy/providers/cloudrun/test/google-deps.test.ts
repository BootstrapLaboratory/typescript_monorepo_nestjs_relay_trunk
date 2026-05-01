import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGoogleCloudRunProviderDeps } from "../src/google/deps.js";
import type { CloudRunProviderDeps } from "../src/types.js";

describe("Google Cloud Run provider deps", () => {
  it("composes all provider dependency groups", () => {
    const markerDeps = createMarkerDeps();
    const deps = createGoogleCloudRunProviderDeps({
      artifactRegistry: () => markerDeps.artifactRegistry,
      billing: () => markerDeps.billing,
      iam: () => markerDeps.iam,
      projects: () => markerDeps.projects,
      secretManager: () => markerDeps.secretManager,
      services: () => markerDeps.services,
      workloadIdentity: () => markerDeps.workloadIdentity,
    });

    assert.equal(deps.artifactRegistry, markerDeps.artifactRegistry);
    assert.equal(deps.billing, markerDeps.billing);
    assert.equal(deps.iam, markerDeps.iam);
    assert.equal(deps.projects, markerDeps.projects);
    assert.equal(deps.secretManager, markerDeps.secretManager);
    assert.equal(deps.services, markerDeps.services);
    assert.equal(deps.workloadIdentity, markerDeps.workloadIdentity);
  });
});

function createMarkerDeps(): CloudRunProviderDeps {
  return {
    artifactRegistry: {
      async ensureDockerRepository() {},
      async ensureRepositoryIamBinding() {},
    },
    billing: {
      async linkProject() {},
    },
    iam: {
      async ensureProjectIamBinding() {},
      async ensureServiceAccount() {},
      async ensureServiceAccountIamBinding() {},
    },
    projects: {
      async ensureProject() {},
      async getProjectNumber() {
        return "123456789";
      },
    },
    secretManager: {
      async ensureSecretIamBinding() {},
      async upsertSecretVersion() {},
    },
    services: {
      async enableServices() {},
    },
    workloadIdentity: {
      async ensureGithubOidcProvider() {
        return {
          poolName:
            "projects/123456789/locations/global/workloadIdentityPools/github-actions",
          providerName:
            "projects/123456789/locations/global/workloadIdentityPools/github-actions/providers/github",
        };
      },
    },
  };
}
