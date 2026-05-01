# Cloud Run Provider

This package is the TypeScript design spike for replacing Cloud Run provider
bootstrap shell logic with typed provider actions.

The package does not make live Google Cloud calls yet. The first slice defines
the bootstrap operation shape, the dependency boundary, SDK selection policy,
and fake-dependency tests. Existing scripts under `deploy/cloudrun` remain the
working manual/deployment entrypoints until concrete SDK-backed dependencies
are implemented and wired into scenarios.

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
