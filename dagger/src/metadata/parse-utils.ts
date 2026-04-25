export function assertKnownKeys(
  rawValue: Record<string, unknown>,
  allowedKeys: readonly string[],
  context: string,
): void {
  const allowedKeySet = new Set(allowedKeys);
  const unknownKeys = Object.keys(rawValue).filter(
    (key) => !allowedKeySet.has(key),
  );

  if (unknownKeys.length > 0) {
    throw new Error(
      `${context} has unsupported field${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}.`,
    );
  }
}
