import { CloudBillingClient, protos } from "@google-cloud/billing";

import type { CloudRunProviderDeps } from "../types.js";

type ProjectBillingInfo =
  protos.google.cloud.billing.v1.IProjectBillingInfo;

export type CloudBillingClientLike = {
  getProjectBillingInfo(request: {
    name: string;
  }): Promise<[ProjectBillingInfo, unknown?, unknown?]>;
  updateProjectBillingInfo(request: {
    name: string;
    projectBillingInfo: {
      billingAccountName: string;
    };
  }): Promise<[ProjectBillingInfo, unknown?, unknown?]>;
};

export function createGoogleBillingDependency(
  client: CloudBillingClientLike =
    new CloudBillingClient() as CloudBillingClientLike,
): CloudRunProviderDeps["billing"] {
  return {
    async linkProject(input) {
      const name = billingProjectResourceName(input.projectId);
      const billingAccountName = billingAccountResourceName(
        input.billingAccountId,
      );
      const [billingInfo] = await client.getProjectBillingInfo({
        name,
      });

      if (
        billingInfo.billingAccountName === billingAccountName &&
        billingInfo.billingEnabled === true
      ) {
        return;
      }

      await client.updateProjectBillingInfo({
        name,
        projectBillingInfo: {
          billingAccountName,
        },
      });
    },
  };
}

export function billingAccountResourceName(billingAccountId: string): string {
  return billingAccountId.startsWith("billingAccounts/")
    ? billingAccountId
    : `billingAccounts/${billingAccountId}`;
}

export function billingProjectResourceName(projectId: string): string {
  return projectId.startsWith("projects/") ? projectId : `projects/${projectId}`;
}
