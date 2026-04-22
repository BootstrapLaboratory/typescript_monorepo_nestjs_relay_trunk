import * as assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const SCRIPT_PATH = resolve(import.meta.dirname, "compute-ci-plan.mjs");

function writeExecutable(path, contents) {
  writeFileSync(path, contents, "utf8");
  chmodSync(path, 0o755);
}

function setupFixture({
  gitRefs = {},
  rushAffectedProjectsBySha = {},
}) {
  const fixtureDir = mkdtempSync(join(tmpdir(), "compute-ci-plan-"));
  const binDir = join(fixtureDir, "bin");
  const gitRefsFile = join(fixtureDir, "git-refs.tsv");
  const rushAffectedProjectsFile = join(fixtureDir, "rush-affected.tsv");
  const ciPlanFile = join(fixtureDir, "ci-plan.json");

  mkdirSync(binDir, { recursive: true });

  writeFileSync(
    gitRefsFile,
    `${Object.entries(gitRefs)
      .map(([ref, sha]) => `${ref}\t${sha}`)
      .join("\n")}\n`,
    "utf8",
  );

  writeFileSync(
    rushAffectedProjectsFile,
    `${Object.entries(rushAffectedProjectsBySha)
      .map(([sha, projects]) => `${sha}\t${projects.join(",")}`)
      .join("\n")}\n`,
    "utf8",
  );

  writeExecutable(
    join(binDir, "git"),
    `#!/usr/bin/env bash
set -euo pipefail

fixture_dir="\${TEST_FIXTURE_DIR:?}"
git_refs_file="\${fixture_dir}/git-refs.tsv"

command_name="\${1:-}"
if [[ "\${command_name}" != "rev-parse" ]]; then
  echo "Unsupported git command: \${command_name}" >&2
  exit 2
fi
shift

if [[ "\${1:-}" == "--verify" ]]; then
  shift
fi

ref="\${1:-}"
suffix='^{commit}'
if [[ "\${ref}" == *"\${suffix}" ]]; then
  ref="\${ref:0:$(( \${#ref} - \${#suffix} ))}"
fi

while IFS=$'\\t' read -r candidate_ref candidate_sha; do
  if [[ "\${candidate_ref}" == "\${ref}" ]]; then
    printf '%s\\n' "\${candidate_sha}"
    exit 0
  fi
done < "\${git_refs_file}"

exit 1
`,
  );

  writeExecutable(
    join(binDir, "node"),
    `#!/usr/bin/env bash
set -euo pipefail

fixture_dir="\${TEST_FIXTURE_DIR:?}"
rush_file="\${fixture_dir}/rush-affected.tsv"

if [[ "\${1:-}" != "common/scripts/install-run-rush.js" ]]; then
  exec "${process.execPath}" "$@"
fi
shift

if [[ "\${1:-}" != "list" || "\${2:-}" != "--json" || "\${3:-}" != "--from" ]]; then
  echo "Unsupported Rush command shape" >&2
  exit 2
fi

base_sha="\${4#git:}"
projects_csv=""

while IFS=$'\\t' read -r candidate_sha candidate_projects; do
  if [[ "\${candidate_sha}" == "\${base_sha}" ]]; then
    projects_csv="\${candidate_projects}"
    break
  fi
done < "\${rush_file}"

printf '{"projects":['
if [[ -n "\${projects_csv}" ]]; then
  IFS=',' read -r -a projects <<< "\${projects_csv}"
  for index in "\${!projects[@]}"; do
    if [[ "\${index}" -gt 0 ]]; then
      printf ','
    fi
    printf '{"name":"%s"}' "\${projects[\${index}]}"
  done
fi
printf ']}\\n'
`,
  );

  return {
    binDir,
    ciPlanFile,
    cleanup() {
      rmSync(fixtureDir, { force: true, recursive: true });
    },
    fixtureDir,
  };
}

function runComputeCiPlan(
  env,
  {
    gitRefs,
    rushAffectedProjectsBySha,
  } = {},
) {
  const fixture = setupFixture({
    gitRefs,
    rushAffectedProjectsBySha,
  });

  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
      CI_PLAN_PATH: fixture.ciPlanFile,
      PATH: `${fixture.binDir}:${process.env.PATH}`,
      TEST_FIXTURE_DIR: fixture.fixtureDir,
    },
  });

  const ciPlanContents = readFileSync(fixture.ciPlanFile, "utf8");
  fixture.cleanup();

  return {
    ...result,
    ciPlan: JSON.parse(ciPlanContents),
  };
}

test("compute-ci-plan writes the canonical plan file and prints the same JSON", () => {
  const result = runComputeCiPlan(
    {
      DEPLOY_TAG_PREFIX: "deploy/prod",
      FORCE_TARGETS_JSON: "[]",
      GITHUB_EVENT_NAME: "pull_request",
      PR_BASE_SHA: "pr-base",
    },
    {
      gitRefs: {
        "pr-base": "pr-base-sha",
      },
      rushAffectedProjectsBySha: {
        "pr-base-sha": ["api-contract", "server"],
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const expectedPlan = {
    mode: "pull_request",
    pr_base_sha: "pr-base-sha",
    affected_projects_by_deploy_target: {
      server: ["api-contract", "server"],
      webapp: [],
    },
    validate_targets: ["api-contract", "server"],
    deploy_targets: [],
  };

  assert.deepEqual(result.ciPlan, expectedPlan);
  assert.deepEqual(JSON.parse(result.stdout), expectedPlan);
});
