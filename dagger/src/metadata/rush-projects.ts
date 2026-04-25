export type RushProjectDefinition = {
  packageName: string;
  projectFolder: string;
};

function parseRequiredString(rawValue: unknown, name: string): string {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return rawValue;
}

export function parseRushProjects(rushJson: string): RushProjectDefinition[] {
  const parsedValue = JSON.parse(rushJson);

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    Array.isArray(parsedValue) ||
    !("projects" in parsedValue) ||
    !Array.isArray(parsedValue.projects)
  ) {
    throw new Error("rush.json must define a top-level projects array.");
  }

  const seenPackageNames = new Set<string>();
  const projects: RushProjectDefinition[] = [];

  for (const [index, rawProject] of parsedValue.projects.entries()) {
    if (
      typeof rawProject !== "object" ||
      rawProject === null ||
      Array.isArray(rawProject)
    ) {
      throw new Error(`rush.json projects[${index}] must be a mapping.`);
    }

    const packageName = parseRequiredString(
      "packageName" in rawProject ? rawProject.packageName : undefined,
      `rush.json projects[${index}].packageName`,
    );
    const projectFolder = parseRequiredString(
      "projectFolder" in rawProject ? rawProject.projectFolder : undefined,
      `rush.json projects[${index}].projectFolder`,
    );

    if (seenPackageNames.has(packageName)) {
      throw new Error(`rush.json contains duplicate project "${packageName}".`);
    }

    seenPackageNames.add(packageName);
    projects.push({ packageName, projectFolder });
  }

  return projects;
}
