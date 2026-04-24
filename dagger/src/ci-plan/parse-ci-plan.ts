import type { CiPlan } from "../model/ci-plan.ts";

function parseStringArray(rawValue: unknown, name: string): string[] {
  if (!Array.isArray(rawValue)) {
    throw new Error(`CI plan field "${name}" must be an array of strings.`);
  }

  return rawValue.map((entry) => {
    if (typeof entry !== "string") {
      throw new Error(`CI plan field "${name}" must contain only strings.`);
    }

    return entry;
  });
}

function parseAffectedProjectsByDeployTarget(
  rawValue: unknown,
): Record<string, string[]> {
  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error(
      'CI plan field "affected_projects_by_deploy_target" must be an object.',
    );
  }

  return Object.fromEntries(
    Object.entries(rawValue).map(([target, projects]) => {
      if (target.length === 0) {
        throw new Error(
          'CI plan field "affected_projects_by_deploy_target" must use non-empty target names.',
        );
      }

      return [
        target,
        parseStringArray(
          projects,
          `affected_projects_by_deploy_target.${target}`,
        ),
      ];
    }),
  );
}

export function parseCiPlan(source: string): CiPlan {
  const parsedValue = JSON.parse(source);

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error("CI plan must be a JSON object.");
  }

  const mode = "mode" in parsedValue ? parsedValue.mode : undefined;

  if (mode !== "pull_request" && mode !== "release") {
    throw new Error(
      'CI plan field "mode" must be either "pull_request" or "release".',
    );
  }

  const prBaseSha =
    "pr_base_sha" in parsedValue ? parsedValue.pr_base_sha : undefined;

  if (typeof prBaseSha !== "string") {
    throw new Error('CI plan field "pr_base_sha" must be a string.');
  }

  return {
    affected_projects_by_deploy_target: parseAffectedProjectsByDeployTarget(
      "affected_projects_by_deploy_target" in parsedValue
        ? parsedValue.affected_projects_by_deploy_target
        : undefined,
    ),
    deploy_targets: parseStringArray(
      "deploy_targets" in parsedValue ? parsedValue.deploy_targets : undefined,
      "deploy_targets",
    ),
    mode,
    pr_base_sha: prBaseSha,
    validate_targets: parseStringArray(
      "validate_targets" in parsedValue
        ? parsedValue.validate_targets
        : undefined,
      "validate_targets",
    ),
  };
}
