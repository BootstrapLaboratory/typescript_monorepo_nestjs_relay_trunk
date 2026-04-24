import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRushBuildSteps,
  buildRushTargetArgs,
} from "../src/build-stage/rush-build-plan.ts";
import type { CiPlan } from "../src/model/ci-plan.ts";

const ciPlan = {
  affected_projects_by_deploy_target: {
    server: ["server"],
    webapp: ["webapp"],
  },
  deploy_targets: ["server", "webapp"],
  mode: "release",
  pr_base_sha: "",
  validate_targets: [],
} satisfies CiPlan;

test("builds Rush target args from deploy targets", () => {
  assert.deepStrictEqual(buildRushTargetArgs(ciPlan), [
    "--to",
    "server",
    "--to",
    "webapp",
  ]);
});

test("builds Rush verify lint test build steps", () => {
  assert.deepStrictEqual(buildRushBuildSteps(ciPlan), [
    {
      args: [
        "common/scripts/install-run-rush.js",
        "verify",
        "--to",
        "server",
        "--to",
        "webapp",
      ],
      command: "node",
    },
    {
      args: [
        "common/scripts/install-run-rush.js",
        "lint",
        "--to",
        "server",
        "--to",
        "webapp",
      ],
      command: "node",
    },
    {
      args: [
        "common/scripts/install-run-rush.js",
        "test",
        "--to",
        "server",
        "--to",
        "webapp",
      ],
      command: "node",
    },
    {
      args: [
        "common/scripts/install-run-rush.js",
        "build",
        "--to",
        "server",
        "--to",
        "webapp",
      ],
      command: "node",
    },
  ]);
});

test("fails when no deploy targets were selected", () => {
  assert.throws(
    () =>
      buildRushTargetArgs({
        ...ciPlan,
        deploy_targets: [],
      }),
    /No Rush deploy targets were selected\./,
  );
});
