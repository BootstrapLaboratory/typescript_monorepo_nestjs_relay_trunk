import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRushBuildSteps,
  buildRushTargetArgs,
  buildRushValidationSteps,
} from "../src/stages/build-stage/rush-build-plan.ts";
import type { CiPlan } from "../src/model/ci-plan.ts";

const ciPlan = {
  affected_projects_by_deploy_target: {
    server: ["server"],
    webapp: ["webapp"],
  },
  deploy_targets: ["server", "webapp"],
  mode: "release",
  pr_base_sha: "",
  validate_targets: ["api-contract", "server"],
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

test("builds Rush validation steps from validate targets", () => {
  assert.deepStrictEqual(buildRushValidationSteps(ciPlan), [
    {
      args: [
        "common/scripts/install-run-rush.js",
        "verify",
        "--to",
        "api-contract",
        "--to",
        "server",
      ],
      command: "node",
    },
    {
      args: [
        "common/scripts/install-run-rush.js",
        "lint",
        "--to",
        "api-contract",
        "--to",
        "server",
      ],
      command: "node",
    },
    {
      args: [
        "common/scripts/install-run-rush.js",
        "test",
        "--to",
        "api-contract",
        "--to",
        "server",
      ],
      command: "node",
    },
    {
      args: [
        "common/scripts/install-run-rush.js",
        "build",
        "--to",
        "api-contract",
        "--to",
        "server",
      ],
      command: "node",
    },
  ]);
});

test("keeps empty validate targets as a no-op", () => {
  assert.deepStrictEqual(
    buildRushValidationSteps({
      ...ciPlan,
      validate_targets: [],
    }),
    [],
  );
});

test("keeps validation planning separate from deploy targets", () => {
  assert.deepStrictEqual(
    buildRushValidationSteps({
      ...ciPlan,
      deploy_targets: ["webapp"],
      validate_targets: ["server"],
    }),
    [
      {
        args: [
          "common/scripts/install-run-rush.js",
          "verify",
          "--to",
          "server",
        ],
        command: "node",
      },
      {
        args: ["common/scripts/install-run-rush.js", "lint", "--to", "server"],
        command: "node",
      },
      {
        args: ["common/scripts/install-run-rush.js", "test", "--to", "server"],
        command: "node",
      },
      {
        args: ["common/scripts/install-run-rush.js", "build", "--to", "server"],
        command: "node",
      },
    ],
  );
});
