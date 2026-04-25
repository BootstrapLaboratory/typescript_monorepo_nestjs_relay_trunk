import * as assert from "node:assert/strict";
import { test } from "node:test";

import { computeRushPlan } from "../src/stages/detect/rush-plan.ts";
import type { RushPlanResolver } from "../src/stages/detect/rush-plan.ts";

function createResolver({
  commits = {},
  headSha = "head-sha",
  rushAffectedProjectsBySha = {},
}: {
  commits?: Record<string, string>;
  headSha?: string;
  rushAffectedProjectsBySha?: Record<string, string[]>;
} = {}): RushPlanResolver {
  return {
    async hasGitCommit(ref: string): Promise<boolean> {
      return ref === "HEAD" || ref in commits;
    },

    async resolveCommitSha(ref: string): Promise<string> {
      if (ref === "HEAD") {
        return headSha;
      }

      if (!(ref in commits)) {
        throw new Error(`Unknown git ref "${ref}".`);
      }

      return commits[ref];
    },

    async rushAffectedProjects(baseSha: string): Promise<string[]> {
      return rushAffectedProjectsBySha[baseSha] ?? [];
    },
  };
}

test("keeps PR validation scope equal to all affected Rush projects", async () => {
  const plan = await computeRushPlan({
    deployTargets: [{ name: "server" }, { name: "webapp" }],
    eventName: "pull_request",
    forceTargetsJson: "[]",
    prBaseSha: "pr-base",
    resolver: createResolver({
      commits: {
        "pr-base": "pr-base-sha",
      },
      rushAffectedProjectsBySha: {
        "pr-base-sha": ["api-contract", "server"],
      },
    }),
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

test("keeps release deploy scope separate from validation scope", async () => {
  const plan = await computeRushPlan({
    deployTagPrefix: "deploy/prod",
    deployTargets: [{ name: "server" }, { name: "webapp" }],
    eventName: "push",
    forceTargetsJson: "[]",
    resolver: createResolver({
      commits: {
        "deploy/prod/server": "server-base-sha",
        "deploy/prod/webapp": "webapp-base-sha",
      },
      rushAffectedProjectsBySha: {
        "server-base-sha": ["api-contract", "server"],
        "webapp-base-sha": [],
      },
    }),
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

test("workflow_call forced target selection keeps single-target deploy behavior", async () => {
  const plan = await computeRushPlan({
    deployTagPrefix: "deploy/prod",
    deployTargets: [{ name: "server" }, { name: "webapp" }],
    eventName: "workflow_call",
    forceTargetsJson: JSON.stringify(["webapp"]),
    resolver: createResolver({
      commits: {
        "deploy/prod/webapp": "webapp-base-sha",
      },
      rushAffectedProjectsBySha: {
        "head-sha": [],
        "webapp-base-sha": [],
      },
    }),
  });

  assert.deepEqual(plan, {
    affectedProjectsByDeployTarget: {
      server: [],
      webapp: [],
    },
    anyScope: true,
    deployTargets: ["webapp"],
    mode: "release",
    prBaseSha: "",
    validateTargets: [],
  });
});

test("manual forced target selection deploys the requested target", async () => {
  const plan = await computeRushPlan({
    deployTagPrefix: "deploy/prod",
    deployTargets: [{ name: "server" }, { name: "webapp" }],
    eventName: "workflow_dispatch",
    forceTargetsJson: JSON.stringify(["server"]),
    resolver: createResolver({
      commits: {
        "deploy/prod/server": "server-base-sha",
        "deploy/prod/webapp": "webapp-base-sha",
      },
      rushAffectedProjectsBySha: {
        "server-base-sha": [],
        "webapp-base-sha": [],
      },
    }),
  });

  assert.deepEqual(plan, {
    affectedProjectsByDeployTarget: {
      server: [],
      webapp: [],
    },
    anyScope: true,
    deployTargets: ["server"],
    mode: "release",
    prBaseSha: "",
    validateTargets: [],
  });
});

test("rejects unsupported forced targets", async () => {
  await assert.rejects(
    () =>
      computeRushPlan({
        deployTargets: [{ name: "server" }],
        eventName: "workflow_call",
        forceTargetsJson: JSON.stringify(["docs"]),
        resolver: createResolver(),
      }),
    /Unsupported forced target "docs"\./,
  );
});
