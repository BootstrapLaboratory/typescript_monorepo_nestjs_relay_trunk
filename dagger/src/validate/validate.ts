import { Container, Directory } from "@dagger.io/dagger";

import { formatCiPlan } from "../ci-plan/parse-ci-plan.ts";
import { computeCiPlan } from "../detect/compute-ci-plan.ts";
import type { CiPlan } from "../model/ci-plan.ts";
import { buildRushValidationSteps } from "../build-stage/rush-build-plan.ts";
import {
  installRush,
  prepareRushContainer,
  RUSH_WORKDIR,
} from "../rush/container.ts";
import {
  createManualValidationCiPlan,
  createValidationSummary,
  formatValidationSummary,
  parseValidateTargetsJson,
} from "./validation-result.ts";

const CI_PLAN_PATH = ".dagger/runtime/ci-plan.json";

function runValidationStage(container: Container, ciPlan: CiPlan): Container {
  if (ciPlan.validate_targets.length === 0) {
    console.log("[validate] no validate targets selected");
    return container;
  }

  let nextContainer = installRush(container).withEnvVariable(
    "FAILURE_MODE",
    "validate",
  );

  for (const { command, args } of buildRushValidationSteps(ciPlan)) {
    nextContainer = nextContainer.withExec([command, ...args], {
      expand: false,
    });
  }

  return nextContainer;
}

async function resolveValidationCiPlan(
  repo: Directory,
  container: Container,
  eventName: string,
  prBaseSha: string,
  validateTargetsJson: string,
): Promise<CiPlan> {
  const validateTargets = parseValidateTargetsJson(validateTargetsJson);

  if (validateTargets.length > 0) {
    return createManualValidationCiPlan(
      eventName,
      prBaseSha,
      validateTargets,
    );
  }

  return computeCiPlan(repo, container, eventName, "[]", prBaseSha);
}

export async function validate(
  repo: Directory,
  eventName: string = "pull_request",
  prBaseSha: string = "",
  validateTargetsJson: string = "[]",
): Promise<string> {
  const baseContainer = prepareRushContainer(repo);
  const ciPlan = await resolveValidationCiPlan(
    repo,
    baseContainer,
    eventName,
    prBaseSha,
    validateTargetsJson,
  );
  const detectedContainer = baseContainer.withNewFile(
    `${RUSH_WORKDIR}/${CI_PLAN_PATH}`,
    formatCiPlan(ciPlan),
  );

  await runValidationStage(detectedContainer, ciPlan).sync();

  return formatValidationSummary(createValidationSummary(ciPlan));
}
