import { argument, Directory, File, func, object, Socket } from "@dagger.io/dagger"

import { deployRelease, planRelease } from "./deploy/deploy-release.ts"
import { parseReleaseTargets } from "./planning/parse-release-targets.ts"

@object()
export class ReleaseOrchestrator {
  /**
   * Returns a simple marker proving the Dagger module is callable.
   */
  @func()
  ping(): string {
    return "release-orchestrator ready"
  }

  /**
   * Validates and normalizes a release target selection for future planning work.
   */
  @func()
  describeReleaseTargets(releaseTargetsJson: string = "[]"): string {
    const normalizedTargets = parseReleaseTargets(releaseTargetsJson)

    if (normalizedTargets.length === 0) {
      return "No release targets selected."
    }

    return `Selected release targets: ${normalizedTargets.join(", ")}`
  }

  /**
   * Computes deployment waves from the canonical services mesh and selected release targets.
   */
  @func()
  async planRelease(@argument({ defaultPath: ".." }) repo: Directory, releaseTargetsJson: string = "[]"): Promise<string> {
    return planRelease(repo, releaseTargetsJson)
  }

  /**
   * Executes the release plan in wave order, applying generic target runtime handling in parallel within each wave.
   */
  @func()
  async deployRelease(
    @argument({ defaultPath: ".." }) repo: Directory,
    gitSha: string,
    releaseTargetsJson: string = "[]",
    environment: string = "prod",
    dryRun: boolean = true,
    deployEnvFile?: File,
    hostWorkspaceDir: string = "",
    dockerSocket?: Socket,
  ): Promise<string> {
    return deployRelease(repo, gitSha, releaseTargetsJson, environment, dryRun, deployEnvFile, hostWorkspaceDir, dockerSocket)
  }
}
