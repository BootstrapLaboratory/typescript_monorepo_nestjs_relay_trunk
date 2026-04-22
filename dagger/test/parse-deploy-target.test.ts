import * as assert from "node:assert/strict";
import { test } from "node:test";

import { parseDeployTarget } from "../src/deploy/parse-deploy-target.ts";

test("parses deploy target runtime metadata", () => {
  const definition = parseDeployTarget(`
name: webapp
deploy_script: scripts/ci/deploy-webapp.sh
artifact_path: /workspace/apps/webapp/dist

runtime:
  image: node:24-bookworm-slim
  pass_env:
    - WEBAPP_URL
    - WEBAPP_VITE_GRAPHQL_HTTP
    - WEBAPP_VITE_GRAPHQL_HTTP
  env:
    STATIC_ENV: always
`);

  assert.deepStrictEqual(definition, {
    artifact_path: "/workspace/apps/webapp/dist",
    deploy_script: "scripts/ci/deploy-webapp.sh",
    name: "webapp",
    runtime: {
      dry_run_defaults: {},
      env: {
        STATIC_ENV: "always",
      },
      file_mounts: [],
      image: "node:24-bookworm-slim",
      install: [],
      pass_env: ["WEBAPP_URL", "WEBAPP_VITE_GRAPHQL_HTTP"],
      required_host_env: [],
    },
  });
});

test("preserves ordered duplicate install commands", () => {
  const definition = parseDeployTarget(`
name: server
deploy_script: scripts/ci/deploy-server.sh
artifact_path: /workspace/common/deploy/server

runtime:
  image: node:24-bookworm-slim
  install:
    - apt-get update
    - echo added repo
    - apt-get update
`);

  assert.deepStrictEqual(definition.runtime.install, [
    "apt-get update",
    "echo added repo",
    "apt-get update",
  ]);
});

test("fails when target runtime image is missing", () => {
  assert.throws(
    () =>
      parseDeployTarget(`
name: webapp
deploy_script: scripts/ci/deploy-webapp.sh
artifact_path: /workspace/apps/webapp/dist

runtime: {}
`),
    /Deploy target runtime image must be a non-empty string\./,
  );
});

test("fails when file mount source_var is invalid", () => {
  assert.throws(
    () =>
      parseDeployTarget(`
name: server
deploy_script: scripts/ci/deploy-server.sh
artifact_path: /workspace/common/deploy/server

runtime:
  image: node:24-bookworm-slim
  file_mounts:
    - source_var: not-valid
      target: /tmp/gcp-credentials.json
`),
    /file mount source_var "not-valid" must match/,
  );
});
