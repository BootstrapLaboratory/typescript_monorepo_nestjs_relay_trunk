import * as assert from "node:assert/strict";
import { test } from "node:test";

import { parsePackageTarget } from "../src/stages/package-stage/parse-package-target.ts";

test("parses directory package artifact metadata", () => {
  const definition = parsePackageTarget(`
name: webapp

artifact:
  kind: directory
  path: apps/webapp/dist
`);

  assert.deepStrictEqual(definition, {
    artifact: {
      kind: "directory",
      path: "apps/webapp/dist",
    },
    name: "webapp",
  });
});

test("parses Rush deploy archive package artifact metadata", () => {
  const definition = parsePackageTarget(`
name: server

artifact:
  kind: rush_deploy_archive
  project: server
  scenario: server
  output: common/deploy/server
`);

  assert.deepStrictEqual(definition, {
    artifact: {
      kind: "rush_deploy_archive",
      output: "common/deploy/server",
      project: "server",
      scenario: "server",
    },
    name: "server",
  });
});

test("fails when artifact kind is unsupported", () => {
  assert.throws(
    () =>
      parsePackageTarget(`
name: webapp

artifact:
  kind: custom
  path: apps/webapp/dist
`),
    /Unsupported package target artifact kind "custom"\./,
  );
});

test("fails when directory artifact path is missing", () => {
  assert.throws(
    () =>
      parsePackageTarget(`
name: webapp

artifact:
  kind: directory
`),
    /Package target artifact path must be a non-empty string\./,
  );
});
