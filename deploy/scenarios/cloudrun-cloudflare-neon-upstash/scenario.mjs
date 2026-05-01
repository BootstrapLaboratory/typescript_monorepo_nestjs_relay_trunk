import { randomBytes } from "node:crypto";

import {
  scenario,
  secret,
  step,
  text,
} from "deploy-scenario-engine/src/define.mjs";
import { createCloudflarePagesProjectStep } from "./steps/cloudflare-pages-project.mjs";
import { createCloudRunBootstrapStep } from "./steps/cloudrun-bootstrap.mjs";
import { createCloudRunRuntimeSecretsStep } from "./steps/cloudrun-runtime-secrets.mjs";

export const CLOUDRUN_CLOUDFLARE_NEON_UPSTASH_SCENARIO_ID =
  "cloudrun-cloudflare-neon-upstash";

export const CLOUD_RUN_BACKEND_GITHUB_VARIABLES = [
  "GCP_PROJECT_ID",
  "GCP_WORKLOAD_IDENTITY_PROVIDER",
  "GCP_SERVICE_ACCOUNT",
  "GCP_ARTIFACT_REGISTRY_REPOSITORY",
  "CLOUD_RUN_SERVICE",
  "CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT",
];

export const CLOUDFLARE_PAGES_PROJECT_HANDOFF_VARIABLES = [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_PAGES_PROJECT_NAME",
  "CLOUDFLARE_PAGES_PRODUCTION_BRANCH",
  "CLOUDFLARE_PAGES_AUTOMATIC_DEPLOYMENTS",
  "WEBAPP_URL",
];

export function createCloudRunCloudflareNeonUpstashScenario(options = {}) {
  return scenario({
    completionSections: [
      {
        guide: "Set these as GitHub repository variables for the backend deploy workflow.",
        title: "Cloud Run backend GitHub variables",
        variables: CLOUD_RUN_BACKEND_GITHUB_VARIABLES,
      },
      {
        guide: "Cloudflare Pages project provisioning is complete. The API token is secret and is not printed or stored.",
        title: "Cloudflare Pages project",
        variables: CLOUDFLARE_PAGES_PROJECT_HANDOFF_VARIABLES,
      },
      {
        lines: [
          "Cloud Run backend bootstrap is complete, backend runtime secrets are synced, and the Cloudflare Pages project is prepared.",
          "Database URLs, Redis URL, and Cloudflare API token are not written to the scenario state file.",
          "Next scenario slices will configure GitHub repository values and webapp GraphQL endpoints.",
        ],
        title: "Next",
      },
    ],
    id: CLOUDRUN_CLOUDFLARE_NEON_UPSTASH_SCENARIO_ID,
    steps: [
      createGoogleProjectStep(options.googleProject),
      createCloudRunBootstrapStep({
        ...(options.cloudRun ?? {}),
        guide: [
          "Prepare the Google Cloud project prerequisites for the Cloud Run backend.",
          "After bootstrap, the scenario collects Neon and Upstash credentials, syncs runtime secrets, then prepares Cloudflare Pages.",
        ].join("\n"),
        title: "Bootstrap Cloud Run backend",
      }),
      createNeonDatabaseStep(options.neon),
      createUpstashRedisStep(options.upstash),
      createCloudRunRuntimeSecretsStep({
        ...(options.runtimeSecrets ?? {}),
        guide: [
          "Write DATABASE_URL, DATABASE_URL_DIRECT, and REDIS_URL to Google Secret Manager.",
          "The deployer service account receives access to all three secrets.",
          "The Cloud Run runtime service account receives access to DATABASE_URL and REDIS_URL.",
        ].join("\n"),
        title: "Sync Cloud Run runtime secrets",
      }),
      createCloudflarePagesProjectStep({
        ...(options.cloudflarePages ?? {}),
        guide: [
          "Prepare the Cloudflare Pages project for the webapp.",
          "The API token is used to call Cloudflare and is not written to scenario state.",
          "This step does not deploy assets or configure GitHub repository values.",
        ].join("\n"),
        title: "Prepare Cloudflare Pages project",
      }),
    ],
    title: "Cloud Run + Cloudflare Pages + Neon + Upstash",
  });
}

export function createGoogleProjectStep(options = {}) {
  return step({
    guide: [
      "Enter a friendly Google Cloud project name.",
      "If PROJECT_ID is not provided with --var, the scenario generates a valid project ID and persists it for resume.",
    ].join("\n"),
    id: "google.project",
    inputs: {
      PROJECT_ID: text({
        label: "Google Cloud project ID (optional override)",
      }).optional(),
      PROJECT_NAME: text({ label: "Google Cloud project name" }),
    },
    outputs: ["PROJECT_NAME", "PROJECT_ID"],
    title: "Choose Google Cloud project",
    run: async (input) => ({
      PROJECT_ID:
        input.PROJECT_ID ??
        generateGoogleProjectId(input.PROJECT_NAME, {
          randomSuffix: options.randomSuffix,
        }),
      PROJECT_NAME: input.PROJECT_NAME,
    }),
  });
}

export function createNeonDatabaseStep() {
  return step({
    guide: [
      "Enter the Neon PostgreSQL connection strings for the backend.",
      "Use the pooled application connection string for DATABASE_URL.",
      "Use the direct connection string for DATABASE_URL_DIRECT so migrations can run safely.",
      "These values are transient secrets; they are available to later steps in this run and are not persisted to the scenario state file.",
    ].join("\n"),
    id: "neon.database",
    inputs: {
      DATABASE_URL: secret({
        label: "DATABASE_URL (Neon pooled connection string)",
      }),
      DATABASE_URL_DIRECT: secret({
        label: "DATABASE_URL_DIRECT (Neon direct connection string)",
      }),
    },
    outputs: ["NEON_DATABASE_URLS_READY"],
    title: "Collect Neon database URLs",
    run: async (input) => {
      assertPostgresConnectionUrl(input.DATABASE_URL, "DATABASE_URL");
      assertPostgresConnectionUrl(
        input.DATABASE_URL_DIRECT,
        "DATABASE_URL_DIRECT",
      );

      return {
        NEON_DATABASE_URLS_READY: "true",
      };
    },
  });
}

export function createUpstashRedisStep() {
  return step({
    guide: [
      "Enter the Upstash Redis connection string for backend pub/sub.",
      "Use the Redis URL from Upstash, usually starting with rediss:// for TLS.",
      "This value is a transient secret; it is available to later steps in this run and is not persisted to the scenario state file.",
    ].join("\n"),
    id: "upstash.redis",
    inputs: {
      REDIS_URL: secret({
        label: "REDIS_URL (Upstash Redis connection string)",
      }),
    },
    outputs: ["UPSTASH_REDIS_URL_READY"],
    title: "Collect Upstash Redis URL",
    run: async (input) => {
      assertRedisConnectionUrl(input.REDIS_URL, "REDIS_URL");

      return {
        UPSTASH_REDIS_URL_READY: "true",
      };
    },
  });
}

export function generateGoogleProjectId(projectName, options = {}) {
  const suffix = options.randomSuffix ?? randomBytes(3).toString("hex");
  const base = projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .replace(/-+/g, "-");
  const normalizedBase = /^[a-z]/.test(base) ? base : `project-${base}`;
  const trimmedBase = normalizedBase
    .slice(0, 30 - suffix.length - 1)
    .replace(/-+$/, "");

  return `${trimmedBase}-${suffix}`;
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
