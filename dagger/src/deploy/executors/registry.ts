import type { DeployExecutor } from "./types.ts"

const VALID_DEPLOY_EXECUTOR_NAME = /^[a-z][a-z0-9_]*$/
const deployExecutorCache = new Map<string, Promise<DeployExecutor>>()

function assertValidExecutorName(executorName: string): void {
  if (!VALID_DEPLOY_EXECUTOR_NAME.test(executorName)) {
    throw new Error(`Invalid deploy executor "${executorName}".`)
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function loadDeployExecutor(executorName: string): Promise<DeployExecutor> {
  try {
    const loadedModule = await import(`./${executorName}.ts`)
    const deployExecutor = "executor" in loadedModule ? loadedModule.executor : undefined

    if (!deployExecutor || typeof deployExecutor !== "object") {
      throw new Error(`Deploy executor module "${executorName}" must export "executor".`)
    }

    return deployExecutor as DeployExecutor
  } catch (error) {
    throw new Error(`Failed to load deploy executor "${executorName}": ${toErrorMessage(error)}`)
  }
}

export function getDeployExecutor(executorName: string): Promise<DeployExecutor> {
  assertValidExecutorName(executorName)

  let deployExecutor = deployExecutorCache.get(executorName)
  if (!deployExecutor) {
    deployExecutor = loadDeployExecutor(executorName).catch((error) => {
      deployExecutorCache.delete(executorName)
      throw error
    })
    deployExecutorCache.set(executorName, deployExecutor)
  }

  return deployExecutor
}
