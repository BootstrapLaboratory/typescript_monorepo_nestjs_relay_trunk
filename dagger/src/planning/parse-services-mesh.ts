import { parse as parseYaml } from "yaml";

import { assertKnownKeys } from "../metadata/parse-utils.ts";
import type { ServiceDefinition, ServiceMesh } from "../model/service-mesh.ts";

export function parseServicesMesh(servicesMeshYaml: string): ServiceMesh {
  const parsedValue = parseYaml(servicesMeshYaml);

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    !("services" in parsedValue) ||
    typeof parsedValue.services !== "object" ||
    parsedValue.services === null ||
    Array.isArray(parsedValue.services)
  ) {
    throw new Error(
      "services-mesh.yaml must define a top-level services mapping.",
    );
  }

  assertKnownKeys(
    parsedValue as Record<string, unknown>,
    ["services"],
    "services-mesh.yaml",
  );

  const normalizedServices: Record<string, ServiceDefinition> = {};

  for (const [target, rawService] of Object.entries(parsedValue.services)) {
    if (typeof target !== "string" || target.length === 0) {
      throw new Error("Service mesh target names must be non-empty strings.");
    }

    if (
      typeof rawService !== "object" ||
      rawService === null ||
      Array.isArray(rawService)
    ) {
      throw new Error(`Service mesh entry for "${target}" must be a mapping.`);
    }

    assertKnownKeys(
      rawService as Record<string, unknown>,
      ["deploy_after"],
      `Service mesh entry for "${target}"`,
    );

    const rawDeployAfter =
      "deploy_after" in rawService ? rawService.deploy_after : [];

    if (!Array.isArray(rawDeployAfter)) {
      throw new Error(
        `Service mesh deploy_after for "${target}" must be an array.`,
      );
    }

    const normalizedDeployAfter: string[] = [];
    for (const dependency of rawDeployAfter) {
      if (typeof dependency !== "string" || dependency.length === 0) {
        throw new Error(
          `Service mesh deploy_after entries for "${target}" must be non-empty strings.`,
        );
      }

      if (!normalizedDeployAfter.includes(dependency)) {
        normalizedDeployAfter.push(dependency);
      }
    }

    normalizedServices[target] = {
      deploy_after: normalizedDeployAfter,
    };
  }

  return { services: normalizedServices };
}
