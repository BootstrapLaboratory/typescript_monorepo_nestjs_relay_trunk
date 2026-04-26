import * as assert from "node:assert/strict";
import { test } from "node:test";

import { parseDeployTarget } from "../src/stages/deploy/parse-deploy-target.ts";

test("parses deploy target runtime metadata", () => {
  const definition = parseDeployTarget(`
name: webapp
deploy_script: deploy/cloudflare-pages/scripts/deploy-webapp.sh

runtime:
  image: node:24-bookworm-slim
  pass_env:
    - WEBAPP_URL
    - WEBAPP_VITE_GRAPHQL_HTTP
    - WEBAPP_VITE_GRAPHQL_HTTP
  env:
    STATIC_ENV: always
  workspace:
    dirs:
      - apps/webapp/dist
      - ./deploy/cloudflare-pages/scripts/
      - apps/webapp/dist
    files:
      - apps/webapp/package.json
`);

  assert.deepStrictEqual(definition, {
    deploy_script: "deploy/cloudflare-pages/scripts/deploy-webapp.sh",
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
      workspace: {
        dirs: ["apps/webapp/dist", "deploy/cloudflare-pages/scripts"],
        files: ["apps/webapp/package.json"],
      },
    },
  });
});

test("preserves ordered duplicate install commands", () => {
  const definition = parseDeployTarget(`
name: server
deploy_script: deploy/cloudrun/scripts/deploy-server.sh

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
deploy_script: deploy/cloudflare-pages/scripts/deploy-webapp.sh

runtime: {}
`),
    /Deploy target runtime image must be a non-empty string\./,
  );
});

test("parses full runtime workspace mode", () => {
  const definition = parseDeployTarget(`
name: server
deploy_script: deploy/cloudrun/scripts/deploy-server.sh

runtime:
  image: node:24-bookworm-slim
  workspace:
    mode: full
`);

  assert.deepStrictEqual(definition.runtime.workspace, {
    dirs: [],
    files: [],
    mode: "full",
  });
});

test("fails when runtime workspace mode is unsupported", () => {
  assert.throws(
    () =>
      parseDeployTarget(`
name: server
deploy_script: deploy/cloudrun/scripts/deploy-server.sh

runtime:
  image: node:24-bookworm-slim
  workspace:
    mode: minimal
`),
    /Deploy target runtime workspace mode must be "full"\./,
  );
});

test("fails when runtime workspace path escapes the repository", () => {
  assert.throws(
    () =>
      parseDeployTarget(`
name: server
deploy_script: deploy/cloudrun/scripts/deploy-server.sh

runtime:
  image: node:24-bookworm-slim
  workspace:
    dirs:
      - ../server
`),
    /Deploy target runtime workspace dirs entry must stay inside the repository\./,
  );
});

test("fails when file mount source_var is invalid", () => {
  assert.throws(
    () =>
      parseDeployTarget(`
name: server
deploy_script: deploy/cloudrun/scripts/deploy-server.sh

runtime:
  image: node:24-bookworm-slim
  file_mounts:
    - source_var: not-valid
      target: /tmp/gcp-credentials.json
`),
    /file mount source_var "not-valid" must match/,
  );
});
