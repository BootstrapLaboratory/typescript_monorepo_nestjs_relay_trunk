export type ServerDeployConfig = {
  cloudRunCorsOrigin?: string
  cloudRunRegion?: string
  cloudRunRuntimeServiceAccount?: string
  cloudRunService?: string
  gcpArtifactRegistryRepository?: string
  gcpProjectId?: string
}

export type WebappDeployConfig = {
  cloudflareAccountId?: string
  cloudflareApiToken?: string
  cloudflarePagesProjectName?: string
  webappGraphqlHttp?: string
  webappGraphqlWs?: string
  webappUrl?: string
}

export type DeployConfig = {
  server?: ServerDeployConfig
  webapp?: WebappDeployConfig
}

export function parseDeployConfig(deployConfigJson: string): DeployConfig {
  const parsedValue = JSON.parse(deployConfigJson)

  if (typeof parsedValue !== "object" || parsedValue === null || Array.isArray(parsedValue)) {
    throw new Error("deployConfigFile must contain a top-level JSON object.")
  }

  return parsedValue as DeployConfig
}
