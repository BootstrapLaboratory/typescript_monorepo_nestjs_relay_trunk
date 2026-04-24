import * as assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { servicesMeshPath } from "../src/deploy/metadata-paths.ts";
import { packageTargetDefinitionPath } from "../src/package-stage/metadata-paths.ts";
import { parsePackageTarget } from "../src/package-stage/parse-package-target.ts";
import { parseServicesMesh } from "../src/planning/parse-services-mesh.ts";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDirectory, "../..");
const realServicesMeshPath = path.join(repoRoot, servicesMeshPath);

async function readRealServicesMesh() {
  return parseServicesMesh(await readFile(realServicesMeshPath, "utf8"));
}

test("every real services mesh target has matching package metadata", async () => {
  const mesh = await readRealServicesMesh();

  await Promise.all(
    Object.keys(mesh.services).map(async (target) => {
      const definition = parsePackageTarget(
        await readFile(
          path.join(repoRoot, packageTargetDefinitionPath(target)),
          "utf8",
        ),
      );

      assert.equal(
        definition.name,
        target,
        `package target definition "${target}" must declare a matching name`,
      );
    }),
  );
});
