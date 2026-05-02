import { v1 } from "@google-cloud/service-usage";

import type { CloudRunProviderDeps } from "../types.js";

const BATCH_ENABLE_LIMIT = 20;

type ServiceOperation = {
  promise(): Promise<[unknown, unknown?, unknown?]>;
};

export type ServiceUsageClientLike = {
  batchEnableServices(request: {
    parent: string;
    serviceIds: string[];
  }): Promise<[ServiceOperation, unknown?, unknown?]>;
  enableService(request: {
    name: string;
  }): Promise<[ServiceOperation, unknown?, unknown?]>;
};

export function createGoogleServicesDependency(
  client: ServiceUsageClientLike = new v1.ServiceUsageClient() as ServiceUsageClientLike,
): CloudRunProviderDeps["services"] {
  return {
    async enableServices(input) {
      const services = uniqueNonEmpty(input.services);

      if (services.length === 0) {
        return;
      }

      const parent = projectParent(input.projectNumber);

      for (const batch of chunk(services, BATCH_ENABLE_LIMIT)) {
        if (batch.length === 1) {
          const [operation] = await client.enableService({
            name: serviceResourceName(parent, batch[0]),
          });
          await operation.promise();
          continue;
        }

        const [operation] = await client.batchEnableServices({
          parent,
          serviceIds: batch,
        });
        await operation.promise();
      }
    },
  };
}

export function projectParent(projectNumber: string): string {
  return projectNumber.startsWith("projects/")
    ? projectNumber
    : `projects/${projectNumber}`;
}

function serviceResourceName(parent: string, serviceId: string): string {
  return `${parent}/services/${serviceId}`;
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.filter((value) => value !== ""))];
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}
