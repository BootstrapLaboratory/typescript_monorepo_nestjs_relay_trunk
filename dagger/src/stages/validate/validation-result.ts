import type { CiPlan } from "../../model/ci-plan.ts";
import { buildRushValidationSteps } from "../build-stage/rush-build-plan.ts";

export type ValidationSummary = {
  mode: CiPlan["mode"];
  pr_base_sha: string;
  rush_commands: string[];
  status: "passed" | "skipped";
  validate_targets: string[];
};

function normalizeStringArray(
  parsedValue: unknown,
  fieldName: string,
): string[] {
  if (!Array.isArray(parsedValue)) {
    throw new Error(`${fieldName} must be a JSON array.`);
  }

  const normalizedValues: string[] = [];
  for (const entry of parsedValue) {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(`${fieldName} entries must be non-empty strings.`);
    }

    if (!normalizedValues.includes(entry)) {
      normalizedValues.push(entry);
    }
  }

  return normalizedValues;
}

function resolveValidationMode(eventName: string): CiPlan["mode"] {
  if (!eventName) {
    throw new Error("GITHUB_EVENT_NAME is required.");
  }

  return eventName === "pull_request" ? "pull_request" : "release";
}

export function parseValidateTargetsJson(
  validateTargetsJson: string,
): string[] {
  try {
    return normalizeStringArray(
      JSON.parse(validateTargetsJson),
      "validateTargetsJson",
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("validateTargetsJson must be valid JSON.");
    }

    throw error;
  }
}

export function shouldUseManualValidationTargets(
  eventName: string,
  validateTargets: string[],
): boolean {
  return eventName !== "pull_request" || validateTargets.length > 0;
}

export function createManualValidationCiPlan(
  eventName: string,
  prBaseSha: string,
  validateTargets: string[],
): CiPlan {
  return {
    affected_projects_by_deploy_target: {},
    deploy_targets: [],
    mode: resolveValidationMode(eventName),
    pr_base_sha: prBaseSha,
    validate_targets: validateTargets,
  };
}

export function createValidationSummary(ciPlan: CiPlan): ValidationSummary {
  const rushSteps = buildRushValidationSteps(ciPlan);

  return {
    mode: ciPlan.mode,
    pr_base_sha: ciPlan.pr_base_sha,
    rush_commands: rushSteps.map((step) => step.args[1] ?? ""),
    status: ciPlan.validate_targets.length === 0 ? "skipped" : "passed",
    validate_targets: [...ciPlan.validate_targets],
  };
}

export function formatValidationSummary(summary: ValidationSummary): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}
