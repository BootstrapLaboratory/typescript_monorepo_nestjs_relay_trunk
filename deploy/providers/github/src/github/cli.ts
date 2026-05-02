import { spawn } from "node:child_process";

import type { GitHubProviderDeps } from "../types.js";

export type GitHubCliRunner = (
  args: string[],
  options?: {
    stdin?: string;
  },
) => Promise<void>;

export function createGitHubCliRepositoryDependency(input: {
  runGh?: GitHubCliRunner;
} = {}): GitHubProviderDeps["repository"] {
  const runGh = input.runGh ?? createGitHubCliRunner();

  return {
    async setSecret(valueInput) {
      await runGh(
        ["secret", "set", valueInput.name, "--repo", valueInput.repository],
        {
          stdin: valueInput.value,
        },
      );
    },
    async setVariable(valueInput) {
      await runGh([
        "variable",
        "set",
        valueInput.name,
        "--repo",
        valueInput.repository,
        "--body",
        valueInput.value,
      ]);
    },
  };
}

export function createGitHubCliRunner(command = "gh"): GitHubCliRunner {
  return async (args, options = {}) => {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });
      child.on("error", (error) => {
        reject(
          new Error(
            [
              "GitHub CLI (gh) is required for repository configuration.",
              `Cause: ${error.message}`,
            ].join(" "),
          ),
        );
      });
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
        const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();

        reject(
          new Error(
            [
              `GitHub CLI command failed with exit code ${code}.`,
              stderr === "" ? undefined : `stderr: ${stderr}`,
              stdout === "" ? undefined : `stdout: ${stdout}`,
            ]
              .filter((line) => line !== undefined)
              .join("\n"),
          ),
        );
      });

      if (options.stdin !== undefined) {
        child.stdin.end(options.stdin);
      } else {
        child.stdin.end();
      }
    });
  };
}
