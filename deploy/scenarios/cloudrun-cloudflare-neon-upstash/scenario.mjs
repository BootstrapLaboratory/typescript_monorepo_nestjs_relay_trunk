import {
  scenario,
  secret,
  step,
  text,
} from "deploy-scenario-engine/src/define.mjs";
import { createCloudflarePagesProjectStep } from "./steps/cloudflare-pages-project.mjs";
import { createCloudRunBootstrapStep } from "./steps/cloudrun-bootstrap.mjs";
import { createCloudRunRuntimeSecretsStep } from "./steps/cloudrun-runtime-secrets.mjs";
import { createGitHubRepositoryConfigStep } from "./steps/github-repository-config.mjs";

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

export const GITHUB_REPOSITORY_CONFIG_VARIABLES = [
  "GITHUB_REPOSITORY",
  "GITHUB_REPOSITORY_CONFIGURED",
  "CLOUD_RUN_PUBLIC_URL",
  "CLOUD_RUN_CORS_ORIGIN",
  "WEBAPP_VITE_GRAPHQL_HTTP",
  "WEBAPP_VITE_GRAPHQL_WS",
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
        guide: "Repository variables and Cloudflare secrets were written for the GitHub Actions deploy workflow.",
        title: "GitHub repository configuration",
        variables: GITHUB_REPOSITORY_CONFIG_VARIABLES,
      },
      {
        lines: [
          "Production provisioning/setup is complete: Cloud Run prerequisites are ready, backend runtime secrets are synced, the Cloudflare Pages project is prepared, and GitHub repository configuration is written.",
          "Database URLs, Redis URL, and Cloudflare API token are not written to the scenario state file.",
          "Ready for the first deploy. This scenario does not trigger deployment automatically.",
          "From a clean pushed branch, trigger deployment with: gh workflow run main-workflow.yaml --repo ${GITHUB_REPOSITORY} --ref main",
        ],
        title: "Next",
      },
    ],
    id: CLOUDRUN_CLOUDFLARE_NEON_UPSTASH_SCENARIO_ID,
    steps: [
      createGoogleProjectStep(),
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
      createGitHubRepositoryConfigStep({
        ...(options.github ?? {}),
        guide: [
          "Configure GitHub repository variables and secrets for the production workflow.",
          "The Cloud Run CORS origin defaults to the Pages URL.",
          "The webapp GraphQL endpoints default to the live Cloud Run service URL when it exists and can be overridden with WEBAPP_VITE_GRAPHQL_HTTP and WEBAPP_VITE_GRAPHQL_WS.",
        ].join("\n"),
        title: "Configure GitHub repository",
      }),
    ],
    title: "Cloud Run + Cloudflare Pages + Neon + Upstash",
  });
}

export function createGoogleProjectStep() {
  return step({
    guide: [
      "Create or choose a Google Cloud project in Google Cloud Console before continuing.",
      "Enable billing for that project, then copy/paste the immutable project ID here.",
      "The scenario will not create Google Cloud projects.",
    ].join("\n"),
    id: "google.project",
    inputs: {
      PROJECT_ID: text({
        label: "Google Cloud project ID",
      }),
    },
    outputs: ["PROJECT_ID"],
    title: "Choose Google Cloud project",
    run: async (input) => {
      const projectId = input.PROJECT_ID.trim();

      if (projectId.length === 0) {
        throw new Error("PROJECT_ID is required.");
      }

      return {
        PROJECT_ID: projectId,
      };
    },
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
