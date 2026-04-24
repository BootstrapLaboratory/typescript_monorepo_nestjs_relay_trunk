import type { CiPlan } from "../model/ci-plan.ts";

const RUSH_SCRIPT = "common/scripts/install-run-rush.js";
const RUSH_BUILD_COMMANDS = ["verify", "lint", "test", "build"] as const;

export type RushBuildCommand = (typeof RUSH_BUILD_COMMANDS)[number];

export type RushBuildStep = {
  args: string[];
  command: "node";
};

export function buildRushTargetArgs(ciPlan: CiPlan): string[] {
  if (ciPlan.deploy_targets.length === 0) {
    throw new Error("No Rush deploy targets were selected.");
  }

  return ciPlan.deploy_targets.flatMap((target) => ["--to", target]);
}

export function buildRushBuildSteps(ciPlan: CiPlan): RushBuildStep[] {
  const targetArgs = buildRushTargetArgs(ciPlan);

  return RUSH_BUILD_COMMANDS.map((rushCommand) => ({
    args: [RUSH_SCRIPT, rushCommand, ...targetArgs],
    command: "node",
  }));
}
