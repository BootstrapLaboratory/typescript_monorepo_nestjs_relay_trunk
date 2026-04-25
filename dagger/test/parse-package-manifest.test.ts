import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatPackageManifest,
  parsePackageManifest,
  validatePackageManifest,
} from "../src/stages/package-stage/package-manifest.ts";

test("parses package manifest artifacts", () => {
  assert.deepStrictEqual(
    parsePackageManifest(`{
      "artifacts": {
        "server": {
          "kind": "archive",
          "path": "deploy-target-server.tgz",
          "deploy_path": "common/deploy/server"
        },
        "webapp": {
          "kind": "directory",
          "path": "apps/webapp/dist",
          "deploy_path": "apps/webapp/dist"
        }
      }
    }`),
    {
      artifacts: {
        server: {
          deploy_path: "common/deploy/server",
          kind: "archive",
          path: "deploy-target-server.tgz",
        },
        webapp: {
          deploy_path: "apps/webapp/dist",
          kind: "directory",
          path: "apps/webapp/dist",
        },
      },
    },
  );
});

test("fails when deploy_path is absolute", () => {
  assert.throws(
    () =>
      parsePackageManifest(`{
        "artifacts": {
          "server": {
            "kind": "archive",
            "path": "deploy-target-server.tgz",
            "deploy_path": "/workspace/common/deploy/server"
          }
        }
      }`),
    /deploy_path must be relative/,
  );
});

test("fails when artifact kind is unsupported", () => {
  assert.throws(
    () =>
      parsePackageManifest(`{
        "artifacts": {
          "server": {
            "kind": "container",
            "path": "deploy-target-server.tgz",
            "deploy_path": "common/deploy/server"
          }
        }
      }`),
    /kind must be "archive" or "directory"/,
  );
});

test("formats normalized package manifest JSON", () => {
  assert.equal(
    formatPackageManifest({
      artifacts: {
        server: {
          deploy_path: "common/deploy/server",
          kind: "archive",
          path: "deploy-target-server.tgz",
        },
      },
    }),
    `{
  "artifacts": {
    "server": {
      "deploy_path": "common/deploy/server",
      "kind": "archive",
      "path": "deploy-target-server.tgz"
    }
  }
}
`,
  );
});

test("validates package manifest objects", () => {
  assert.deepStrictEqual(
    validatePackageManifest({
      artifacts: {
        webapp: {
          deploy_path: "apps/webapp/dist",
          kind: "directory",
          path: "apps/webapp/dist",
        },
      },
    }),
    {
      artifacts: {
        webapp: {
          deploy_path: "apps/webapp/dist",
          kind: "directory",
          path: "apps/webapp/dist",
        },
      },
    },
  );
});
