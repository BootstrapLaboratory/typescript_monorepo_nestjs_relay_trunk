export function extractGraphqlWsAuthorization(
  connectionParams: Readonly<Record<string, unknown>> | undefined,
): string | undefined {
  const authorization =
    connectionParams?.authorization ?? connectionParams?.Authorization;
  if (typeof authorization === 'string') {
    return authorization;
  }

  const accessToken = connectionParams?.accessToken;
  if (typeof accessToken === 'string') {
    return `Bearer ${accessToken}`;
  }

  return undefined;
}
