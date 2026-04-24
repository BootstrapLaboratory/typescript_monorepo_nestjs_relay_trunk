import {
  argument,
  Directory,
  File,
  func,
  object,
  Socket,
} from "@dagger.io/dagger";

import { detect as detectCiPlan } from "./detect/detect.ts";
import { deployRelease } from "./deploy/deploy-release.ts";
import { buildDeployTargets } from "./build-stage/build-deploy-targets.ts";
import { packageDeployTargets } from "./package-stage/package-deploy-targets.ts";
import { parseReleaseTargets } from "./planning/parse-release-targets.ts";

@object()
export class ReleaseOrchestrator {
  /**
   * Returns a simple marker proving the Dagger module is callable.
   */
  @func()
  ping(): string {
    return "release-orchestrator ready";
  }

  /**
   * Computes the canonical CI plan JSON for detect/package/deploy handoff.
   */
  @func()
  async detect(
    @argument({ defaultPath: ".." }) repo: Directory,
    eventName: string = "push",
    forceTargetsJson: string = "[]",
    prBaseSha: string = "",
    deployTagPrefix: string = "deploy/prod",
  ): Promise<string> {
    return detectCiPlan(
      repo,
      eventName,
      forceTargetsJson,
      prBaseSha,
      deployTagPrefix,
    );
  }

  /**
   * Validates and normalizes a release target selection for future planning work.
   */
  @func()
  describeReleaseTargets(releaseTargetsJson: string = "[]"): string {
    const normalizedTargets = parseReleaseTargets(releaseTargetsJson);

    if (normalizedTargets.length === 0) {
      return "No release targets selected.";
    }

    return `Selected release targets: ${normalizedTargets.join(", ")}`;
  }

  /**
   * Runs the generic Rush build stage for deploy targets selected by ci-plan.json.
   */
  @func()
  async buildDeployTargets(
    @argument({ defaultPath: ".." }) repo: Directory,
    ciPlanFile: File,
  ): Promise<Directory> {
    return buildDeployTargets(repo, ciPlanFile);
  }

  /**
   * Materializes deploy package artifacts for deploy targets selected by ci-plan.json.
   */
  @func()
  async packageDeployTargets(
    @argument({ defaultPath: ".." }) repo: Directory,
    ciPlanFile: File,
    artifactPrefix: string = "deploy-target",
  ): Promise<Directory> {
    return packageDeployTargets(repo, ciPlanFile, artifactPrefix);
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
    packageManifestFile?: File,
    hostWorkspaceDir: string = "",
    dockerSocket?: Socket,
  ): Promise<string> {
    return deployRelease(
      repo,
      gitSha,
      releaseTargetsJson,
      environment,
      dryRun,
      deployEnvFile,
      packageManifestFile,
      hostWorkspaceDir,
      dockerSocket,
    );
  }
}
