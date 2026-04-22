import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const DEFAULT_CI_PLAN_RELATIVE_PATH = ".dagger/runtime/ci-plan.json";

function assertObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
}

function normalizeStringArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new Error(`CI plan field "${fieldName}" must be an array of strings.`);
  }

  return value.map((entry) => {
    if (typeof entry !== "string") {
      throw new Error(`CI plan field "${fieldName}" must contain only strings.`);
    }

    return entry;
  });
}

function normalizeAffectedProjectsByDeployTarget(value) {
  assertObject(
    value,
    'CI plan field "affected_projects_by_deploy_target" must be an object.',
  );

  return Object.fromEntries(
    Object.entries(value).map(([targetName, projects]) => {
      if (typeof targetName !== "string" || targetName.length === 0) {
        throw new Error(
          'CI plan field "affected_projects_by_deploy_target" must use non-empty target names.',
        );
      }

      return [
        targetName,
        normalizeStringArray(
          projects,
          `affected_projects_by_deploy_target.${targetName}`,
        ),
      ];
    }),
  );
}

export function resolveCiPlanPath(path = DEFAULT_CI_PLAN_RELATIVE_PATH) {
  return resolve(REPO_ROOT, path);
}

export function createCiPlan(plan) {
  return validateCiPlan({
    mode: plan.mode,
    pr_base_sha: plan.prBaseSha,
    affected_projects_by_deploy_target: plan.affectedProjectsByDeployTarget,
    validate_targets: plan.validateTargets,
    deploy_targets: plan.deployTargets,
  });
}

export function validateCiPlan(value) {
  assertObject(value, "CI plan must be a JSON object.");

  const mode = value.mode;
  if (mode !== "pull_request" && mode !== "release") {
    throw new Error(
      'CI plan field "mode" must be either "pull_request" or "release".',
    );
  }

  if (typeof value.pr_base_sha !== "string") {
    throw new Error('CI plan field "pr_base_sha" must be a string.');
  }

  return {
    mode,
    pr_base_sha: value.pr_base_sha,
    affected_projects_by_deploy_target: normalizeAffectedProjectsByDeployTarget(
      value.affected_projects_by_deploy_target,
    ),
    validate_targets: normalizeStringArray(
      value.validate_targets,
      "validate_targets",
    ),
    deploy_targets: normalizeStringArray(
      value.deploy_targets,
      "deploy_targets",
    ),
  };
}

export function writeCiPlanFile(plan, filePath = resolveCiPlanPath()) {
  const ciPlan = createCiPlan(plan);

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(ciPlan, null, 2)}\n`, "utf8");

  return ciPlan;
}

export function readCiPlanFile(filePath = resolveCiPlanPath()) {
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  return validateCiPlan(parsed);
}

export function deriveCiPlanOutputs(ciPlan) {
  const normalizedPlan = validateCiPlan(ciPlan);
  const hasValidateScope = normalizedPlan.validate_targets.length > 0;
  const hasDeployScope = normalizedPlan.deploy_targets.length > 0;

  return {
    mode: normalizedPlan.mode,
    pr_base_sha: normalizedPlan.pr_base_sha,
    affected_projects_by_deploy_target_json: JSON.stringify(
      normalizedPlan.affected_projects_by_deploy_target,
    ),
    validate_targets_json: JSON.stringify(normalizedPlan.validate_targets),
    deploy_targets_json: JSON.stringify(normalizedPlan.deploy_targets),
    has_validate_scope: String(hasValidateScope),
    has_deploy_scope: String(hasDeployScope),
    any_scope: String(hasValidateScope || hasDeployScope),
  };
}
