import { deployServerExecutor } from "./deploy_server.ts"
import { deployWebappExecutor } from "./deploy_webapp.ts"
import type { DeployExecutor } from "./types.ts"

const deployExecutors: Record<string, DeployExecutor> = {
  deploy_server: deployServerExecutor,
  deploy_webapp: deployWebappExecutor,
}

export function getDeployExecutor(executorName: string): DeployExecutor {
  const deployExecutor = deployExecutors[executorName]

  if (!deployExecutor) {
    throw new Error(`Unsupported deploy executor "${executorName}".`)
  }

  return deployExecutor
}
