import * as assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { validationTargetsDirectory } from "../src/validate/metadata-paths.ts";
import { parseValidationTarget } from "../src/validate/parse-validation-target.ts";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDirectory, "../..");
const realValidationTargetsDirectory = path.join(
  repoRoot,
  validationTargetsDirectory,
);

test("loads every committed validation target metadata file", async () => {
  const entries = await readdir(realValidationTargetsDirectory);
  const targetFiles = entries
    .filter((entry) => entry.endsWith(".yaml"))
    .sort();

  assert.ok(
    targetFiles.length > 0,
    "expected at least one validation target metadata file",
  );

  await Promise.all(
    targetFiles.map(async (targetFile) => {
      const target = path.basename(targetFile, ".yaml");
      const definition = parseValidationTarget(
        await readFile(
          path.join(realValidationTargetsDirectory, targetFile),
          "utf8",
        ),
      );

      assert.equal(
        definition.name,
        target,
        `validation target definition "${target}" must declare a matching name`,
      );
    }),
  );
});
