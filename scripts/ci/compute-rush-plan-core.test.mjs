import * as assert from "node:assert/strict";
import { test } from "node:test";
import { computeRushPlan } from "./compute-rush-plan-core.mjs";

function createGitResolver({ commits = {}, headSha = "head-sha" } = {}) {
  return {
    hasGitCommit(ref) {
      return ref === "HEAD" || ref in commits;
    },
    resolveCommitSha(ref) {
      if (ref === "HEAD") {
        return headSha;
      }

      if (!(ref in commits)) {
        throw new Error(`Unknown git ref "${ref}".`);
      }

      return commits[ref];
    },
  };
}

test("computeRushPlan keeps PR validation scope equal to all affected Rush projects", () => {
  const { hasGitCommit, resolveCommitSha } = createGitResolver({
    commits: {
      "pr-base": "pr-base-sha",
    },
  });
  const plan = computeRushPlan({
    deployTargets: [{ name: "server" }, { name: "webapp" }],
    eventName: "pull_request",
    forceTargetsJson: "[]",
    hasGitCommit,
    prBaseSha: "pr-base",
    resolveCommitSha,
    rushAffectedProjects(baseSha) {
      assert.equal(baseSha, "pr-base-sha");
      return ["api-contract", "server"].sort();
    },
  });

  assert.deepEqual(plan, {
    affectedProjectsByDeployTarget: {
      server: ["api-contract", "server"],
      webapp: [],
    },
    anyScope: true,
    deployTargets: [],
    mode: "pull_request",
    prBaseSha: "pr-base-sha",
    validateTargets: ["api-contract", "server"],
  });
});

test("computeRushPlan keeps release deploy scope separate from validation scope", () => {
  const { hasGitCommit, resolveCommitSha } = createGitResolver({
    commits: {
      "deploy/prod/server": "server-base-sha",
      "deploy/prod/webapp": "webapp-base-sha",
    },
    headSha: "head-sha",
  });
  const plan = computeRushPlan({
    deployTargets: [{ name: "server" }, { name: "webapp" }],
    deployTagPrefix: "deploy/prod",
    eventName: "push",
    forceTargetsJson: "[]",
    hasGitCommit,
    resolveCommitSha,
    rushAffectedProjects(baseSha) {
      if (baseSha === "server-base-sha") {
        return ["api-contract", "server"];
      }

      if (baseSha === "webapp-base-sha") {
        return [];
      }

      throw new Error(`Unexpected base SHA "${baseSha}".`);
    },
  });

  assert.deepEqual(plan, {
    affectedProjectsByDeployTarget: {
      server: ["api-contract", "server"],
      webapp: [],
    },
    anyScope: true,
    deployTargets: ["server"],
    mode: "release",
    prBaseSha: "",
    validateTargets: [],
  });
});

test("computeRushPlan validates forced targets against loaded deploy target metadata", () => {
  assert.throws(
    () =>
      computeRushPlan({
        deployTargets: [{ name: "server" }],
        eventName: "workflow_call",
        forceTargetsJson: JSON.stringify(["docs"]),
        hasGitCommit() {
          return true;
        },
        resolveCommitSha() {
          return "head-sha";
        },
        rushAffectedProjects() {
          return [];
        },
      }),
    /Unsupported forced target "docs"\./,
  );
});
