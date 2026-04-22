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
const SCRIPT_PATH = resolve(import.meta.dirname, "compute-rush-plan.mjs");

function writeExecutable(path, contents) {
  writeFileSync(path, contents, "utf8");
  chmodSync(path, 0o755);
}

function parseSimpleOutputFile(contents) {
  const outputs = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    outputs[key] = value;
  }

  return outputs;
}

function setupFixture({
  gitRefs = {},
  rushAffectedProjectsBySha = {},
}) {
  const fixtureDir = mkdtempSync(join(tmpdir(), "compute-rush-plan-"));
  const binDir = join(fixtureDir, "bin");
  const gitRefsFile = join(fixtureDir, "git-refs.tsv");
  const rushAffectedProjectsFile = join(fixtureDir, "rush-affected.tsv");
  const githubOutputFile = join(fixtureDir, "github-output.txt");

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
  writeFileSync(githubOutputFile, "", "utf8");

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
  echo "Unsupported node entrypoint: \${1:-}" >&2
  exit 2
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
    cleanup() {
      rmSync(fixtureDir, { force: true, recursive: true });
    },
    fixtureDir,
    githubOutputFile,
  };
}

function runComputeRushPlan(
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
      GITHUB_OUTPUT: fixture.githubOutputFile,
      PATH: `${fixture.binDir}:${process.env.PATH}`,
      TEST_FIXTURE_DIR: fixture.fixtureDir,
    },
  });

  const outputFileContents = readFileSync(fixture.githubOutputFile, "utf8");
  fixture.cleanup();

  return {
    ...result,
    outputs: parseSimpleOutputFile(outputFileContents),
  };
}

test("pull request mode reports affected deploy targets from the current hardcoded mapping", () => {
  const result = runComputeRushPlan(
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
        "pr-base-sha": ["webapp", "api-contract", "server"],
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.outputs, {
    affected_projects_by_deploy_target_json: JSON.stringify({
      server: ["api-contract", "server", "webapp"],
      webapp: ["api-contract", "server", "webapp"],
    }),
    any_scope: "true",
    deploy_targets_json: "[]",
    mode: "pull_request",
    pr_base_sha: "pr-base-sha",
    validate_targets_json: JSON.stringify(["api-contract", "server", "webapp"]),
  });
});

test("pull request mode keeps validation in scope for affected non-deploy Rush projects", () => {
  const result = runComputeRushPlan(
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
        "pr-base-sha": ["api-contract"],
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.outputs, {
    affected_projects_by_deploy_target_json: JSON.stringify({
      server: [],
      webapp: [],
    }),
    any_scope: "true",
    deploy_targets_json: "[]",
    mode: "pull_request",
    pr_base_sha: "pr-base-sha",
    validate_targets_json: JSON.stringify(["api-contract"]),
  });
});

test("release mode compares deploy tags and keeps the current target-specific semantics", () => {
  const result = runComputeRushPlan(
    {
      DEPLOY_TAG_PREFIX: "deploy/prod",
      FORCE_TARGETS_JSON: "[]",
      GITHUB_EVENT_NAME: "push",
    },
    {
      gitRefs: {
        HEAD: "head-sha",
        "deploy/prod/server": "server-base-sha",
        "deploy/prod/webapp": "webapp-base-sha",
      },
      rushAffectedProjectsBySha: {
        "server-base-sha": ["api-contract", "server"],
        "webapp-base-sha": [],
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.outputs, {
    affected_projects_by_deploy_target_json: JSON.stringify({
      server: ["api-contract", "server"],
      webapp: [],
    }),
    any_scope: "true",
    deploy_targets_json: JSON.stringify(["server"]),
    mode: "release",
    pr_base_sha: "",
    validate_targets_json: "[]",
  });
});

test("workflow_call forced target selection keeps current single-target deploy behavior", () => {
  const result = runComputeRushPlan(
    {
      DEPLOY_TAG_PREFIX: "deploy/prod",
      FORCE_TARGETS_JSON: JSON.stringify(["webapp"]),
      GITHUB_EVENT_NAME: "workflow_call",
    },
    {
      gitRefs: {
        HEAD: "head-sha",
        "deploy/prod/webapp": "webapp-base-sha",
      },
      rushAffectedProjectsBySha: {
        "head-sha": [],
        "webapp-base-sha": [],
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.outputs, {
    affected_projects_by_deploy_target_json: JSON.stringify({
      server: [],
      webapp: [],
    }),
    any_scope: "true",
    deploy_targets_json: JSON.stringify(["webapp"]),
    mode: "release",
    pr_base_sha: "",
    validate_targets_json: "[]",
  });
});

test("forced target validation rejects unsupported target names", () => {
  const result = runComputeRushPlan({
    DEPLOY_TAG_PREFIX: "deploy/prod",
    FORCE_TARGETS_JSON: JSON.stringify(["docs"]),
    GITHUB_EVENT_NAME: "workflow_call",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported forced target "docs"\./);
});
