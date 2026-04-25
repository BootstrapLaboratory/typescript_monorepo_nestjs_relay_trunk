import { dag, type Container, type Directory } from "@dagger.io/dagger";

import type {
  GitCommandPlan,
  GitSourcePlan,
  LocalCopySourcePlan,
  SourcePlan,
} from "../model/source.ts";
import {
  buildGitAskPassScript,
  buildLocalCopySourceCommand,
  GIT_ASKPASS_PATH,
  GIT_TOKEN_ENV,
  shellQuote,
} from "./source-commands.ts";

const SOURCE_IMAGE = "node:24-bookworm-slim";
const SOURCE_INSTALL_COMMAND = "apt-get update && apt-get install -y ca-certificates git";

export type ResolveSourceOptions = {
  hostEnv?: Record<string, string>;
  repo?: Directory;
};

function dirname(path: string): string {
  const index = path.lastIndexOf("/");

  if (index <= 0) {
    return "/";
  }

  return path.slice(0, index);
}

function requireHostEnv(
  hostEnv: Record<string, string>,
  name: string,
  context: string,
): string {
  const value = hostEnv[name];

  if (value === undefined || value.length === 0) {
    throw new Error(`${context} requires host env ${name}.`);
  }

  return value;
}

function sourceBaseContainer(): Container {
  return dag.container().from(SOURCE_IMAGE).withExec([
    "bash",
    "-lc",
    SOURCE_INSTALL_COMMAND,
  ]);
}

function withGitAuth(
  container: Container,
  plan: GitSourcePlan,
  hostEnv: Record<string, string>,
): Container {
  let nextContainer = container.withEnvVariable("GIT_TERMINAL_PROMPT", "0");

  if (plan.auth === undefined) {
    return nextContainer;
  }

  const token = requireHostEnv(
    hostEnv,
    plan.auth.tokenEnv,
    "Git source authentication",
  );
  const secret = dag.setSecret("rush-delivery-git-token", token);

  nextContainer = nextContainer
    .withSecretVariable(GIT_TOKEN_ENV, secret)
    .withNewFile(GIT_ASKPASS_PATH, buildGitAskPassScript(plan.auth.username), {
      permissions: 0o700,
    })
    .withEnvVariable("GIT_ASKPASS", GIT_ASKPASS_PATH);

  return nextContainer;
}

function withGitCommandPlan(
  container: Container,
  commandPlan: GitCommandPlan,
): Container {
  return container.withExec([commandPlan.command, ...commandPlan.args], {
    expand: false,
  });
}

function resolveLocalCopySource(
  plan: LocalCopySourcePlan,
  options: ResolveSourceOptions,
): Directory {
  if (options.repo === undefined) {
    throw new Error("Local copy source mode requires a repo directory.");
  }

  return sourceBaseContainer()
    .withDirectory(plan.sourcePath, options.repo)
    .withExec(["bash", "-lc", buildLocalCopySourceCommand(plan)], {
      expand: false,
    })
    .directory(plan.workdir);
}

function resolveGitSource(
  plan: GitSourcePlan,
  options: ResolveSourceOptions,
): Directory {
  let container = withGitAuth(
    sourceBaseContainer().withExec([
      "bash",
      "-lc",
      `rm -rf ${shellQuote(plan.workdir)} && mkdir -p ${shellQuote(dirname(plan.workdir))}`,
    ]),
    plan,
    options.hostEnv ?? {},
  );

  for (const commandPlan of plan.commands) {
    container = withGitCommandPlan(container, commandPlan);
  }

  return container.directory(plan.workdir);
}

export function resolveSource(
  plan: SourcePlan,
  options: ResolveSourceOptions = {},
): Directory {
  switch (plan.mode) {
    case "local_copy":
      return resolveLocalCopySource(plan, options);
    case "git":
      return resolveGitSource(plan, options);
  }
}
