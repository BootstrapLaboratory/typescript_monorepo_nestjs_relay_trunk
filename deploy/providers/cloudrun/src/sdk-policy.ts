export type GoogleSdkPolicyEntry = {
  notes: string;
  preferredPackage: string;
  providerArea: string;
};

export const googleSdkPolicy = [
  {
    notes:
      "Use the official Resource Manager client for project existence, creation, and project number lookup. This adapter is implemented by createGoogleProjectsDependency.",
    preferredPackage: "@google-cloud/resource-manager",
    providerArea: "projects",
  },
  {
    notes:
      "Use the official Cloud Billing client for optional project billing-account links.",
    preferredPackage: "@google-cloud/billing",
    providerArea: "billing",
  },
  {
    notes:
      "Use the official Service Usage client for enabling required project services. This adapter is implemented by createGoogleServicesDependency.",
    preferredPackage: "@google-cloud/service-usage",
    providerArea: "services",
  },
  {
    notes:
      "Use the official Artifact Registry client for repository creation and repository IAM policy updates.",
    preferredPackage: "@google-cloud/artifact-registry",
    providerArea: "artifactRegistry",
  },
  {
    notes:
      "Use the official IAM client when it exposes the needed IAM Admin surface. If the generated Cloud client is incomplete for service accounts, policies, or Workload Identity Federation, use Google's official googleapis IAM v1 client before considering custom REST.",
    preferredPackage: "@google-cloud/iam or googleapis",
    providerArea: "iam",
  },
  {
    notes:
      "Use the official Cloud Run client for service-level deployment operations. Bootstrap currently prepares Cloud Run prerequisites and does not create a service.",
    preferredPackage: "@google-cloud/run",
    providerArea: "cloudRun",
  },
] satisfies GoogleSdkPolicyEntry[];
