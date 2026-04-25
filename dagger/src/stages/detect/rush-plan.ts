type DeployTargetName = {
  name: string;
};

export type RushPlan = {
  affectedProjectsByDeployTarget: Record<string, string[]>;
  anyScope: boolean;
  deployTargets: string[];
  mode: "pull_request" | "release";
  prBaseSha: string;
  validateTargets: string[];
};

export type RushPlanResolver = {
  hasGitCommit(ref: string): Promise<boolean>;
  resolveCommitSha(ref: string): Promise<string>;
  rushAffectedProjects(baseSha: string): Promise<string[]>;
};

function targetIsAffected(
  projects: string[],
  deployTarget: DeployTargetName,
): boolean {
  return projects.includes(deployTarget.name);
}

function buildAffectedProjectsByTarget(
  deployTargets: DeployTargetName[],
  resolver: (deployTarget: DeployTargetName) => string[],
): Record<string, string[]> {
  return Object.fromEntries(
    deployTargets.map((deployTarget) => [
      deployTarget.name,
      [...resolver(deployTarget)],
    ]),
  );
}

function buildDeployTagName(
  targetName: string,
  deployTagPrefix: string,
): string {
  return `${deployTagPrefix}/${targetName}`;
}

function parseForceTargets(
  forceTargetsJson: string,
  supportedTargetNames: string[],
): string[] {
  const parsedValue = JSON.parse(forceTargetsJson);

  if (!Array.isArray(parsedValue)) {
    throw new Error("FORCE_TARGETS_JSON must be a JSON array.");
  }

  const normalizedTargets: string[] = [];
  for (const targetName of parsedValue) {
    if (typeof targetName !== "string" || targetName.length === 0) {
      throw new Error("FORCE_TARGETS_JSON entries must be non-empty strings.");
    }

    if (!supportedTargetNames.includes(targetName)) {
      throw new Error(`Unsupported forced target "${targetName}".`);
    }

    if (!normalizedTargets.includes(targetName)) {
      normalizedTargets.push(targetName);
    }
  }

  return normalizedTargets;
}

export async function computeRushPlan({
  deployTagPrefix = "deploy/prod",
  deployTargets,
  eventName,
  forceTargetsJson = "[]",
  prBaseSha = "",
  resolver,
}: {
  deployTagPrefix?: string;
  deployTargets: DeployTargetName[];
  eventName: string;
  forceTargetsJson?: string;
  prBaseSha?: string;
  resolver: RushPlanResolver;
}): Promise<RushPlan> {
  if (!eventName) {
    throw new Error("GITHUB_EVENT_NAME is required.");
  }

  const deployTargetNames = deployTargets.map(
    (deployTarget) => deployTarget.name,
  );
  const forceTargets = parseForceTargets(forceTargetsJson, deployTargetNames);

  if (eventName === "pull_request") {
    if (!prBaseSha) {
      throw new Error("PR_BASE_SHA is required for pull_request events.");
    }

    if (!(await resolver.hasGitCommit(prBaseSha))) {
      throw new Error(
        `The pull request base SHA "${prBaseSha}" is not available locally.`,
      );
    }

    const normalizedBaseSha = await resolver.resolveCommitSha(prBaseSha);
    const affectedProjects =
      await resolver.rushAffectedProjects(normalizedBaseSha);
    const affectedProjectsByDeployTarget = buildAffectedProjectsByTarget(
      deployTargets,
      (deployTarget) =>
        targetIsAffected(affectedProjects, deployTarget)
          ? affectedProjects
          : [],
    );

    return {
      affectedProjectsByDeployTarget,
      anyScope: affectedProjects.length > 0,
      deployTargets: [],
      mode: "pull_request",
      prBaseSha: normalizedBaseSha,
      validateTargets: affectedProjects,
    };
  }

  const currentHeadSha = await resolver.resolveCommitSha("HEAD");
  const singleForcedTargetName =
    eventName === "workflow_call" && forceTargets.length === 1
      ? forceTargets[0]
      : "";

  const releasePlanningEntries = await Promise.all(
    deployTargets.map(async (deployTarget) => {
      const baseRef = buildDeployTagName(deployTarget.name, deployTagPrefix);
      const baseSha =
        singleForcedTargetName && singleForcedTargetName !== deployTarget.name
          ? currentHeadSha
          : (await resolver.hasGitCommit(baseRef))
            ? await resolver.resolveCommitSha(baseRef)
            : "";
      const affectedProjects = baseSha
        ? await resolver.rushAffectedProjects(baseSha)
        : [];
      const shouldDeploy =
        forceTargets.includes(deployTarget.name) ||
        !baseSha ||
        targetIsAffected(affectedProjects, deployTarget);

      return [
        deployTarget.name,
        {
          affectedProjects,
          shouldDeploy,
        },
      ] as const;
    }),
  );
  const releasePlanningByTarget = Object.fromEntries(releasePlanningEntries);
  const selectedDeployTargets = deployTargetNames.filter(
    (targetName) => releasePlanningByTarget[targetName]?.shouldDeploy,
  );
  const affectedProjectsByDeployTarget = buildAffectedProjectsByTarget(
    deployTargets,
    (deployTarget) =>
      releasePlanningByTarget[deployTarget.name]?.affectedProjects ?? [],
  );

  return {
    affectedProjectsByDeployTarget,
    anyScope: selectedDeployTargets.length > 0,
    deployTargets: selectedDeployTargets,
    mode: "release",
    prBaseSha: "",
    validateTargets: [],
  };
}
