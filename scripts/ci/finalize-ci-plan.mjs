import { appendFileSync } from "node:fs";
import {
  deriveCiPlanOutputs,
  readCiPlanFile,
  resolveCiPlanPath,
} from "./ci-plan.mjs";

const OUTPUT_PATH = process.env.GITHUB_OUTPUT;
const CI_PLAN_PATH = resolveCiPlanPath(process.env.CI_PLAN_PATH);

function writeOutput(name, value) {
  const normalizedValue = String(value);

  if (OUTPUT_PATH) {
    appendFileSync(OUTPUT_PATH, `${name}=${normalizedValue}\n`, "utf8");
  }

  console.log(`${name}=${normalizedValue}`);
}

const outputs = deriveCiPlanOutputs(readCiPlanFile(CI_PLAN_PATH));

for (const name of [
  "mode",
  "has_validate_scope",
  "has_deploy_scope",
  "pr_base_sha",
  "affected_projects_by_deploy_target_json",
  "validate_targets_json",
  "deploy_targets_json",
]) {
  writeOutput(name, outputs[name]);
}
