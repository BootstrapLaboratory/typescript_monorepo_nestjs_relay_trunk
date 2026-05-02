import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { secret, step, text } from "deploy-scenario-engine/src/define.mjs";

const execFileAsync = promisify(execFile);

export const GITHUB_REPOSITORY_CONFIG_OUTPUTS = [
  "CLOUD_RUN_PUBLIC_URL",
  "CLOUD_RUN_CORS_ORIGIN",
  "GITHUB_REPOSITORY_CONFIGURED",
  "WEBAPP_VITE_GRAPHQL_HTTP",
  "WEBAPP_VITE_GRAPHQL_WS",
];

export function createGitHubRepositoryConfigStep(options = {}) {
  return step({
    guide:
      options.guide ??
      [
        "Configure GitHub repository variables and secrets for the production deploy workflow.",
        "Cloudflare token values are passed to GitHub as secrets and are not stored in scenario state.",
      ].join("\n"),
    id: options.id ?? "github.repository-config",
    inputs: {
      CLOUDFLARE_ACCOUNT_ID: text({ label: "Cloudflare account ID" }),
      CLOUDFLARE_API_TOKEN: secret({ label: "Cloudflare API token" }),
      CLOUDFLARE_PAGES_PROJECT_NAME: text({
        label: "Cloudflare Pages project name",
      }),
      CLOUD_RUN_CORS_ORIGIN: text({
        label: "Cloud Run CORS origin (optional, default webapp URL)",
      }).optional(),
      CLOUD_RUN_PUBLIC_URL: text({
        label: "Cloud Run public URL (optional, default live service URL)",
      }).optional(),
      CLOUD_RUN_REGION: text({ label: "Cloud Run region" }),
      CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT: text({
        label: "Cloud Run runtime service account",
      }),
      CLOUD_RUN_SERVICE: text({ label: "Cloud Run service" }),
      GCP_ARTIFACT_REGISTRY_REPOSITORY: text({
        label: "Artifact Registry repository",
      }),
      GCP_PROJECT_ID: text({ label: "Google Cloud project ID" }),
      GCP_SERVICE_ACCOUNT: text({
        label: "Cloud Run deployer service account",
      }),
      GCP_WORKLOAD_IDENTITY_PROVIDER: text({
        label: "Google Workload Identity provider",
      }),
      GITHUB_REPOSITORY: text({
        label: "GitHub repository (ex: owner/repo)",
      }),
      WEBAPP_URL: text({ label: "Webapp URL" }),
      WEBAPP_VITE_GRAPHQL_HTTP: text({
        label: "Webapp GraphQL HTTP URL (optional)",
      }).optional(),
      WEBAPP_VITE_GRAPHQL_WS: text({
        label: "Webapp GraphQL WebSocket URL (optional)",
      }).optional(),
    },
    outputs: GITHUB_REPOSITORY_CONFIG_OUTPUTS,
    title: options.title ?? "Configure GitHub repository",
    run: async (input) => {
      const resolved = await resolveGitHubRepositoryConfigInput(input, {
        resolveCloudRunServiceUrl: options.resolveCloudRunServiceUrl,
      });
      const provider = options.provider ?? (await loadDefaultProvider());
      const deps = options.deps ?? provider.createGitHubProviderDeps();

      return {
        ...(await provider.configureGitHubRepository(resolved, deps)),
        CLOUD_RUN_PUBLIC_URL: resolved.CLOUD_RUN_PUBLIC_URL,
        CLOUD_RUN_CORS_ORIGIN: resolved.CLOUD_RUN_CORS_ORIGIN,
        WEBAPP_VITE_GRAPHQL_HTTP: resolved.WEBAPP_VITE_GRAPHQL_HTTP,
        WEBAPP_VITE_GRAPHQL_WS: resolved.WEBAPP_VITE_GRAPHQL_WS,
      };
    },
  });
}

