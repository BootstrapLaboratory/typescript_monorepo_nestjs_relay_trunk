import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  createCiPlan,
  formatCiPlan,
  parseCiPlan,
} from "../src/ci-plan/parse-ci-plan.ts";

test("parses canonical CI plan handoff", () => {
  assert.deepStrictEqual(
    parseCiPlan(`{
      "mode": "release",
      "pr_base_sha": "",
      "affected_projects_by_deploy_target": {
        "server": ["server"],
        "webapp": ["webapp"]
      },
      "validate_targets": [],
      "deploy_targets": ["server", "webapp"]
    }`),
    {
      affected_projects_by_deploy_target: {
        server: ["server"],
        webapp: ["webapp"],
      },
      deploy_targets: ["server", "webapp"],
      mode: "release",
      pr_base_sha: "",
      validate_targets: [],
    },
  );
});

test("fails when deploy targets are malformed", () => {
  assert.throws(
    () =>
      parseCiPlan(`{
        "mode": "release",
        "pr_base_sha": "",
        "affected_projects_by_deploy_target": {},
        "validate_targets": [],
        "deploy_targets": ["server", 42]
      }`),
    /CI plan field "deploy_targets" must contain only strings\./,
  );
});

test("fails when mode is unsupported", () => {
  assert.throws(
    () =>
      parseCiPlan(`{
        "mode": "manual",
        "pr_base_sha": "",
        "affected_projects_by_deploy_target": {},
        "validate_targets": [],
        "deploy_targets": []
      }`),
    /CI plan field "mode" must be either "pull_request" or "release"\./,
  );
});

test("creates and formats canonical CI plan handoff JSON", () => {
  const ciPlan = createCiPlan({
    affectedProjectsByDeployTarget: {
      server: ["api-contract", "server"],
    },
    deployTargets: ["server"],
    mode: "release",
    prBaseSha: "",
    validateTargets: [],
  });

  assert.deepStrictEqual(JSON.parse(formatCiPlan(ciPlan)), {
    affected_projects_by_deploy_target: {
      server: ["api-contract", "server"],
    },
    deploy_targets: ["server"],
    mode: "release",
    pr_base_sha: "",
    validate_targets: [],
  });
});
