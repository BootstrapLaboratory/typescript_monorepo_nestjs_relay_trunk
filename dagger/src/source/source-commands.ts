import type { LocalCopySourcePlan } from "../model/source.ts";

const GIT_TOKEN_ENV = "RUSH_DELIVERY_GIT_TOKEN";

export function shellQuote(value: string): string {
  return `'${value.replace(/'/gu, "'\\''")}'`;
}

export function buildLocalCopySourceCommand(
  plan: LocalCopySourcePlan,
): string {
  const workdir = shellQuote(plan.workdir);
  const sourcePath = shellQuote(plan.sourcePath);
  const commands = [
    `rm -rf ${workdir}`,
    `mkdir -p ${workdir}`,
    `cp -a ${sourcePath}/. ${workdir}/`,
  ];

  for (const cleanupPath of plan.cleanupPaths) {
    commands.push(`rm -rf ${shellQuote(`${plan.workdir}/${cleanupPath}`)}`);
  }

  if (plan.removeNodeModules) {
    commands.push(
      [
        `find ${workdir}`,
        `-path ${shellQuote(`${plan.workdir}/.git`)}`,
        "-prune",
        "-o",
        "-name 'node_modules'",
        "-prune",
        "-exec rm -rf {} +",
      ].join(" "),
    );
  }

  return commands.join("\n");
}

export function buildGitAskPassScript(username: string): string {
  return [
    "#!/bin/sh",
    'case "$1" in',
    `  *Username*) printf '%s\\n' ${shellQuote(username)} ;;`,
    `  *Password*) printf '%s\\n' "$${GIT_TOKEN_ENV}" ;;`,
    "  *) printf '\\n' ;;",
    "esac",
    "",
  ].join("\n");
}
