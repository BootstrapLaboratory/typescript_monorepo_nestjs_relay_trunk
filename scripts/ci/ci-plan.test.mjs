import * as assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  deriveCiPlanOutputs,
  readCiPlanFile,
  validateCiPlan,
  writeCiPlanFile,
} from "./ci-plan.mjs";

test("writeCiPlanFile persists the canonical handoff schema", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "ci-plan-"));
  const ciPlanPath = join(tempDir, "ci-plan.json");

  try {
    const ciPlan = writeCiPlanFile(
      {
        mode: "pull_request",
        prBaseSha: "base-sha",
        affectedProjectsByDeployTarget: {
          server: ["api-contract", "server"],
          webapp: [],
        },
        validateTargets: ["api-contract", "server"],
        deployTargets: [],
      },
      ciPlanPath,
    );

    assert.deepEqual(ciPlan, {
      mode: "pull_request",
      pr_base_sha: "base-sha",
      affected_projects_by_deploy_target: {
        server: ["api-contract", "server"],
        webapp: [],
      },
      validate_targets: ["api-contract", "server"],
      deploy_targets: [],
    });
    assert.deepEqual(readCiPlanFile(ciPlanPath), ciPlan);
    assert.match(readFileSync(ciPlanPath, "utf8"), /"deploy_targets": \[\]/);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});

test("deriveCiPlanOutputs computes scheduling flags and convenience outputs from ci-plan.json", () => {
  const outputs = deriveCiPlanOutputs({
    mode: "release",
    pr_base_sha: "",
    affected_projects_by_deploy_target: {
      server: ["server"],
      webapp: [],
    },
    validate_targets: [],
    deploy_targets: ["server"],
  });

  assert.deepEqual(outputs, {
    mode: "release",
    pr_base_sha: "",
    affected_projects_by_deploy_target_json: JSON.stringify({
      server: ["server"],
      webapp: [],
    }),
    validate_targets_json: "[]",
    deploy_targets_json: JSON.stringify(["server"]),
    has_validate_scope: "false",
    has_deploy_scope: "true",
    any_scope: "true",
  });
});

test("validateCiPlan rejects malformed canonical handoff files", () => {
  assert.throws(
    () =>
      validateCiPlan({
        mode: "pull_request",
        pr_base_sha: "",
        affected_projects_by_deploy_target: [],
        validate_targets: [],
        deploy_targets: [],
      }),
    /affected_projects_by_deploy_target/,
  );
});
