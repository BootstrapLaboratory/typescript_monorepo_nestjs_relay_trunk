export function packageTargetDefinitionPath(target: string): string {
  return `.dagger/package/targets/${target}.yaml`;
}
