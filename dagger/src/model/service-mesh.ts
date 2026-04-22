export type ServiceDefinition = {
  deploy_after: string[]
}

export type ServiceMesh = {
  services: Record<string, ServiceDefinition>
}

export type ResolvedService = ServiceDefinition & {
  target: string
}

export function resolveService(mesh: ServiceMesh, target: string): ResolvedService {
  const service = mesh.services[target]

  if (!service) {
    throw new Error(`Unknown release target "${target}" in services mesh.`)
  }

  return {
    target,
    ...service,
  }
}
