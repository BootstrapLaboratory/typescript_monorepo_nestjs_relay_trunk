import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, it } from "node:test";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("scenario CLI", () => {
  it("runs the demo scenario non-interactively without printing secrets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scenario-cli-"));
    const statePath = join(directory, "state.json");

    try {
      const { stdout } = await execFileAsync(
        process.execPath,
        [
          join(projectRoot, "src/cli.mjs"),
          "demo",
          "--state",
          statePath,
          "--var",
          "ADMIN_TOKEN=secret-token",
          "--var",
          "PROJECT_ID=demo",
          "--var",
          "REGION=europe-west4",
        ],
        {
          cwd: projectRoot,
        },
      );

      assert.match(stdout, /Scenario complete/);
      assert.match(
        stdout,
        /SERVICE_URL=https:\/\/demo-123\.europe-west4\.example\.test/,
      );
      assert.doesNotMatch(stdout, /secret-token/);
      assert.doesNotMatch(stdout, /ADMIN_TOKEN/);

      const state = await readFile(statePath, "utf8");
      assert.doesNotMatch(state, /secret-token/);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