export async function resolveGitHubRepositoryConfigInput(input, options = {}) {
  const webappUrl = trimRequired(input.WEBAPP_URL, "WEBAPP_URL");
  const explicitGraphqlHttp = legacyDeterministicCloudRunGraphqlUrl(
    trimOptional(input.WEBAPP_VITE_GRAPHQL_HTTP),
    input,
  )
    ? undefined
    : trimOptional(input.WEBAPP_VITE_GRAPHQL_HTTP);
  const explicitGraphqlWs = legacyDeterministicCloudRunGraphqlUrl(
    trimOptional(input.WEBAPP_VITE_GRAPHQL_WS),
    input,
  )
    ? undefined
    : trimOptional(input.WEBAPP_VITE_GRAPHQL_WS);
  const explicitCloudRunPublicUrl = trimOptional(input.CLOUD_RUN_PUBLIC_URL);
  const cloudRunPublicUrl =
    explicitCloudRunPublicUrl === undefined
      ? explicitGraphqlHttp === undefined
        ? await resolveCloudRunPublicUrl(input, options)
        : serviceUrlFromGraphqlHttp(explicitGraphqlHttp)
      : serviceUrlFromPublicUrl(explicitCloudRunPublicUrl);
  const graphqlHttp =
    explicitGraphqlHttp ?? graphqlHttpFromCloudRunPublicUrl(cloudRunPublicUrl);
  const graphqlWs = explicitGraphqlWs ?? webSocketUrlFromHttp(graphqlHttp);
  const corsOrigin = originFromUrl(
    trimOptional(input.CLOUD_RUN_CORS_ORIGIN) ?? webappUrl,
    "CLOUD_RUN_CORS_ORIGIN",
  );

  assertHttpGraphqlUrl(graphqlHttp, "WEBAPP_VITE_GRAPHQL_HTTP");
  assertWebSocketGraphqlUrl(graphqlWs, "WEBAPP_VITE_GRAPHQL_WS");

  return {
    CLOUDFLARE_ACCOUNT_ID: trimRequired(
      input.CLOUDFLARE_ACCOUNT_ID,
      "CLOUDFLARE_ACCOUNT_ID",
    ),
    CLOUDFLARE_API_TOKEN: trimRequired(
      input.CLOUDFLARE_API_TOKEN,
      "CLOUDFLARE_API_TOKEN",
    ),
    CLOUDFLARE_PAGES_PROJECT_NAME: trimRequired(
      input.CLOUDFLARE_PAGES_PROJECT_NAME,
      "CLOUDFLARE_PAGES_PROJECT_NAME",
    ),
    CLOUD_RUN_PUBLIC_URL: cloudRunPublicUrl,
    CLOUD_RUN_CORS_ORIGIN: corsOrigin,
    CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT: trimRequired(
      input.CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT,
      "CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT",
    ),
    CLOUD_RUN_SERVICE: trimRequired(
      input.CLOUD_RUN_SERVICE,
      "CLOUD_RUN_SERVICE",
    ),
    GCP_ARTIFACT_REGISTRY_REPOSITORY: trimRequired(
      input.GCP_ARTIFACT_REGISTRY_REPOSITORY,
      "GCP_ARTIFACT_REGISTRY_REPOSITORY",
    ),
    GCP_PROJECT_ID: trimRequired(input.GCP_PROJECT_ID, "GCP_PROJECT_ID"),
    GCP_SERVICE_ACCOUNT: trimRequired(
      input.GCP_SERVICE_ACCOUNT,
      "GCP_SERVICE_ACCOUNT",
    ),
    GCP_WORKLOAD_IDENTITY_PROVIDER: trimRequired(
      input.GCP_WORKLOAD_IDENTITY_PROVIDER,
      "GCP_WORKLOAD_IDENTITY_PROVIDER",
    ),
    GITHUB_REPOSITORY: trimRequired(
      input.GITHUB_REPOSITORY,
      "GITHUB_REPOSITORY",
    ),
    WEBAPP_VITE_GRAPHQL_HTTP: graphqlHttp,
    WEBAPP_VITE_GRAPHQL_WS: graphqlWs,
  };
}

async function resolveCloudRunPublicUrl(input, options) {
  if (options.resolveCloudRunServiceUrl !== undefined) {
    return serviceUrlFromPublicUrl(
      await options.resolveCloudRunServiceUrl({
        projectId: trimRequired(input.GCP_PROJECT_ID, "GCP_PROJECT_ID"),
        region: trimRequired(input.CLOUD_RUN_REGION, "CLOUD_RUN_REGION"),
        service: trimRequired(input.CLOUD_RUN_SERVICE, "CLOUD_RUN_SERVICE"),
      }),
    );
  }

  return await resolveCloudRunServiceUrlWithGcloud({
    projectId: trimRequired(input.GCP_PROJECT_ID, "GCP_PROJECT_ID"),
    region: trimRequired(input.CLOUD_RUN_REGION, "CLOUD_RUN_REGION"),
    service: trimRequired(input.CLOUD_RUN_SERVICE, "CLOUD_RUN_SERVICE"),
  });
}

