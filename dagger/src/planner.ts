import { parse as parseYaml } from "yaml"

export type ServiceMeshService = {
  executor?: string
  deploy_after?: string[]
}

export type ServiceMesh = {
  services: Record<string, ServiceMeshService>
}

export type DeploymentWaveEntry = {
  target: string
  executor: string
}

export type DeploymentPlan = {
  selectedTargets: string[]
  waves: DeploymentWaveEntry[][]
}

export function parseReleaseTargets(releaseTargetsJson: string): string[] {
  const parsedValue = JSON.parse(releaseTargetsJson)

  if (!Array.isArray(parsedValue)) {
    throw new Error("releaseTargetsJson must be a JSON array.")
  }

  const normalizedTargets: string[] = []

  for (const target of parsedValue) {
    if (typeof target !== "string" || target.length === 0) {
      throw new Error("releaseTargetsJson entries must be non-empty strings.")
    }

    if (!normalizedTargets.includes(target)) {
      normalizedTargets.push(target)
    }
  }

  return normalizedTargets
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

  const normalizedServices: Record<string, ServiceMeshService> = {}

  for (const [target, rawService] of Object.entries(parsedValue.services)) {
    if (typeof target !== "string" || target.length === 0) {
      throw new Error("Service mesh target names must be non-empty strings.")
    }

    if (typeof rawService !== "object" || rawService === null || Array.isArray(rawService)) {
      throw new Error(`Service mesh entry for "${target}" must be a mapping.`)
    }

    const rawExecutor = "executor" in rawService ? rawService.executor : undefined
    const rawDeployAfter = "deploy_after" in rawService ? rawService.deploy_after : []

    if (rawExecutor !== undefined && (typeof rawExecutor !== "string" || rawExecutor.length === 0)) {
      throw new Error(`Service mesh executor for "${target}" must be a non-empty string when provided.`)
    }

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
      executor: rawExecutor ?? target,
      deploy_after: normalizedDeployAfter,
    }
  }

  return { services: normalizedServices }
}

export function buildDeploymentPlan(mesh: ServiceMesh, selectedTargets: string[]): DeploymentPlan {
  const selectedTargetSet = new Set(selectedTargets)

  for (const target of selectedTargets) {
    if (!(target in mesh.services)) {
      throw new Error(`Unknown release target "${target}" in services mesh.`)
    }
  }

  for (const [target, service] of Object.entries(mesh.services)) {
    for (const dependency of service.deploy_after ?? []) {
      if (!(dependency in mesh.services)) {
        throw new Error(`Unknown dependency "${dependency}" referenced by "${target}".`)
      }
    }
  }

  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const target of selectedTargets) {
    inDegree.set(target, 0)
    dependents.set(target, [])
  }

  for (const target of selectedTargets) {
    const service = mesh.services[target]
    for (const dependency of service.deploy_after ?? []) {
      if (!selectedTargetSet.has(dependency)) {
        continue
      }

      dependents.get(dependency)?.push(target)
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1)
    }
  }

  const remainingTargets = new Set(selectedTargets)
  const waves: DeploymentWaveEntry[][] = []

  while (remainingTargets.size > 0) {
    const waveTargets = [...remainingTargets]
      .filter((target) => (inDegree.get(target) ?? 0) === 0)
      .sort()

    if (waveTargets.length === 0) {
      throw new Error("Cycle detected in services mesh deploy_after graph.")
    }

    waves.push(
      waveTargets.map((target) => ({
        target,
        executor: mesh.services[target].executor ?? target,
      })),
    )

    for (const target of waveTargets) {
      remainingTargets.delete(target)
      for (const dependent of dependents.get(target) ?? []) {
        inDegree.set(dependent, (inDegree.get(dependent) ?? 0) - 1)
      }
    }
  }

  return {
    selectedTargets,
    waves,
  }
}
