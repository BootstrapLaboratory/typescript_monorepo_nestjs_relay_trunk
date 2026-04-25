const RUSH_SCRIPT = "common/scripts/install-run-rush.js";
const RUSH_LIFECYCLE_COMMANDS = ["verify", "lint", "test", "build"] as const;

export type RushLifecycleCommand = (typeof RUSH_LIFECYCLE_COMMANDS)[number];

export type RushCommandStep = {
  args: string[];
  command: "node";
};

type RushTargetArgsOptions = {
  allowEmpty?: boolean;
  emptySelectionMessage?: string;
};

function normalizeRushProjectNames(projectNames: string[]): string[] {
  return projectNames.map((projectName) => {
    if (projectName.length === 0) {
      throw new Error("Rush project names must be non-empty strings.");
    }

    return projectName;
  });
}

export function buildRushProjectArgs(
  projectNames: string[],
  options: RushTargetArgsOptions = {},
): string[] {
  const normalizedProjectNames = normalizeRushProjectNames(projectNames);

  if (normalizedProjectNames.length === 0) {
    if (options.allowEmpty) {
      return [];
    }

    throw new Error(
      options.emptySelectionMessage ?? "No Rush project targets were selected.",
    );
  }

  return normalizedProjectNames.flatMap((projectName) => ["--to", projectName]);
}

export function buildRushLifecycleSteps(
  projectNames: string[],
  options: RushTargetArgsOptions = {},
): RushCommandStep[] {
  if (projectNames.length === 0 && options.allowEmpty) {
    return [];
  }

  const targetArgs = buildRushProjectArgs(projectNames, options);

  return RUSH_LIFECYCLE_COMMANDS.map((rushCommand) => ({
    args: [RUSH_SCRIPT, rushCommand, ...targetArgs],
    command: "node",
  }));
}
