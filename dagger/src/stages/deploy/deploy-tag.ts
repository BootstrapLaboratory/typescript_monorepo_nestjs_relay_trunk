const GIT_AUTHOR_NAME = "github-actions[bot]";
const GIT_AUTHOR_EMAIL =
  "41898282+github-actions[bot]@users.noreply.github.com";

export function deployTagPrefixForEnvironment(environment: string): string {
  return `deploy/${environment}`;
}

export function deployTagName(environment: string, target: string): string {
  return `${deployTagPrefixForEnvironment(environment)}/${target}`;
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

export function buildUpdateDeployTagCommand(
  environment: string,
  target: string,
  gitSha: string,
): string {
  const tagName = deployTagName(environment, target);
  const tagRef = `refs/tags/${tagName}`;

  return [
    `printf '[deploy-release] update deploy tag %s -> %s\\n' ${shellQuote(tagName)} ${shellQuote(gitSha)}`,
    `git config user.name ${shellQuote(GIT_AUTHOR_NAME)}`,
    `git config user.email ${shellQuote(GIT_AUTHOR_EMAIL)}`,
    `git tag -f ${shellQuote(tagName)} ${shellQuote(gitSha)}`,
    `git push origin ${shellQuote(tagRef)} --force`,
  ].join(" && ");
}

export function buildDeployTargetCommand(
  deployScript: string,
  environment: string,
  target: string,
  gitSha: string,
): string {
  return [
    `bash ${deployScript}`,
    buildUpdateDeployTagCommand(environment, target, gitSha),
  ].join(" && ");
}
