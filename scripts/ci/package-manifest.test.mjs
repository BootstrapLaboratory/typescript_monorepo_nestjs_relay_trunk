import * as assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import {
  readPackageManifestFile,
  validatePackageManifest,
  writePackageManifestFile,
} from "./package-manifest.mjs";

test("validates package manifest artifacts", () => {
  assert.deepStrictEqual(
    validatePackageManifest({
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
    }),
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

test("rejects unsupported artifact kinds", () => {
  assert.throws(
    () =>
      validatePackageManifest({
        artifacts: {
          server: {
            deploy_path: "common/deploy/server",
            kind: "container",
            path: "deploy-target-server.tgz",
          },
        },
      }),
    /kind must be "archive" or "directory"/,
  );
});

test("writes and reads package manifest files", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "package-manifest-"));
  const manifestPath = join(tempDir, "package-manifest.json");

  try {
    writePackageManifestFile(
      {
        artifacts: {
          server: {
            deploy_path: "common/deploy/server",
            kind: "archive",
            path: "deploy-target-server.tgz",
          },
        },
      },
      manifestPath,
    );

    assert.deepStrictEqual(readPackageManifestFile(manifestPath), {
      artifacts: {
        server: {
          deploy_path: "common/deploy/server",
          kind: "archive",
          path: "deploy-target-server.tgz",
        },
      },
    });
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});
