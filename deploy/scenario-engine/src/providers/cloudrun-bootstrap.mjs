import { step, text } from "../define.mjs";

export const CLOUD_RUN_BOOTSTRAP_OUTPUTS = [
  "CLOUD_RUN_REGION",
  "CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT",
  "CLOUD_RUN_SERVICE",
  "GCP_ARTIFACT_REGISTRY_REPOSITORY",
  "GCP_PROJECT_ID",
  "GCP_SERVICE_ACCOUNT",
  "GCP_WORKLOAD_IDENTITY_PROVIDER",
  "PROJECT_ID",
  "PROJECT_NUMBER",
];

export function createCloudRunBootstrapStep(options = {}) {
  return step({
    guide:
      "Prepare the Google Cloud project prerequisites for the Cloud Run backend.",
    id: options.id ?? "cloudrun.bootstrap",
    inputs: {
      ARTIFACT_REGISTRY_REPOSITORY: text({
        label: "Artifact Registry repository",
      }).optional(),
      BILLING_ACCOUNT_ID: text({ label: "Billing account ID" }).optional(),
      CLOUD_RUN_REGION: text({ label: "Cloud Run region" }).optional(),
      CLOUD_RUN_SERVICE: text({ label: "Cloud Run service" }).optional(),
      DEPLOYER_SERVICE_ACCOUNT_ID: text({
        label: "Deployer service account ID",
      }).optional(),
      GITHUB_OWNER: text({ label: "GitHub owner" }).optional(),
      GITHUB_REPOSITORY: text({ label: "GitHub repository" }),
      PROJECT_ID: text({ label: "Google Cloud project ID" }),
      PROJECT_NAME: text({ label: "Google Cloud project name" }).optional(),
      RUNTIME_SERVICE_ACCOUNT_ID: text({
        label: "Runtime service account ID",
      }).optional(),
      WIF_POOL_ID: text({ label: "Workload Identity pool ID" }).optional(),
      WIF_PROVIDER_ID: text({
        label: "Workload Identity provider ID",
      }).optional(),
    },
    outputs: CLOUD_RUN_BOOTSTRAP_OUTPUTS,
    title: options.title ?? "Bootstrap Cloud Run",
    run: async (input) => {
      const provider = options.provider ?? (await loadDefaultProvider());
      const deps =
        options.deps ?? provider.createGoogleCloudRunProviderDeps();

      return await provider.bootstrapCloudRun(input, deps);
    },
  });
}

async function loadDefaultProvider() {
  try {
    return await import("deploy-provider-cloudrun");
  } catch (error) {
    throw new Error(
      [
        "Unable to load deploy-provider-cloudrun.",
        "Build it with `npm --prefix deploy/providers/cloudrun run build` before running this action, or inject provider functions in tests.",
        `Cause: ${error.message}`,
      ].join(" "),
    );
  }
}
