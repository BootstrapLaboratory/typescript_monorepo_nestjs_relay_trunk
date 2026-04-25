import type { Container, Directory } from "@dagger.io/dagger";

import { createCiPlan } from "../../ci-plan/parse-ci-plan.ts";
import {
  loadDeployTargetDefinition,
  loadServicesMesh,
} from "../deploy/load-deploy-metadata.ts";
import type { CiPlan } from "../../model/ci-plan.ts";
import { computeRushPlan, type RushPlanResolver } from "./rush-plan.ts";

async function loadDeployTargets(repo: Directory): Promise<{ name: string }[]> {
  const servicesMesh = await loadServicesMesh(repo);
  const targetNames = Object.keys(servicesMesh.services);

  await Promise.all(
    targetNames.map((targetName) =>
      loadDeployTargetDefinition(repo, targetName),
    ),
  );

  return targetNames.map((name) => ({ name }));
}

function parseRushListOutput(output: string, baseSha: string): string[] {
  const jsonStartIndex = output.indexOf("{");

  if (jsonStartIndex === -1) {
    throw new Error(`Rush did not emit JSON for base SHA ${baseSha}.`);
  }

  const parsedOutput = JSON.parse(output.slice(jsonStartIndex));

  if (
    typeof parsedOutput !== "object" ||
    parsedOutput === null ||
    !("projects" in parsedOutput) ||
    !Array.isArray(parsedOutput.projects)
  ) {
    throw new Error(
      `Rush emitted malformed project JSON for base SHA ${baseSha}.`,
    );
  }

  const projectNames: string[] = parsedOutput.projects.map(
    (project: unknown): string => {
      if (
        typeof project !== "object" ||
        project === null ||
        !("name" in project) ||
        typeof project.name !== "string"
      ) {
        throw new Error(
          `Rush emitted malformed project JSON for base SHA ${baseSha}.`,
        );
      }

      return project.name;
    },
  );

  return [...new Set(projectNames)].sort();
}

function createContainerResolver(container: Container): RushPlanResolver {
  let currentContainer = container;

  async function run(command: string, args: string[]): Promise<string> {
    const nextContainer = currentContainer.withExec([command, ...args]);
    const output = await nextContainer.stdout();
    currentContainer = nextContainer;

    return output.trim();
  }

  return {
    async hasGitCommit(ref: string): Promise<boolean> {
      try {
        await run("git", ["rev-parse", "--verify", `${ref}^{commit}`]);
        return true;
      } catch {
        return false;
      }
    },

    async resolveCommitSha(ref: string): Promise<string> {
      return run("git", ["rev-parse", `${ref}^{commit}`]);
    },

    async rushAffectedProjects(baseSha: string): Promise<string[]> {
      if (!baseSha) {
        return [];
      }

      const output = await run("node", [
        "common/scripts/install-run-rush.js",
        "list",
        "--json",
        "--from",
        `git:${baseSha}`,
      ]);

      return parseRushListOutput(output, baseSha);
    },
  };
}

export async function computeCiPlan(
  repo: Directory,
  container: Container,
  eventName: string = "push",
  forceTargetsJson: string = "[]",
  prBaseSha: string = "",
  deployTagPrefix: string = "deploy/prod",
): Promise<CiPlan> {
  const deployTargets = await loadDeployTargets(repo);
  const rushPlan = await computeRushPlan({
    deployTagPrefix,
    deployTargets,
    eventName,
    forceTargetsJson,
    prBaseSha,
    resolver: createContainerResolver(container),
  });

  return createCiPlan(rushPlan);
}
