export const validationTargetsDirectory = ".dagger/validate/targets";

export function validationTargetDefinitionPath(target: string): string {
  return `${validationTargetsDirectory}/${target}.yaml`;
}
