export function resolveConfigValue(
  rawValue: string | undefined,
  name: string,
  dryRunDefault: string,
  dryRun: boolean,
  target: string,
): string {
  if (rawValue !== undefined && rawValue.length > 0) {
    return rawValue
  }

  if (dryRun) {
    return dryRunDefault
  }

  throw new Error(`Missing required deploy config value "${name}" for target "${target}".`)
}
