import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { runShell, ShellCommandError } from "../src/shell/run-shell.mjs";

describe("shell runner", () => {
  it("passes environment values and redacts selected variables from output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scenario-shell-"));
    const scriptPath = join(directory, "print-env.sh");
    const streamedStdout = createWritableCollector();
    const streamedStderr = createWritableCollector();

    try {
      await writeFile(
        scriptPath,
        [
          "echo safe=$SAFE_VALUE",
          "echo secret=$SECRET_VALUE",
          "echo err-secret=$SECRET_VALUE >&2",
        ].join("\n"),
      );

      const result = await runShell("bash", {
        args: [scriptPath],
        env: {
          SAFE_VALUE: "visible",
          SECRET_VALUE: "top-secret",
        },
        redact: ["SECRET_VALUE"],
        stderr: streamedStderr,
        stdout: streamedStdout,
      });

      assert.match(result.stdout, /safe=visible/);
      assert.match(result.stdout, /secret=\[redacted:SECRET_VALUE\]/);
      assert.match(result.stderr, /err-secret=\[redacted:SECRET_VALUE\]/);
      assert.doesNotMatch(result.stdout, /top-secret/);
      assert.doesNotMatch(result.stderr, /top-secret/);
      assert.doesNotMatch(streamedStdout.value, /top-secret/);
      assert.doesNotMatch(streamedStderr.value, /top-secret/);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("redacts command arguments and stderr on failures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scenario-shell-"));
    const scriptPath = join(directory, "fail.sh");

    try {
      await writeFile(
        scriptPath,
        [
          "echo failed with $SECRET_VALUE >&2",
          "echo arg=$1 >&2",
          "exit 7",
        ].join("\n"),
      );

      await assert.rejects(
        runShell("bash", {
          args: [scriptPath, "top-secret"],
          env: {
            SECRET_VALUE: "top-secret",
          },
          redact: ["SECRET_VALUE"],
        }),
        (error) => {
          assert.ok(error instanceof ShellCommandError);
          assert.equal(error.exitCode, 7);
          assert.match(error.stderr, /failed with \[redacted:SECRET_VALUE\]/);
          assert.match(error.stderr, /arg=\[redacted:SECRET_VALUE\]/);
          assert.deepEqual(error.args, [
            scriptPath,
            "[redacted:SECRET_VALUE]",
          ]);
          assert.doesNotMatch(error.message, /top-secret/);
          assert.doesNotMatch(error.stderr, /top-secret/);
          return true;
        },
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

function createWritableCollector() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });

  Object.defineProperty(stream, "value", {
    get() {
      return chunks.join("");
    },
  });

  return stream;
}
