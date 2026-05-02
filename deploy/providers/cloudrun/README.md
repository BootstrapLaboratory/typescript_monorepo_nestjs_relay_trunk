# Cloud Run Provider

This package is the TypeScript provider spike for replacing Cloud Run provider
bootstrap shell logic with typed provider actions.

The package is wired into the guided deployment scenario. Existing scripts
under `deploy/cloudrun` remain supported manual/deployment entrypoints.

Concrete SDK-backed dependencies are available for Resource Manager projects,
Cloud Billing project links, Service Usage, Artifact Registry repository
creation plus repository IAM binding updates, IAM service account creation plus
project and service account IAM binding updates, and Workload Identity pool
plus GitHub OIDC provider creation. The default Google-backed dependency set is
available through `createGoogleCloudRunProviderDeps()`:

```ts
import {
  bootstrapCloudRun,
  createGoogleCloudRunProviderDeps,
} from "deploy-provider-cloudrun";

const output = await bootstrapCloudRun(
  {
    GITHUB_REPOSITORY: "BeltOrg/beltapp",
    PROJECT_ID: "example-project",
  },
  createGoogleCloudRunProviderDeps(),
);
```

The Cloud Run bootstrap action expects an existing Google Cloud project and
reads its project number before enabling services. The project adapter still
exposes lower-level project existence/creation helpers for tests and possible
future provider actions, but the guided scenario does not create Google Cloud
projects. The billing adapter uses `@google-cloud/billing` for optional project
billing-account links through `getProjectBillingInfo` and
`updateProjectBillingInfo`. The services adapter uses `@google-cloud/service-usage`
for required API enablement. The Artifact
Registry repository adapter uses `@google-cloud/artifact-registry` for Docker
repository creation and repository-scoped IAM policy updates through
`getIamPolicy` and `setIamPolicy`. The IAM adapter uses Google's official
`@googleapis/iam` IAM v1 client for service account creation and
service-account-scoped IAM policy updates through `getIamPolicy` and
`setIamPolicy`. It uses the Resource Manager Projects client for
project-scoped IAM policy updates through `getIamPolicy` and `setIamPolicy`.
The Workload Identity adapter uses `@googleapis/iam` IAM v1 for workload
identity pool creation and GitHub OIDC provider creation. Because that
generated client returns raw long-running operation resources, the adapter
polls the official operation `get` methods until completion. Tests inject fake
clients; verification does not call Google Cloud.

## Shape

`bootstrapCloudRun(input, deps)` keeps orchestration readable and accepts either
the default Google-backed dependencies or scenario-provided test doubles:

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
  Google's official `@googleapis/iam` IAM v1 client before custom REST

Do not add custom REST calls unless no official Google SDK or generated Google
API client provides the needed operation.

## Verify

```sh
npm --prefix deploy/providers/cloudrun run test
```
