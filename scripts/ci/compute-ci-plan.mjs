import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createCiPlan, resolveCiPlanPath, writeCiPlanFile } from "./ci-plan.mjs";
import { computeRushPlan } from "./compute-rush-plan-core.mjs";
import { loadDeployTargetsFromRepo } from "./deploy-target-metadata.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const DEPLOY_TAG_PREFIX = process.env.DEPLOY_TAG_PREFIX ?? "deploy/prod";
const CI_PLAN_PATH = process.env.CI_PLAN_PATH
  ? resolveCiPlanPath(process.env.CI_PLAN_PATH)
  : "";

function run(command, args) {
  return execFileSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
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

const ciPlan = CI_PLAN_PATH
  ? writeCiPlanFile(plan, CI_PLAN_PATH)
  : createCiPlan(plan);

console.log(JSON.stringify(ciPlan, null, 2));
