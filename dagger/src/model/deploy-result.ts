import type { DeploymentPlan } from "./deployment-plan.ts";

export type DeployTargetResult = {
  artifactPath: string;
  output: string;
  status: "success";
  target: string;
  wave: number;
};

export type DeployReleaseResult = {
  dryRun: boolean;
  environment: string;
  plan: DeploymentPlan;
  results: DeployTargetResult[];
};
