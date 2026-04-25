import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  createManualValidationCiPlan,
  createValidationSummary,
  formatValidationSummary,
  parseValidateTargetsJson,
  shouldUseManualValidationTargets,
} from "../src/stages/validate/validation-result.ts";
import type { CiPlan } from "../src/model/ci-plan.ts";

const ciPlan = {
  affected_projects_by_deploy_target: {},
  deploy_targets: [],
  mode: "pull_request",
  pr_base_sha: "base-sha",
  validate_targets: ["api-contract", "server"],
} satisfies CiPlan;

test("parses validate target overrides as Rush project names", () => {
  assert.deepEqual(
    parseValidateTargetsJson(JSON.stringify(["server", "server", "webapp"])),
    ["server", "webapp"],
  );
});

test("rejects malformed validate target overrides", () => {
  assert.throws(
    () => parseValidateTargetsJson("["),
    /validateTargetsJson must be valid JSON\./,
  );
  assert.throws(
    () => parseValidateTargetsJson(JSON.stringify({ target: "server" })),
    /validateTargetsJson must be a JSON array\./,
  );
  assert.throws(
    () => parseValidateTargetsJson(JSON.stringify(["server", ""])),
    /validateTargetsJson entries must be non-empty strings\./,
  );
});

test("creates a manual validation plan from override targets", () => {
  assert.deepEqual(
    createManualValidationCiPlan("workflow_dispatch", "", ["server"]),
    {
      affected_projects_by_deploy_target: {},
      deploy_targets: [],
      mode: "release",
      pr_base_sha: "",
      validate_targets: ["server"],
    },
  );
});

test("uses manual validation targets for non-PR calls even when empty", () => {
  assert.equal(shouldUseManualValidationTargets("workflow_dispatch", []), true);
  assert.equal(shouldUseManualValidationTargets("push", []), true);
  assert.equal(shouldUseManualValidationTargets("pull_request", []), false);
  assert.equal(
    shouldUseManualValidationTargets("pull_request", ["server"]),
    true,
  );
});

test("summarizes selected validation targets", () => {
  assert.deepEqual(createValidationSummary(ciPlan), {
    mode: "pull_request",
    pr_base_sha: "base-sha",
    rush_commands: ["verify", "lint", "test", "build"],
    status: "passed",
    validate_targets: ["api-contract", "server"],
  });
});

test("summarizes empty validation targets as skipped", () => {
  assert.deepEqual(
    createValidationSummary({
      ...ciPlan,
      validate_targets: [],
    }),
    {
      mode: "pull_request",
      pr_base_sha: "base-sha",
      rush_commands: [],
      status: "skipped",
      validate_targets: [],
    },
  );
});

test("formats validation summary JSON", () => {
  assert.equal(
    formatValidationSummary({
      mode: "pull_request",
      pr_base_sha: "base-sha",
      rush_commands: [],
      status: "skipped",
      validate_targets: [],
    }),
    [
      "{",
      '  "mode": "pull_request",',
      '  "pr_base_sha": "base-sha",',
      '  "rush_commands": [],',
      '  "status": "skipped",',
      '  "validate_targets": []',
      "}",
      "",
    ].join("\n"),
  );
});
