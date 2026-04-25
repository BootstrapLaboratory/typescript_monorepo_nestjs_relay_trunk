import {
  argument,
  Directory,
  File,
  func,
  object,
  Socket,
} from "@dagger.io/dagger";

import { detect as detectCiPlan } from "./stages/detect/detect.ts";
import { deployRelease } from "./stages/deploy/deploy-release.ts";
import { buildAndPackageDeployTargets } from "./stages/package-stage/build-and-package-deploy-targets.ts";
import { buildDeployTargets } from "./stages/build-stage/build-deploy-targets.ts";
import { packageDeployTargets } from "./stages/package-stage/package-deploy-targets.ts";
import { parseReleaseTargets } from "./planning/parse-release-targets.ts";
import { validate as validateRelease } from "./stages/validate/validate.ts";
import { workflow as runWorkflow } from "./workflow/workflow.ts";
import {
  assertMetadataContract,
  validateMetadataContract as validateMetadataContractForRepo,
} from "./metadata/dagger-metadata-contract.ts";
import { formatMetadataContractValidationResult } from "./metadata/metadata-contract.ts";

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
    await assertMetadataContract(repo);

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
    await assertMetadataContract(repo);

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
    await assertMetadataContract(repo);

    return packageDeployTargets(repo, ciPlanFile, artifactPrefix);
  }

  /**
   * Runs build and package as separate stages while exporting the final packaged workspace once.
   */
  @func()
  async buildAndPackageDeployTargets(
    @argument({ defaultPath: ".." }) repo: Directory,
    ciPlanFile: File,
    artifactPrefix: string = "deploy-target",
  ): Promise<Directory> {
    await assertMetadataContract(repo);

    return buildAndPackageDeployTargets(repo, ciPlanFile, artifactPrefix);
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
    await assertMetadataContract(repo);

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

  /**
   * Validates cross-file Dagger metadata contracts before running release stages.
   */
  @func()
  async validateMetadataContract(
    @argument({ defaultPath: ".." }) repo: Directory,
  ): Promise<string> {
    return formatMetadataContractValidationResult(
      await validateMetadataContractForRepo(repo),
    );
  }

  /**
   * Runs the deploy-oriented workflow as one Dagger composition: detect, build, package, then deploy.
   */
  @func()
  async workflow(
    @argument({ defaultPath: ".." }) repo: Directory,
    gitSha: string,
    eventName: string = "push",
    forceTargetsJson: string = "[]",
    prBaseSha: string = "",
    deployTagPrefix: string = "deploy/prod",
    artifactPrefix: string = "deploy-target",
    environment: string = "prod",
    dryRun: boolean = true,
    deployEnvFile?: File,
    hostWorkspaceDir: string = "",
    dockerSocket?: Socket,
  ): Promise<string> {
    return runWorkflow(
      repo,
      gitSha,
      eventName,
      forceTargetsJson,
      prBaseSha,
      deployTagPrefix,
      artifactPrefix,
      environment,
      dryRun,
      deployEnvFile,
      hostWorkspaceDir,
      dockerSocket,
    );
  }

  /**
   * Runs Dagger-owned pull-request validation for affected Rush projects.
   */
  @func()
  async validate(
    @argument({ defaultPath: ".." }) repo: Directory,
    eventName: string = "pull_request",
    prBaseSha: string = "",
    validateTargetsJson: string = "[]",
  ): Promise<string> {
    await assertMetadataContract(repo);

    return validateRelease(repo, eventName, prBaseSha, validateTargetsJson);
  }
}
