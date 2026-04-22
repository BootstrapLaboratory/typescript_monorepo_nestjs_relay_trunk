export function parseReleaseTargets(releaseTargetsJson: string): string[] {
  const parsedValue = JSON.parse(releaseTargetsJson);

  if (!Array.isArray(parsedValue)) {
    throw new Error("releaseTargetsJson must be a JSON array.");
  }

  const normalizedTargets: string[] = [];

  for (const target of parsedValue) {
    if (typeof target !== "string" || target.length === 0) {
      throw new Error("releaseTargetsJson entries must be non-empty strings.");
    }

    if (!normalizedTargets.includes(target)) {
      normalizedTargets.push(target);
    }
  }

  return normalizedTargets;
}
