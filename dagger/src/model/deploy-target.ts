export type FileMountSpec = {
  source_var: string
  target: string
}

export type SocketMountSpec = {
  source_var: string
  target: string
}

export type DeployRuntimeSpec = {
  dry_run_defaults: Record<string, string>
  env: Record<string, string>
  file_mounts: FileMountSpec[]
  image: string
  install: string[]
  pass_env: string[]
  required_host_env: string[]
  socket_mounts: SocketMountSpec[]
}

export type DeployTargetDefinition = {
  artifact_path: string
  deploy_script: string
  name: string
  runtime: DeployRuntimeSpec
}
