function targetIsAffected(projects, deployTarget) {
  return projects.includes(deployTarget.name);
}

function buildAffectedProjectsByTarget(deployTargets, resolver) {
  return Object.fromEntries(
    deployTargets.map((deployTarget) => [
      deployTarget.name,
      [...resolver(deployTarget)],
    ]),
  );
}

function buildDeployTagName(targetName, deployTagPrefix) {
  return `${deployTagPrefix}/${targetName}`;
}

function parseForceTargets(forceTargetsJson, supportedTargetNames) {
  const parsedValue = JSON.parse(forceTargetsJson);

  if (!Array.isArray(parsedValue)) {
    throw new Error("FORCE_TARGETS_JSON must be a JSON array.");
  }

  const normalizedTargets = [];
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

export function computeRushPlan({
  deployTagPrefix = "deploy/prod",
  deployTargets,
  eventName,
  forceTargetsJson = "[]",
  hasGitCommit,
  prBaseSha = "",
  resolveCommitSha,
  rushAffectedProjects,
}) {
  if (!eventName) {
    throw new Error("GITHUB_EVENT_NAME is required.");
  }

  const deployTargetNames = deployTargets.map((deployTarget) => deployTarget.name);
  const forceTargets = parseForceTargets(forceTargetsJson, deployTargetNames);

  if (eventName === "pull_request") {
    if (!prBaseSha) {
      throw new Error("PR_BASE_SHA is required for pull_request events.");
    }

    if (!hasGitCommit(prBaseSha)) {
      throw new Error(
        `The pull request base SHA "${prBaseSha}" is not available locally.`,
      );
    }

    const normalizedBaseSha = resolveCommitSha(prBaseSha);
    const affectedProjects = rushAffectedProjects(normalizedBaseSha);
    const affectedProjectsByDeployTarget = buildAffectedProjectsByTarget(
      deployTargets,
      (deployTarget) =>
        targetIsAffected(affectedProjects, deployTarget) ? affectedProjects : [],
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

  const currentHeadSha = resolveCommitSha("HEAD");
  const singleForcedTargetName =
    eventName === "workflow_call" && forceTargets.length === 1
      ? forceTargets[0]
      : "";

  const releasePlanningByTarget = Object.fromEntries(
    deployTargets.map((deployTarget) => {
      const baseRef = buildDeployTagName(deployTarget.name, deployTagPrefix);
      const baseSha =
        singleForcedTargetName && singleForcedTargetName !== deployTarget.name
          ? currentHeadSha
          : hasGitCommit(baseRef)
            ? resolveCommitSha(baseRef)
            : "";
      const affectedProjects = baseSha ? rushAffectedProjects(baseSha) : [];
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
      ];
    }),
  );

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
