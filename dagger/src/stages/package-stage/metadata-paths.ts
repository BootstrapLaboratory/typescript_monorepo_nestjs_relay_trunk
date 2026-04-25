export const packageTargetsDirectory = ".dagger/package/targets";

export function packageTargetDefinitionPath(target: string): string {
  return `${packageTargetsDirectory}/${target}.yaml`;
}
