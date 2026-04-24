import * as assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import {
  buildPackageActions,
  packageDeployTargets,
  parseDeployTargetsJson,
  parsePackageTargetMetadata,
} from "./package-deploy-targets.mjs";

test("parses deploy targets json and removes duplicates", () => {
  assert.deepStrictEqual(parseDeployTargetsJson('["server","webapp","server"]'), [
    "server",
    "webapp",
  ]);
});

test("parses rush deploy archive package metadata", () => {
  assert.deepStrictEqual(
    parsePackageTargetMetadata(
      `
name: server

artifact:
  kind: rush_deploy_archive
  project: server
  scenario: server
  output: common/deploy/server
`,
      ".dagger/package/targets/server.yaml",
    ),
    {
      artifact: {
        kind: "rush_deploy_archive",
        output: "common/deploy/server",
        project: "server",
        scenario: "server",
      },
      name: "server",
    },
  );
});

test("builds commands for a rush deploy archive artifact", () => {
  assert.deepStrictEqual(
    buildPackageActions(
      "server",
      {
        artifact: {
          kind: "rush_deploy_archive",
          output: "common/deploy/server",
          project: "server",
          scenario: "server",
        },
        name: "server",
      },
      "deploy-target",
    ),
    {
      artifact: {
        deploy_path: "common/deploy/server",
        kind: "archive",
        path: "deploy-target-server.tgz",
      },
      commands: [
        {
          args: [
            "common/scripts/install-run-rush.js",
            "deploy",
            "-p",
            "server",
            "-s",
            "server",
            "-t",
            "common/deploy/server",
            "--overwrite",
          ],
          command: "node",
        },
        {
          args: [
            "-czf",
            "deploy-target-server.tgz",
            "-C",
            "common/deploy",
            "server",
          ],
          command: "tar",
        },
      ],
      validations: [],
    },
  );
});

test("builds validations for a directory artifact", () => {
  assert.deepStrictEqual(
    buildPackageActions(
      "webapp",
      {
        artifact: {
          kind: "directory",
          path: "apps/webapp/dist",
        },
        name: "webapp",
      },
      "deploy-target",
    ),
    {
      artifact: {
        deploy_path: "apps/webapp/dist",
        kind: "directory",
        path: "apps/webapp/dist",
      },
      commands: [],
      validations: [
        {
          kind: "directory",
          path: "apps/webapp/dist",
        },
      ],
    },
  );
});

test("rejects metadata with mismatched target name", () => {
  assert.throws(
    () =>
      buildPackageActions(
        "server",
        {
          artifact: {
            kind: "directory",
            path: "apps/server/dist",
          },
          name: "webapp",
        },
        "deploy-target",
      ),
    /must declare name "server", got "webapp"/,
  );
});

test("writes a package manifest for directory artifacts", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "package-deploy-targets-"));
  const manifestPath = join(tempDir, "package-manifest.json");
  const validatedPaths = [];

  try {
    const manifest = await packageDeployTargets({
      deployTargetsJson: '["webapp"]',
      loadPackageTargetDefinition: async (target) => ({
        artifact: {
          kind: "directory",
          path: `dist/${target}`,
        },
        name: target,
      }),
      packageManifestPath: manifestPath,
      validatePackageDirectory: async (relativePath) => {
        validatedPaths.push(relativePath);
      },
    });

    assert.deepStrictEqual(manifest, {
      artifacts: {
        webapp: {
          deploy_path: "dist/webapp",
          kind: "directory",
          path: "dist/webapp",
        },
      },
    });
    assert.deepStrictEqual(validatedPaths, ["dist/webapp"]);
    assert.deepStrictEqual(JSON.parse(await readFile(manifestPath, "utf8")), {
      artifacts: {
        webapp: {
          deploy_path: "dist/webapp",
          kind: "directory",
          path: "dist/webapp",
        },
      },
    });
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
});
