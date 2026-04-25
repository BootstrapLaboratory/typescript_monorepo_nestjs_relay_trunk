export const servicesMeshPath = ".dagger/deploy/services-mesh.yaml";
export const deployTargetsDirectory = ".dagger/deploy/targets";

export function targetDefinitionPath(target: string): string {
  return `${deployTargetsDirectory}/${target}.yaml`;
}
