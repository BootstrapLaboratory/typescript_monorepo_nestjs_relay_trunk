import { createGoogleArtifactRegistryRepositoryDependency } from "./artifact-registry.js";
import { createGoogleBillingDependency } from "./billing.js";
import { createGoogleIamDependency } from "./iam.js";
import { createGoogleProjectsDependency } from "./projects.js";
import { createGoogleSecretManagerDependency } from "./secret-manager.js";
import { createGoogleServicesDependency } from "./services.js";
import { createGoogleWorkloadIdentityDependency } from "./workload-identity.js";
import type { CloudRunProviderDeps } from "../types.js";

export type GoogleCloudRunProviderDepsFactories = {
  artifactRegistry?: () => CloudRunProviderDeps["artifactRegistry"];
  billing?: () => CloudRunProviderDeps["billing"];
  iam?: () => CloudRunProviderDeps["iam"];
  projects?: () => CloudRunProviderDeps["projects"];
  secretManager?: () => CloudRunProviderDeps["secretManager"];
  services?: () => CloudRunProviderDeps["services"];
  workloadIdentity?: () => CloudRunProviderDeps["workloadIdentity"];
};

export function createGoogleCloudRunProviderDeps(
  factories: GoogleCloudRunProviderDepsFactories = {},
): CloudRunProviderDeps {
  return {
    artifactRegistry:
      factories.artifactRegistry?.() ??
      createGoogleArtifactRegistryRepositoryDependency(),
    billing: factories.billing?.() ?? createGoogleBillingDependency(),
    iam: factories.iam?.() ?? createGoogleIamDependency(),
    projects: factories.projects?.() ?? createGoogleProjectsDependency(),
    secretManager:
      factories.secretManager?.() ?? createGoogleSecretManagerDependency(),
    services: factories.services?.() ?? createGoogleServicesDependency(),
    workloadIdentity:
      factories.workloadIdentity?.() ??
      createGoogleWorkloadIdentityDependency(),
  };
}
