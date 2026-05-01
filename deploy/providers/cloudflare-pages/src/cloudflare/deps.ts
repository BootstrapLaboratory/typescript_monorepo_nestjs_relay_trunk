import {
  createCloudflarePagesClient,
  createCloudflarePagesDependency,
} from "./pages.js";
import type { CloudflarePagesProviderDeps } from "../types.js";

export type CloudflarePagesProviderDepsFactories = {
  apiToken?: string;
  pages?: () => CloudflarePagesProviderDeps["pages"];
};

export function createCloudflarePagesProviderDeps(
  factories: CloudflarePagesProviderDepsFactories = {},
): CloudflarePagesProviderDeps {
  return {
    pages:
      factories.pages?.() ??
      createCloudflarePagesDependency(
        createCloudflarePagesClient({
          apiToken: factories.apiToken,
        }),
      ),
  };
}
