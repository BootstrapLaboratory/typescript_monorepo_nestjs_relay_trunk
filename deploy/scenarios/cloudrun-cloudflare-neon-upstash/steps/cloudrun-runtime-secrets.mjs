import { secret, step, text } from "deploy-scenario-engine/src/define.mjs";
import { assertGoogleApplicationDefaultCredentials } from "./cloudrun-bootstrap.mjs";

export const CLOUD_RUN_RUNTIME_SECRETS_OUTPUTS = [
  "AUTH_ACCESS_TOKEN_SECRET_STATUS",
  "CLOUD_RUN_RUNTIME_SECRETS_SYNCED",
];

export function createCloudRunRuntimeSecretsStep(options = {}) {
  return step({
    guide:
      options.guide ??
      [
        "Sync backend runtime secrets into Google Secret Manager.",
        "AUTH_ACCESS_TOKEN_SECRET is generated when missing and preserved when it already exists unless rotation is requested.",
        "The secret values are not stored in scenario state.",
      ].join("\n"),
    id: options.id ?? "cloudrun.runtime-secrets",
    inputs: {
      CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT: text({
        label: "Cloud Run runtime service account",
      }).optional(),
      DATABASE_URL: secret({
        label: "DATABASE_URL (Neon pooled connection string)",
      }),
      DATABASE_URL_DIRECT: secret({
        label: "DATABASE_URL_DIRECT (Neon direct connection string)",
      }),
      GCP_SERVICE_ACCOUNT: text({
        label: "Cloud Run deployer service account",
      }).optional(),
      PROJECT_ID: text({ label: "Google Cloud project ID" }),
      REDIS_URL: secret({
        label: "REDIS_URL (Upstash Redis connection string)",
      }),
      AUTH_ACCESS_TOKEN_SECRET: secret({
        label:
          "AUTH_ACCESS_TOKEN_SECRET override (optional, generated when missing)",
      }).optional(),
      AUTH_ACCESS_TOKEN_SECRET_ROTATE: text({
        label:
          "Regenerate AUTH_ACCESS_TOKEN_SECRET if it already exists? Type yes or no",
      }),
    },
    outputs: CLOUD_RUN_RUNTIME_SECRETS_OUTPUTS,
    title: options.title ?? "Sync Cloud Run runtime secrets",
    run: async (input) => {
      assertPostgresConnectionUrl(input.DATABASE_URL, "DATABASE_URL");
      assertPostgresConnectionUrl(
        input.DATABASE_URL_DIRECT,
        "DATABASE_URL_DIRECT",
      );
      assertRedisConnectionUrl(input.REDIS_URL, "REDIS_URL");
      assertAuthSecretRotation(input.AUTH_ACCESS_TOKEN_SECRET_ROTATE);
      if (input.AUTH_ACCESS_TOKEN_SECRET !== undefined) {
        assertAuthAccessTokenSecret(input.AUTH_ACCESS_TOKEN_SECRET);
      }

      if (
        options.provider === undefined &&
        options.skipCredentialPreflight !== true
      ) {
        await assertGoogleApplicationDefaultCredentials();
      }

      const provider = options.provider ?? (await loadDefaultProvider());
      const deps = options.deps ?? provider.createGoogleCloudRunProviderDeps();

      return await provider.syncCloudRunRuntimeSecrets(input, deps);
    },
  });
}

function assertPostgresConnectionUrl(value, name) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL connection URL.`);
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`${name} must use postgres:// or postgresql://.`);
  }
}

function assertRedisConnectionUrl(value, name) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid Redis connection URL.`);
  }

  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error(`${name} must use redis:// or rediss://.`);
  }
}

function assertAuthAccessTokenSecret(value) {
  if (value.length < 32) {
    throw new Error(
      "AUTH_ACCESS_TOKEN_SECRET must be configured with at least 32 characters.",
    );
  }
}

function assertAuthSecretRotation(value) {
  const normalized = value.trim().toLowerCase();
  if (
    [
      "0",
      "1",
      "false",
      "n",
      "no",
      "preserve",
      "rotate",
      "true",
      "y",
      "yes",
    ].includes(normalized)
  ) {
    return;
  }

  throw new Error(
    "AUTH_ACCESS_TOKEN_SECRET_ROTATE must be yes/no, true/false, 1/0, rotate, or preserve.",
  );
}

async function loadDefaultProvider() {
  try {
    return await import("../../../providers/cloudrun/dist/src/index.js");
  } catch (error) {
    throw new Error(
      [
        "Unable to load deploy-provider-cloudrun.",
        "Build it with `npm --prefix deploy/providers/cloudrun run build` before running this action, or inject provider functions in tests.",
        `Cause: ${error instanceof Error ? error.message : "unknown error"}`,
      ].join(" "),
      { cause: error },
    );
  }
}
