import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, it } from "node:test";

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("production scenario CLI", () => {
  it("lists the Cloud Run + Cloudflare + Neon + Upstash command", async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      [join(projectRoot, "src/cli.mjs"), "--help"],
      {
        cwd: projectRoot,
      },
    );

    assert.match(stdout, /cloudrun-cloudflare-neon-upstash/);
    assert.doesNotMatch(stdout, /demo/);
  });
});
