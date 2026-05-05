import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUTH_ACCESS_TOKEN_SECRET_NAME,
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
        AUTH_ACCESS_TOKEN_SECRET_ROTATE: false,
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
        async secretExists(input) {
          calls.push(`exists:${input.secretName}`);
          return false;
        },
        async upsertSecretVersion(input) {
          const value =
            input.secretName === AUTH_ACCESS_TOKEN_SECRET_NAME
              ? "[generated]"
              : input.value;
          calls.push(`secret:${input.secretName}:${value}`);
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
      AUTH_ACCESS_TOKEN_SECRET_STATUS: "created",
      CLOUD_RUN_RUNTIME_SECRETS_SYNCED: "true",
    });
    assert.deepEqual(CLOUD_RUN_RUNTIME_SECRET_NAMES, [
      "DATABASE_URL",
      "DATABASE_URL_DIRECT",
      "REDIS_URL",
      "AUTH_ACCESS_TOKEN_SECRET",
    ]);
    assert.deepEqual(CLOUD_RUN_SERVICE_RUNTIME_SECRET_NAMES, [
      "DATABASE_URL",
      "REDIS_URL",
      "AUTH_ACCESS_TOKEN_SECRET",
    ]);
    assert.deepEqual(calls, [
      "exists:AUTH_ACCESS_TOKEN_SECRET",
      "secret:AUTH_ACCESS_TOKEN_SECRET:[generated]",
      "secret:DATABASE_URL:postgres://app:secret@example.test/app",
      "secret:DATABASE_URL_DIRECT:postgres://owner:secret@example.test/app",
      "secret:REDIS_URL:rediss://default:secret@example.test:6379",
      "iam:DATABASE_URL:serviceAccount:deployer@demo-project.iam.gserviceaccount.com:roles/secretmanager.secretAccessor",
      "iam:DATABASE_URL_DIRECT:serviceAccount:deployer@demo-project.iam.gserviceaccount.com:roles/secretmanager.secretAccessor",
      "iam:REDIS_URL:serviceAccount:deployer@demo-project.iam.gserviceaccount.com:roles/secretmanager.secretAccessor",
      "iam:AUTH_ACCESS_TOKEN_SECRET:serviceAccount:deployer@demo-project.iam.gserviceaccount.com:roles/secretmanager.secretAccessor",
      "iam:DATABASE_URL:serviceAccount:runtime@demo-project.iam.gserviceaccount.com:roles/secretmanager.secretAccessor",
      "iam:REDIS_URL:serviceAccount:runtime@demo-project.iam.gserviceaccount.com:roles/secretmanager.secretAccessor",
      "iam:AUTH_ACCESS_TOKEN_SECRET:serviceAccount:runtime@demo-project.iam.gserviceaccount.com:roles/secretmanager.secretAccessor",
    ]);
  });

  it("preserves an existing auth access token secret by default", async () => {
    const calls: string[] = [];
    const deps: Pick<CloudRunProviderDeps, "secretManager"> = {
      secretManager: {
        async ensureSecretIamBinding(input) {
          calls.push(`iam:${input.secretName}`);
        },
        async secretExists(input) {
          calls.push(`exists:${input.secretName}`);
          return input.secretName === AUTH_ACCESS_TOKEN_SECRET_NAME;
        },
        async upsertSecretVersion(input) {
          calls.push(`secret:${input.secretName}`);
        },
      },
    };

    const output = await syncCloudRunRuntimeSecrets(
      {
        DATABASE_URL: "postgres://app:secret@example.test/app",
        DATABASE_URL_DIRECT: "postgres://owner:secret@example.test/app",
        PROJECT_ID: "demo-project",
        REDIS_URL: "rediss://default:secret@example.test:6379",
      },
      deps,
    );

    assert.equal(output.AUTH_ACCESS_TOKEN_SECRET_STATUS, "preserved");
    assert.ok(!calls.includes("secret:AUTH_ACCESS_TOKEN_SECRET"));
  });

  it("rotates an existing auth access token secret only when requested", async () => {
    const calls: string[] = [];
    const deps: Pick<CloudRunProviderDeps, "secretManager"> = {
      secretManager: {
        async ensureSecretIamBinding() {},
        async secretExists() {
          return true;
        },
        async upsertSecretVersion(input) {
          calls.push(`secret:${input.secretName}:${input.value}`);
        },
      },
    };

    const output = await syncCloudRunRuntimeSecrets(
      {
        AUTH_ACCESS_TOKEN_SECRET:
          "replacement-auth-access-token-secret-with-enough-length",
        AUTH_ACCESS_TOKEN_SECRET_ROTATE: "yes",
        DATABASE_URL: "postgres://app:secret@example.test/app",
        DATABASE_URL_DIRECT: "postgres://owner:secret@example.test/app",
        PROJECT_ID: "demo-project",
        REDIS_URL: "rediss://default:secret@example.test:6379",
      },
      deps,
    );

    assert.equal(output.AUTH_ACCESS_TOKEN_SECRET_STATUS, "rotated");
    assert.ok(
      calls.includes(
        "secret:AUTH_ACCESS_TOKEN_SECRET:replacement-auth-access-token-secret-with-enough-length",
      ),
    );
  });

  it("rejects too-short explicit auth access token secrets", async () => {
    const deps: Pick<CloudRunProviderDeps, "secretManager"> = {
      secretManager: {
        async ensureSecretIamBinding() {},
        async secretExists() {
          return false;
        },
        async upsertSecretVersion() {},
      },
    };

    await assert.rejects(
      () =>
        syncCloudRunRuntimeSecrets(
          {
            AUTH_ACCESS_TOKEN_SECRET: "too-short",
            DATABASE_URL: "postgres://app:secret@example.test/app",
            DATABASE_URL_DIRECT: "postgres://owner:secret@example.test/app",
            PROJECT_ID: "demo-project",
            REDIS_URL: "rediss://default:secret@example.test:6379",
          },
          deps,
        ),
      /AUTH_ACCESS_TOKEN_SECRET must be configured with at least 32 characters/,
    );
  });
});
