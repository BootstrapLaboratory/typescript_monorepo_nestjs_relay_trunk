import type { Container, File, Socket } from "@dagger.io/dagger"

import type { DeployConfig } from "../../model/deploy-config.ts"
import type { ResolvedService } from "../../model/service-mesh.ts"

export type DeployExecutorContext = {
  deployConfig: DeployConfig
  dockerSocket?: Socket
  dryRun: boolean
  environment: string
  gcpCredentialsFile?: File
  gitSha: string
  service: ResolvedService
}

export type DeployExecutor = {
  buildEnvironment(context: DeployExecutorContext): Record<string, string>
  dryRunPreparationCommand?(context: DeployExecutorContext): string | undefined
  image: string
  prepareContainer?(container: Container, context: DeployExecutorContext): Container
}
