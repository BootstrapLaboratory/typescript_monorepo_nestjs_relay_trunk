# Cloud Run Provider

This package is the TypeScript provider spike for replacing Cloud Run provider
bootstrap shell logic with typed provider actions.

The package is not wired into scenarios or deployment scripts yet. Existing
scripts under `deploy/cloudrun` remain the working manual/deployment
entrypoints until the concrete SDK-backed dependencies are implemented and
intentionally adopted.

Concrete SDK-backed dependencies are available for Resource Manager projects,
Service Usage, and Artifact Registry repository creation plus repository IAM
binding updates:

```ts
import {
  createGoogleArtifactRegistryRepositoryDependency,
  createGoogleProjectsDependency,
  createGoogleServicesDependency,
} from "deploy-provider-cloudrun";

const artifactRepositories =
  createGoogleArtifactRegistryRepositoryDependency();
const projects = createGoogleProjectsDependency();
const services = createGoogleServicesDependency();
```

The project adapter uses `@google-cloud/resource-manager` for project
existence, project creation, and project-number lookup. The services adapter
uses `@google-cloud/service-usage` for required API enablement. The Artifact
Registry repository adapter uses `@google-cloud/artifact-registry` for Docker
repository creation and repository-scoped IAM policy updates through
`getIamPolicy` and `setIamPolicy`. Tests inject fake clients; verification does
not call Google Cloud.

## Shape

`bootstrapCloudRun(input, deps)` keeps orchestration readable:

```ts
const output = await bootstrapCloudRun(
  {
    GITHUB_REPOSITORY: "BeltOrg/beltapp",
    PROJECT_ID: "example-project",
  },
  deps,
);
```

The returned output mirrors the values currently printed by
`deploy/cloudrun/scripts/bootstrap-gcp.sh`, but as a typed object:

```ts
{
  PROJECT_ID: string;
  PROJECT_NUMBER: string;
  CLOUD_RUN_REGION: string;
  GCP_PROJECT_ID: string;
  GCP_WORKLOAD_IDENTITY_PROVIDER: string;
  GCP_SERVICE_ACCOUNT: string;
  GCP_ARTIFACT_REGISTRY_REPOSITORY: string;
  CLOUD_RUN_SERVICE: string;
  CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT: string;
}
```

## SDK Policy

Use official Google SDKs as far as they reasonably go:

- Resource Manager: `@google-cloud/resource-manager`
- Cloud Billing: `@google-cloud/billing`
- Service Usage: `@google-cloud/service-usage`
- Artifact Registry: `@google-cloud/artifact-registry`
- Cloud Run: `@google-cloud/run`
- IAM: `@google-cloud/iam` where it exposes the required surface; otherwise
  Google's official `googleapis` IAM v1 client before custom REST

Do not add custom REST calls unless no official Google SDK or generated Google
API client provides the needed operation.

## Verify

```sh
npm --prefix deploy/providers/cloudrun run test
```
