import { parse as parseYaml } from "yaml"

import type { ServiceDefinition, ServiceMesh } from "../model/service-mesh.ts"

function parseRequiredString(rawValue: unknown, name: string): string {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    throw new Error(`${name} must be a non-empty string.`)
  }

  return rawValue
}

export function parseServicesMesh(servicesMeshYaml: string): ServiceMesh {
  const parsedValue = parseYaml(servicesMeshYaml)

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    !("services" in parsedValue) ||
    typeof parsedValue.services !== "object" ||
    parsedValue.services === null ||
    Array.isArray(parsedValue.services)
  ) {
    throw new Error("services-mesh.yaml must define a top-level services mapping.")
  }

  const normalizedServices: Record<string, ServiceDefinition> = {}

  for (const [target, rawService] of Object.entries(parsedValue.services)) {
    if (typeof target !== "string" || target.length === 0) {
      throw new Error("Service mesh target names must be non-empty strings.")
    }

    if (typeof rawService !== "object" || rawService === null || Array.isArray(rawService)) {
      throw new Error(`Service mesh entry for "${target}" must be a mapping.`)
    }

    const rawExecutor = "executor" in rawService ? rawService.executor : undefined
    const rawDeployAfter = "deploy_after" in rawService ? rawService.deploy_after : []
    const rawDeployScript = "deploy_script" in rawService ? rawService.deploy_script : undefined
    const rawArtifactPath = "artifact_path" in rawService ? rawService.artifact_path : undefined

    if (!Array.isArray(rawDeployAfter)) {
      throw new Error(`Service mesh deploy_after for "${target}" must be an array.`)
    }

    const normalizedDeployAfter: string[] = []
    for (const dependency of rawDeployAfter) {
      if (typeof dependency !== "string" || dependency.length === 0) {
        throw new Error(`Service mesh deploy_after entries for "${target}" must be non-empty strings.`)
      }

      if (!normalizedDeployAfter.includes(dependency)) {
        normalizedDeployAfter.push(dependency)
      }
    }

    normalizedServices[target] = {
      artifact_path: parseRequiredString(rawArtifactPath, `Service mesh artifact_path for "${target}"`),
      deploy_after: normalizedDeployAfter,
      deploy_script: parseRequiredString(rawDeployScript, `Service mesh deploy_script for "${target}"`),
      executor: parseRequiredString(rawExecutor, `Service mesh executor for "${target}"`),
    }
  }

  return { services: normalizedServices }
}
