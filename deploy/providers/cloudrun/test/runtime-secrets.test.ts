import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLOUD_RUN_RUNTIME_SECRET_NAMES,
  CLOUD_RUN_SERVICE_RUNTIME_SECRET_NAMES,
  resolveSyncCloudRunRuntimeSecretsInput,
  syncCloudRunRuntimeSecrets,
} from "../src/runtime-secrets.js";
import type { CloudRunProviderDeps } from "../src/types.js";

describe("Cloud Run runtime secrets sync", () => {
  it("resolves bash-compatible service account defaults", () => {
    assert.deepEqual(
      resolveSyncCloudRunRuntimeSecretsInput({
        DATABASE_URL: "postgres://app:secret@example.test/app",
        DATABASE_URL_DIRECT: "postgres://owner:secret@example.test/app",
        PROJECT_ID: "demo-project",
        REDIS_URL: "rediss://default:secret@example.test:6379",
      }),
      {
        DATABASE_URL: "postgres://app:secret@example.test/app",
        DATABASE_URL_DIRECT: "postgres://owner:secret@example.test/app",
        DEPLOYER_SERVICE_ACCOUNT_EMAIL:
          "github-actions-deployer@demo-project.iam.gserviceaccount.com",
        PROJECT_ID: "demo-project",
        REDIS_URL: "rediss://default:secret@example.test:6379",
        RUNTIME_SERVICE_ACCOUNT_EMAIL:
          "cloud-run-runtime@demo-project.iam.gserviceaccount.com",
      },
    );
  });

  it("prefers scenario-produced service account emails", () => {
    assert.equal(
      resolveSyncCloudRunRuntimeSecretsInput({
        CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:
          "runtime@example-project.iam.gserviceaccount.com",
        DATABASE_URL: "postgres://app:secret@example.test/app",
        DATABASE_URL_DIRECT: "postgres://owner:secret@example.test/app",
        GCP_SERVICE_ACCOUNT: "deployer@example-project.iam.gserviceaccount.com",
        PROJECT_ID: "demo-project",
        REDIS_URL: "rediss://default:secret@example.test:6379",
      }).DEPLOYER_SERVICE_ACCOUNT_EMAIL,
      "deployer@example-project.iam.gserviceaccount.com",
    );
  });

  it("upserts expected secrets and grants deployer/runtime access", async () => {
    const calls: string[] = [];
    const deps: Pick<CloudRunProviderDeps, "secretManager"> = {
      secretManager: {
        async ensureSecretIamBinding(input) {
          calls.push(`iam:${input.secretName}:${input.member}:${input.role}`);
        },
        async upsertSecretVersion(input) {
          calls.push(`secret:${input.secretName}:${input.value}`);
        },
      },
    };

    const output = await syncCloudRunRuntimeSecrets(
      {
        CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT:
          "runtime@demo-project.iam.gserviceaccount.com",
        DATABASE_URL: "postgres://app:secret@example.test/app",
        DATABASE_URL_DIRECT: "postgres://owner:secret@example.test/app",
        GCP_SERVICE_ACCOUNT: "deployer@demo-project.iam.gserviceaccount.com",
        PROJECT_ID: "demo-project",
        REDIS_URL: "rediss://default:secret@example.test:6379",
      },
      deps,
    );

    assert.deepEqual(output, {
      CLOUD_RUN_RUNTIME_SECRETS_SYNCED: "true",
    });
    assert.deepEqual(CLOUD_RUN_RUNTIME_SECRET_NAMES, [
      "DATABASE_URL",
      "DATABASE_URL_DIRECT",
      "REDIS_URL",
    ]);
    assert.deepEqual(CLOUD_RUN_SERVICE_RUNTIME_SECRET_NAMES, [
      "DATABASE_URL",
      "REDIS_URL",
    ]);
    assert.deepEqual(calls, [
      "secret:DATABASE_URL:postgres://app:secret@example.test/app",
      "secret:DATABASE_URL_DIRECT:postgres://owner:secret@example.test/app",
      "secret:REDIS_URL:rediss://default:secret@example.test:6379",
      "iam:DATABASE_URL:serviceAccount:deployer@demo-project.iam.gserviceaccount.com:roles/secretmanager.secretAccessor",
      "iam:DATABASE_URL_DIRECT:serviceAccount:deployer@demo-project.iam.gserviceaccount.com:roles/secretmanager.secretAccessor",
      "iam:REDIS_URL:serviceAccount:deployer@demo-project.iam.gserviceaccount.com:roles/secretmanager.secretAccessor",
      "iam:DATABASE_URL:serviceAccount:runtime@demo-project.iam.gserviceaccount.com:roles/secretmanager.secretAccessor",
      "iam:REDIS_URL:serviceAccount:runtime@demo-project.iam.gserviceaccount.com:roles/secretmanager.secretAccessor",
    ]);
  });
});
