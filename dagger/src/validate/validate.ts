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
  shouldUseManualValidationTargets,
} from "./validation-result.ts";
import { runValidationMetadataStage } from "./validation-runner.ts";
import { logValidationSection } from "./validation-log.ts";

const CI_PLAN_PATH = ".dagger/runtime/ci-plan.json";

type ValidationContext = {
  baseContainer?: Container;
  ciPlan: CiPlan;
};

function runValidationStage(container: Container, ciPlan: CiPlan): Container {
  if (ciPlan.validate_targets.length === 0) {
    console.log("[validate] no validate targets selected");
    return container;
  }

  logValidationSection("Rush validation");
  console.log(
    `[validate] Rush targets: ${ciPlan.validate_targets.join(", ")}`,
  );

  let nextContainer = installRush(container).withEnvVariable(
    "FAILURE_MODE",
    "validate",
  );

  for (const { command, args } of buildRushValidationSteps(ciPlan)) {
    console.log(`[validate] Rush command: ${args[1]}`);
    nextContainer = nextContainer.withExec([command, ...args], {
      expand: false,
    });
  }

  return nextContainer;
}

async function runValidationStages(
  repo: Directory,
  container: Container,
  ciPlan: CiPlan,
): Promise<Container> {
  const rushValidatedContainer = runValidationStage(container, ciPlan);

  if (ciPlan.validate_targets.length === 0) {
    return rushValidatedContainer;
  }

  logValidationSection("Metadata validation");

  return (
    await runValidationMetadataStage(
      repo,
      rushValidatedContainer,
      ciPlan.validate_targets,
    )
  ).container;
}

async function resolveValidationContext(
  repo: Directory,
  eventName: string,
  prBaseSha: string,
  validateTargetsJson: string,
): Promise<ValidationContext> {
  const validateTargets = parseValidateTargetsJson(validateTargetsJson);

  if (shouldUseManualValidationTargets(eventName, validateTargets)) {
    return {
      ciPlan: createManualValidationCiPlan(
        eventName,
        prBaseSha,
        validateTargets,
      ),
    };
  }

  const baseContainer = prepareRushContainer(repo);

  return {
    baseContainer,
    ciPlan: await computeCiPlan(
      repo,
      baseContainer,
      eventName,
      "[]",
      prBaseSha,
    ),
  };
}

export async function validate(
  repo: Directory,
  eventName: string = "pull_request",
  prBaseSha: string = "",
  validateTargetsJson: string = "[]",
): Promise<string> {
  const { baseContainer, ciPlan } = await resolveValidationContext(
    repo,
    eventName,
    prBaseSha,
    validateTargetsJson,
  );

  if (ciPlan.validate_targets.length === 0) {
    console.log("[validate] no validate targets selected");
    return formatValidationSummary(createValidationSummary(ciPlan));
  }

  const validationContainer = baseContainer ?? prepareRushContainer(repo);
  const detectedContainer = validationContainer
    .withExec(["mkdir", "-p", `${RUSH_WORKDIR}/.dagger/runtime`], {
      expand: false,
    })
    .withNewFile(`${RUSH_WORKDIR}/${CI_PLAN_PATH}`, formatCiPlan(ciPlan));

  await (await runValidationStages(repo, detectedContainer, ciPlan)).sync();

  return formatValidationSummary(createValidationSummary(ciPlan));
}
