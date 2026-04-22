export type DeploymentWaveEntry = {
  target: string;
};

export type DeploymentPlan = {
  selectedTargets: string[];
  waves: DeploymentWaveEntry[][];
};
