import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { computeRushPlan } from "./compute-rush-plan-core.mjs";
import { loadDeployTargetsFromRepo } from "./deploy-target-metadata.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const OUTPUT_PATH = process.env.GITHUB_OUTPUT;
const DEPLOY_TAG_PREFIX = process.env.DEPLOY_TAG_PREFIX ?? "deploy/prod";

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

writeOutput("mode", plan.mode);
writeOutput("pr_base_sha", plan.prBaseSha);
writeOutput(
  "affected_projects_by_deploy_target_json",
  JSON.stringify(plan.affectedProjectsByDeployTarget),
);
writeOutput("validate_targets_json", JSON.stringify(plan.validateTargets));
writeOutput("deploy_targets_json", JSON.stringify(plan.deployTargets));
writeOutput("any_scope", String(plan.anyScope));
