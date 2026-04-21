import { resolveConfigValue } from "../resolve-config-value.ts"
import type { DeployExecutor, DeployExecutorContext } from "./types.ts"

const WEBAPP_EXECUTOR_IMAGE = "node:24-bookworm-slim"

function buildEnvironment(context: DeployExecutorContext): Record<string, string> {
  const webappConfig = context.deployConfig.webapp ?? {}
  const cloudflarePagesProjectName = resolveConfigValue(
    webappConfig.cloudflarePagesProjectName,
    "webapp.cloudflarePagesProjectName",
    "webapp",
    context.dryRun,
    context.service.target,
  )

  return {
    CLOUDFLARE_ACCOUNT_ID: resolveConfigValue(
      webappConfig.cloudflareAccountId,
      "webapp.cloudflareAccountId",
      "dry-run-account",
      context.dryRun,
      context.service.target,
    ),
    CLOUDFLARE_API_TOKEN: resolveConfigValue(
      webappConfig.cloudflareApiToken,
      "webapp.cloudflareApiToken",
      "dry-run-token",
      context.dryRun,
      context.service.target,
    ),
    CLOUDFLARE_PAGES_PROJECT_NAME: cloudflarePagesProjectName,
    WEBAPP_URL: resolveConfigValue(
      webappConfig.webappUrl,
      "webapp.webappUrl",
      `https://${cloudflarePagesProjectName}.pages.dev`,
      context.dryRun,
      context.service.target,
    ),
    WEBAPP_VITE_GRAPHQL_HTTP: resolveConfigValue(
      webappConfig.webappGraphqlHttp,
      "webapp.webappGraphqlHttp",
      "https://api.example.invalid/graphql",
      context.dryRun,
      context.service.target,
    ),
    WEBAPP_VITE_GRAPHQL_WS: resolveConfigValue(
      webappConfig.webappGraphqlWs,
      "webapp.webappGraphqlWs",
      "wss://api.example.invalid/graphql",
      context.dryRun,
      context.service.target,
    ),
  }
}

function dryRunPreparationCommand(context: DeployExecutorContext): string {
  return `mkdir -p ${context.service.artifact_path}`
}

export const executor: DeployExecutor = {
  buildEnvironment,
  dryRunPreparationCommand,
  image: WEBAPP_EXECUTOR_IMAGE,
}
