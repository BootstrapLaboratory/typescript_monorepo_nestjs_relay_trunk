export function getEnvFilePaths(nodeEnv = process.env.NODE_ENV): string[] {
  return [`.env.${nodeEnv ?? 'development'}`, '.env'];
}
