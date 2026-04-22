import type { DeployRuntimeSpec } from "../model/deploy-target.ts"

type HostEnv = Record<string, string | undefined>

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0
}

export function parseDeployEnvFile(contents: string): Record<string, string> {
  const envVars: Record<string, string> = {}

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()

    if (line.length === 0 || line.startsWith("#")) {
      continue
    }

    const separatorIndex = line.indexOf("=")
    if (separatorIndex === -1) {
      throw new Error(`Invalid deploy env line "${rawLine}". Expected KEY=VALUE format.`)
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1)

    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      throw new Error(`Invalid deploy env key "${key}".`)
    }

    envVars[key] = value
  }

  return envVars
}

export function resolveSpecEnvironment(
  spec: DeployRuntimeSpec,
  hostEnv: HostEnv,
  dryRun: boolean,
  target: string,
): Record<string, string> {
  const envVars: Record<string, string> = {}

  for (const name of spec.pass_env) {
    const hostValue = hostEnv[name]

    if (isNonEmptyString(hostValue)) {
      envVars[name] = hostValue
      continue
    }

    const dryRunDefault = spec.dry_run_defaults[name]
    if (dryRun && isNonEmptyString(dryRunDefault)) {
      envVars[name] = dryRunDefault
      continue
    }

    throw new Error(`Missing required host environment variable "${name}" for target "${target}".`)
  }

  return {
    ...envVars,
    ...spec.env,
  }
}

export function validateRequiredHostEnv(
  spec: DeployRuntimeSpec,
  hostEnv: HostEnv,
  dryRun: boolean,
  target: string,
): void {
  if (dryRun) {
    return
  }

  for (const name of spec.required_host_env) {
    if (!isNonEmptyString(hostEnv[name])) {
      throw new Error(`Missing required host environment variable "${name}" for target "${target}".`)
    }
  }
}

export function getRequiredMountSource(hostEnv: HostEnv, name: string, target: string): string {
  const value = hostEnv[name]

  if (!isNonEmptyString(value)) {
    throw new Error(`Missing required host environment variable "${name}" for target "${target}".`)
  }

  return value
}
