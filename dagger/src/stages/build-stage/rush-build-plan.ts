import type { CiPlan } from "../../model/ci-plan.ts";
import {
  buildRushLifecycleSteps,
  buildRushProjectArgs,
  type RushCommandStep,
  type RushLifecycleCommand,
} from "../../rush/rush-command-plan.ts";

const NO_DEPLOY_TARGETS_MESSAGE = "No Rush deploy targets were selected.";

export type RushBuildCommand = RushLifecycleCommand;
export type RushBuildStep = RushCommandStep;

export function buildRushTargetArgs(ciPlan: CiPlan): string[] {
  return buildRushProjectArgs(ciPlan.deploy_targets, {
    emptySelectionMessage: NO_DEPLOY_TARGETS_MESSAGE,
  });
}

export function buildRushBuildSteps(ciPlan: CiPlan): RushBuildStep[] {
  return buildRushLifecycleSteps(ciPlan.deploy_targets, {
    emptySelectionMessage: NO_DEPLOY_TARGETS_MESSAGE,
  });
}

export function buildRushValidationSteps(ciPlan: CiPlan): RushBuildStep[] {
  return buildRushLifecycleSteps(ciPlan.validate_targets, {
    allowEmpty: true,
  });
}
