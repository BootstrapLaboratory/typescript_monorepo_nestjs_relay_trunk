export type DeploymentWaveEntry = {
  target: string
  executor: string
}

export type DeploymentPlan = {
  selectedTargets: string[]
  waves: DeploymentWaveEntry[][]
}
