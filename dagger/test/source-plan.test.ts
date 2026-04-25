import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSourcePlan,
  deployTagFetchRefspec,
  parseSourceMode,
} from "../src/source/source-plan.ts";

const commitSha = "0123456789abcdef0123456789abcdef01234567";
const prBaseSha = "89abcdef0123456789abcdef0123456789abcdef";

test("defaults to local copy source mode", () => {
  assert.deepStrictEqual(buildSourcePlan(), {
    cleanupPaths: ["common/temp", ".dagger/runtime"],
    mode: "local_copy",
    sourcePath: "/workspace",
    workdir: "/rush-delivery/source",
  });
});

test("builds a local copy source plan with explicit cleanup paths", () => {
  assert.deepStrictEqual(
    buildSourcePlan({
      cleanupPaths: ["common/temp", ".dagger/runtime", "common/deploy"],
      localSourcePath: "/mounted/repo",
      mode: "local_copy",
      workdir: "/copied/repo",
    }),
    {
      cleanupPaths: ["common/temp", ".dagger/runtime", "common/deploy"],
      mode: "local_copy",
      sourcePath: "/mounted/repo",
      workdir: "/copied/repo",
    },
  );
});

test("builds a Git source command plan", () => {
  assert.deepStrictEqual(
    buildSourcePlan({
      authTokenEnv: "GITHUB_TOKEN",
      commitSha,
      deployTagPrefix: "deploy/prod",
      mode: "git",
      prBaseSha,
      ref: "refs/heads/main",
      repositoryUrl: "https://github.com/BeltOrg/beltapp.git",
    }),
    {
      auth: { tokenEnv: "GITHUB_TOKEN" },
      commands: [
        {
          args: [
            "clone",
            "--no-checkout",
            "https://github.com/BeltOrg/beltapp.git",
            "/rush-delivery/source",
          ],
          command: "git",
          name: "clone",
        },
        {
          args: [
            "-C",
            "/rush-delivery/source",
            "fetch",
            "--force",
            "origin",
            "refs/heads/main",
          ],
          command: "git",
          name: "fetch_ref",
        },
        {
          args: [
            "-C",
            "/rush-delivery/source",
            "fetch",
            "--force",
            "origin",
            "+refs/tags/deploy/prod/*:refs/tags/deploy/prod/*",
          ],
          command: "git",
          name: "fetch_deploy_tags",
        },
        {
          args: [
            "-C",
            "/rush-delivery/source",
            "fetch",
            "--force",
            "origin",
            prBaseSha,
          ],
          command: "git",
          name: "fetch_pr_base",
        },
        {
          args: [
            "-C",
            "/rush-delivery/source",
            "checkout",
            "--force",
            commitSha,
          ],
          command: "git",
          name: "checkout",
        },
      ],
      commitSha,
      deployTagPrefix: "deploy/prod",
      mode: "git",
      prBaseSha,
      ref: "refs/heads/main",
      repositoryUrl: "https://github.com/BeltOrg/beltapp.git",
      workdir: "/rush-delivery/source",
    },
  );
});

test("fetches the commit directly when no ref is provided", () => {
  const plan = buildSourcePlan({
    commitSha,
    mode: "git",
    repositoryUrl: "git@github.com:BeltOrg/beltapp.git",
  });

  assert.equal(plan.mode, "git");
  assert.deepStrictEqual(plan.commands[1], {
    args: [
      "-C",
      "/rush-delivery/source",
      "fetch",
      "--force",
      "origin",
      commitSha,
    ],
    command: "git",
    name: "fetch_commit",
  });
});

test("builds deploy tag refspecs", () => {
  assert.equal(
    deployTagFetchRefspec("deploy/prod"),
    "+refs/tags/deploy/prod/*:refs/tags/deploy/prod/*",
  );
});

test("rejects unsupported source modes", () => {
  assert.throws(
    () => parseSourceMode("github"),
    /Unsupported source mode "github"\./,
  );
  assert.throws(
    () => parseSourceMode("mounted_workspace"),
    /Unsupported source mode "mounted_workspace"\./,
  );
});

test("requires Git source repository URL and commit SHA", () => {
  assert.throws(
    () =>
      buildSourcePlan({
        mode: "git",
        repositoryUrl: "https://example.com/repo.git",
      }),
    /Git source commit SHA must be a non-empty string/,
  );
  assert.throws(
    () => buildSourcePlan({ commitSha, mode: "git" }),
    /Git source repository URL must be a non-empty string/,
  );
});

test("rejects unsafe local copy paths", () => {
  assert.throws(
    () =>
      buildSourcePlan({
        cleanupPaths: ["../common/temp"],
        mode: "local_copy",
      }),
    /Local copy cleanup paths\[0\] must stay inside the repository/,
  );
  assert.throws(
    () =>
      buildSourcePlan({
        localSourcePath: "workspace",
        mode: "local_copy",
      }),
    /Local copy source path must be a specific absolute path/,
  );
});

test("rejects short Git SHAs for Git source mode", () => {
  assert.throws(
    () =>
      buildSourcePlan({
        commitSha: "abc123",
        mode: "git",
        repositoryUrl: "https://github.com/BeltOrg/beltapp.git",
      }),
    /Git source commit SHA must be a full 40-character Git SHA/,
  );
});

test("rejects embedded credentials in repository URLs", () => {
  assert.throws(
    () =>
      buildSourcePlan({
        commitSha,
        mode: "git",
        repositoryUrl: "https://token@github.com/BeltOrg/beltapp.git",
      }),
    /must not embed credentials/,
  );
});

test("rejects unsafe refs and token env names", () => {
  assert.throws(
    () =>
      buildSourcePlan({
        commitSha,
        mode: "git",
        ref: "../main",
        repositoryUrl: "https://github.com/BeltOrg/beltapp.git",
      }),
    /Git source ref is not a safe Git ref/,
  );
  assert.throws(
    () =>
      buildSourcePlan({
        authTokenEnv: "github_token",
        commitSha,
        mode: "git",
        repositoryUrl: "https://github.com/BeltOrg/beltapp.git",
      }),
    /Git source auth token env "github_token" must match/,
  );
});