async function resolveCloudRunServiceUrlWithGcloud(input) {
  try {
    const { stdout } = await execFileAsync(
      "gcloud",
      [
        "run",
        "services",
        "describe",
        input.service,
        "--project",
        input.projectId,
        "--region",
        input.region,
        "--format=value(status.url)",
      ],
      {
        timeout: 30000,
      },
    );

    return serviceUrlFromPublicUrl(stdout);
  } catch (error) {
    const cause =
      error instanceof Error && error.message.length > 0
        ? `\nCause: ${error.message}`
        : "";

    throw new Error(
      [
        "Unable to resolve the deployed Cloud Run service URL.",
        `Service: ${input.service}`,
        `Project: ${input.projectId}`,
        `Region: ${input.region}`,
        "If this is the first rollout, run the server deploy first, then rerun this scenario step.",
        "Alternatively pass WEBAPP_VITE_GRAPHQL_HTTP and WEBAPP_VITE_GRAPHQL_WS explicitly.",
      ].join("\n") + cause,
    );
  }
}

function graphqlHttpFromCloudRunPublicUrl(publicUrl) {
  const serviceUrl = serviceUrlFromPublicUrl(publicUrl);

  return `${serviceUrl}/graphql`;
}

function serviceUrlFromPublicUrl(value) {
  const publicUrl = trimRequired(value, "CLOUD_RUN_PUBLIC_URL");
  let parsed;

  try {
    parsed = new URL(publicUrl);
  } catch {
    throw new Error("CLOUD_RUN_PUBLIC_URL must be an absolute HTTP URL.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("CLOUD_RUN_PUBLIC_URL must use https:// or http://.");
  }

  if (parsed.pathname !== "/" && parsed.pathname !== "") {
    throw new Error(
      "CLOUD_RUN_PUBLIC_URL must be the service origin without /graphql.",
    );
  }

  return parsed.origin;
}

function serviceUrlFromGraphqlHttp(value) {
  const graphqlHttp = trimRequired(value, "WEBAPP_VITE_GRAPHQL_HTTP");
  let parsed;

  try {
    parsed = new URL(graphqlHttp);
  } catch {
    throw new Error("WEBAPP_VITE_GRAPHQL_HTTP must be an absolute HTTP URL.");
  }

  return parsed.origin;
}

function legacyDeterministicCloudRunGraphqlUrl(value, input) {
  if (value === undefined) {
    return false;
  }

  const service = trimOptional(input.CLOUD_RUN_SERVICE);
  const region = trimOptional(input.CLOUD_RUN_REGION);

  if (service === undefined || region === undefined) {
    return false;
  }

  const escapedService = escapeRegExp(service);
  const escapedRegion = escapeRegExp(region);
  const legacyPattern = new RegExp(
    `^(?:https?|wss?)://${escapedService}-[0-9]+\\.${escapedRegion}\\.run\\.app/graphql/?$`,
  );

  return legacyPattern.test(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function webSocketUrlFromHttp(httpUrl) {
  if (httpUrl.startsWith("https://")) {
    return `wss://${httpUrl.slice("https://".length)}`;
  }

  if (httpUrl.startsWith("http://")) {
    return `ws://${httpUrl.slice("http://".length)}`;
  }

  throw new Error("WEBAPP_VITE_GRAPHQL_HTTP must use http:// or https://.");
}

function assertHttpGraphqlUrl(value, name) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP URL.`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${name} must use https:// or http://.`);
  }

  if (!parsed.pathname.endsWith("/graphql")) {
    throw new Error(`${name} must end with /graphql.`);
  }
}

function assertWebSocketGraphqlUrl(value, name) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute WebSocket URL.`);
  }

  if (parsed.protocol !== "wss:" && parsed.protocol !== "ws:") {
    throw new Error(`${name} must use wss:// or ws://.`);
  }

  if (!parsed.pathname.endsWith("/graphql")) {
    throw new Error(`${name} must end with /graphql.`);
  }
}

function originFromUrl(value, name) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${name} must use https:// or http://.`);
  }

  return parsed.origin;
}

function trimOptional(value) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function trimRequired(value, name) {
  if (typeof value !== "string") {
    throw new Error(`${name} is required.`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error(`${name} is required.`);
  }

  return trimmed;
}

async function loadDefaultProvider() {
  try {
    return await import("../../../providers/github/dist/src/index.js");
  } catch (error) {
    throw new Error(
      [
        "Unable to load deploy-provider-github.",
        "Build it with `npm --prefix deploy/providers/github run build` before running this action, or inject provider functions in tests.",
        `Cause: ${error.message}`,
      ].join(" "),
    );
  }
}
