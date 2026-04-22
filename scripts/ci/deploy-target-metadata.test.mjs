import * as assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadDeployTargetsFromRepo } from "./deploy-target-metadata.mjs";

function createRepoFixture({
  servicesMesh = "services:\n  server:\n    deploy_after: []\n",
  targets = {},
}) {
  const repoRoot = mkdtempSync(join(tmpdir(), "deploy-target-metadata-"));
  const deployRoot = join(repoRoot, ".dagger", "deploy");
  const targetsDir = join(deployRoot, "targets");

  mkdirSync(targetsDir, { recursive: true });
  writeFileSync(join(deployRoot, "services-mesh.yaml"), servicesMesh, "utf8");

  for (const [fileName, contents] of Object.entries(targets)) {
    writeFileSync(join(targetsDir, fileName), contents, "utf8");
  }

  return {
    cleanup() {
      rmSync(repoRoot, { force: true, recursive: true });
    },
    repoRoot,
  };
}

test("loadDeployTargetsFromRepo preserves service mesh order through target metadata names", () => {
  const fixture = createRepoFixture({
    servicesMesh: [
      "services:",
      "  server:",
      "    deploy_after: []",
      "",
      "  webapp:",
      "    deploy_after:",
      "      - server",
      "",
    ].join("\n"),
    targets: {
      "a-webapp.yaml": "name: webapp\n",
      "z-server.yaml": "name: server\n",
    },
  });

  try {
    assert.deepEqual(loadDeployTargetsFromRepo(fixture.repoRoot), [
      { name: "server" },
      { name: "webapp" },
    ]);
  } finally {
    fixture.cleanup();
  }
});

test("loadDeployTargetsFromRepo rejects duplicate target names", () => {
  const fixture = createRepoFixture({
    servicesMesh: [
      "services:",
      "  server:",
      "    deploy_after: []",
      "",
    ].join("\n"),
    targets: {
      "one.yaml": "name: server\n",
      "two.yaml": "name: server\n",
    },
  });

  try {
    assert.throws(
      () => loadDeployTargetsFromRepo(fixture.repoRoot),
      /Duplicate deploy target name "server"/,
    );
  } finally {
    fixture.cleanup();
  }
});
