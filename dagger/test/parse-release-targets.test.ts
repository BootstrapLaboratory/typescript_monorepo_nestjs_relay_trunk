import * as assert from "node:assert/strict";
import { test } from "node:test";

import { parseReleaseTargets } from "../src/planning/parse-release-targets.ts";

test("normalizes duplicate release targets while preserving order", () => {
  assert.deepStrictEqual(
    parseReleaseTargets('["server","webapp","server","webapp"]'),
    ["server", "webapp"],
  );
});

test("fails when releaseTargetsJson is not a JSON array", () => {
  assert.throws(
    () => parseReleaseTargets('{"server":true}'),
    /releaseTargetsJson must be a JSON array\./,
  );
});

test("fails when releaseTargetsJson contains an empty target name", () => {
  assert.throws(
    () => parseReleaseTargets('["server",""]'),
    /releaseTargetsJson entries must be non-empty strings\./,
  );
});

test("fails when releaseTargetsJson contains a non-string target", () => {
  assert.throws(
    () => parseReleaseTargets('["server",1]'),
    /releaseTargetsJson entries must be non-empty strings\./,
  );
});
