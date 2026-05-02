import { access } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { step, text } from "deploy-scenario-engine/src/define.mjs";

export const CLOUD_RUN_BOOTSTRAP_OUTPUTS = [
  "CLOUD_RUN_REGION",
  "CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT",
  "CLOUD_RUN_SERVICE",
  "GCP_ARTIFACT_REGISTRY_REPOSITORY",
  "GCP_PROJECT_ID",
  "GCP_SERVICE_ACCOUNT",
  "GCP_WORKLOAD_IDENTITY_PROVIDER",
  "GITHUB_REPOSITORY",
  "PROJECT_ID",
  "PROJECT_NUMBER",
];

export function createCloudRunBootstrapStep(options = {}) {
  return step({
    guide:
      options.guide ??
      "Prepare the Google Cloud project prerequisites for the Cloud Run backend.",
    id: options.id ?? "cloudrun.bootstrap",
    inputs: {
      ARTIFACT_REGISTRY_REPOSITORY: text({
        label: "Artifact Registry repository",
      }).optional(),
      CLOUD_RUN_REGION: text({ label: "Cloud Run region" }).optional(),
      CLOUD_RUN_SERVICE: text({ label: "Cloud Run service" }).optional(),
      DEPLOYER_SERVICE_ACCOUNT_ID: text({
        label: "Deployer service account ID",
      }).optional(),
      GITHUB_OWNER: text({ label: "GitHub owner" }).optional(),
      GITHUB_REPOSITORY: text({
        label: "GitHub repository (ex: owner/repo)",
      }),
      PROJECT_ID: text({ label: "Google Cloud project ID" }),
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
    run: async (input, context = {}) => {
      if (
        options.provider === undefined &&
        options.skipCredentialPreflight !== true
      ) {
        await assertGoogleApplicationDefaultCredentials();
      }

      const provider = options.provider ?? (await loadDefaultProvider());
      const deps = options.deps ?? provider.createGoogleCloudRunProviderDeps();

      for (;;) {
        try {
          return {
            ...(await provider.bootstrapCloudRun(input, deps)),
            GITHUB_REPOSITORY: input.GITHUB_REPOSITORY,
          };
        } catch (error) {
          const normalizedError = normalizeGoogleCredentialError(error);

          if (
            options.retryBillingPrecondition !== false &&
            isBillingRequiredError(normalizedError)
          ) {
            await waitForBillingEnablement({
              error: normalizedError,
              input,
              ui: context.ui,
            });
            continue;
          }

          throw normalizedError;
        }
      }
    },
  });
}

export async function assertGoogleApplicationDefaultCredentials() {
  if (process.env.DEPLOY_SCENARIO_SKIP_GOOGLE_ADC_PREFLIGHT === "1") {
    return;
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credentialsPath !== undefined && credentialsPath !== "") {
    try {
      await access(credentialsPath);
      return;
    } catch {
      throw new Error(
        [
          "GOOGLE_APPLICATION_CREDENTIALS points to a file that cannot be read.",
          `Path: ${credentialsPath}`,
          "Set GOOGLE_APPLICATION_CREDENTIALS to a readable service-account JSON file.",
          "Or run `gcloud auth application-default login --disable-quota-project`.",
        ].join("\n"),
      );
    }
  }

  const applicationDefaultCredentialsPath =
    process.platform === "win32"
      ? join(
          process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"),
          "gcloud",
          "application_default_credentials.json",
        )
      : join(
          homedir(),
          ".config",
          "gcloud",
          "application_default_credentials.json",
        );

  try {
    await access(applicationDefaultCredentialsPath);
  } catch {
    throw missingApplicationDefaultCredentialsError();
  }
}

export function normalizeGoogleCredentialError(error) {
  if (isMissingApplicationDefaultCredentialsError(error)) {
    return missingApplicationDefaultCredentialsError();
  }

  return error;
}

export function isBillingRequiredError(error) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error;
  const message =
    "message" in maybeError && typeof maybeError.message === "string"
      ? maybeError.message
      : "";
  const status =
    "status" in maybeError && typeof maybeError.status === "string"
      ? maybeError.status
      : undefined;
  const code = "code" in maybeError ? maybeError.code : undefined;
  const hasBillingMessage =
    message.includes("Billing account for project") &&
    message.includes("Billing must be enabled");

  return (
    hasBillingMessage &&
    (code === 9 ||
      status === "FAILED_PRECONDITION" ||
      message.includes("FAILED_PRECONDITION"))
  );
}

async function waitForBillingEnablement({ error, input, ui }) {
  const message = [
    `Google Cloud billing is not enabled for project "${input.PROJECT_ID}".`,
    `Billing page: https://console.cloud.google.com/billing/linkedaccount?project=${input.PROJECT_ID}`,
    "Enable billing for this project in Google Cloud Console, then continue.",
    "Google Cloud free-tier resources can still require an enabled billing account.",
    error instanceof Error ? `Cause: ${error.message}` : undefined,
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  if (ui?.waitForContinue === undefined) {
    throw new Error(message);
  }

  await ui.waitForContinue({
    message,
    title: "Enable Google Cloud billing",
  });
}

function missingApplicationDefaultCredentialsError() {
  return new Error(
    [
      "Google Cloud Application Default Credentials are not configured.",
      "Run `gcloud auth application-default login --disable-quota-project`.",
      "Or set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json.",
      "If this environment intentionally uses Google metadata-server credentials,",
      "set DEPLOY_SCENARIO_SKIP_GOOGLE_ADC_PREFLIGHT=1.",
    ].join("\n"),
  );
}

function isMissingApplicationDefaultCredentialsError(error) {
  return (
    error instanceof Error &&
    error.message.includes("Could not load the default credentials")
  );
}

async function loadDefaultProvider() {
  try {
    return await import("../../../providers/cloudrun/dist/src/index.js");
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
