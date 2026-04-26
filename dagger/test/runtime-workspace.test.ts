import * as assert from "node:assert/strict";
import { test } from "node:test";

import { buildRuntimeWorkspacePlan } from "../src/stages/deploy/runtime-workspace.ts";

test("builds a partial runtime workspace plan when mode is omitted", () => {
  assert.deepStrictEqual(
    buildRuntimeWorkspacePlan({
      dirs: ["common/deploy/server", "deploy/cloudrun/scripts"],
      files: ["apps/server/Dockerfile"],
    }),
    {
      dirs: ["common/deploy/server", "deploy/cloudrun/scripts"],
      files: ["apps/server/Dockerfile"],
      mode: "partial",
    },
  );
});

test("builds a full runtime workspace plan when mode is full", () => {
  assert.deepStrictEqual(
    buildRuntimeWorkspacePlan({
      dirs: ["ignored"],
      files: ["ignored.txt"],
      mode: "full",
    }),
    {
      mode: "full",
    },
  );
});
