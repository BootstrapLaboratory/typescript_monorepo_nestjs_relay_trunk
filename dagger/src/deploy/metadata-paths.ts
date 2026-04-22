export const servicesMeshPath = ".dagger/deploy/services-mesh.yaml";

export function targetDefinitionPath(target: string): string {
  return `.dagger/deploy/targets/${target}.yaml`;
}
