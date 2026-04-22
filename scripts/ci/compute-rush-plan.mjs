import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  deriveCiPlanOutputs,
  resolveCiPlanPath,
  writeCiPlanFile,
} from "./ci-plan.mjs";
import { computeRushPlan } from "./compute-rush-plan-core.mjs";
import { loadDeployTargetsFromRepo } from "./deploy-target-metadata.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const OUTPUT_PATH = process.env.GITHUB_OUTPUT;
const DEPLOY_TAG_PREFIX = process.env.DEPLOY_TAG_PREFIX ?? "deploy/prod";
const CI_PLAN_PATH = resolveCiPlanPath(process.env.CI_PLAN_PATH);

function run(command, args) {
  return execFileSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function writeOutput(name, value) {
  const normalizedValue = String(value);

  if (OUTPUT_PATH) {
    appendFileSync(OUTPUT_PATH, `${name}=${normalizedValue}\n`, "utf8");
  }

  console.log(`${name}=${normalizedValue}`);
}

function hasGitCommit(ref) {
  try {
    run("git", ["rev-parse", "--verify", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function resolveCommitSha(ref) {
  return run("git", ["rev-parse", `${ref}^{commit}`]);
}

function rushAffectedProjects(baseSha) {
  if (!baseSha) {
    return [];
  }

  const output = run("node", [
    "common/scripts/install-run-rush.js",
    "list",
    "--json",
    "--from",
    `git:${baseSha}`,
  ]);
  const jsonStartIndex = output.indexOf("{");

  if (jsonStartIndex === -1) {
    throw new Error(`Rush did not emit JSON for base SHA ${baseSha}.`);
  }

  const parsedOutput = JSON.parse(output.slice(jsonStartIndex));

  return [
    ...new Set(parsedOutput.projects.map((project) => project.name)),
  ].sort();
}

const plan = computeRushPlan({
  deployTagPrefix: DEPLOY_TAG_PREFIX,
  deployTargets: loadDeployTargetsFromRepo(REPO_ROOT),
  eventName: process.env.GITHUB_EVENT_NAME ?? "",
  forceTargetsJson: process.env.FORCE_TARGETS_JSON ?? "[]",
  hasGitCommit,
  prBaseSha: process.env.PR_BASE_SHA ?? "",
  resolveCommitSha,
  rushAffectedProjects,
});
const ciPlan = writeCiPlanFile(plan, CI_PLAN_PATH);
const outputs = deriveCiPlanOutputs(ciPlan);

for (const name of [
  "mode",
  "pr_base_sha",
  "affected_projects_by_deploy_target_json",
  "validate_targets_json",
  "deploy_targets_json",
  "any_scope",
]) {
  writeOutput(name, outputs[name]);
}
