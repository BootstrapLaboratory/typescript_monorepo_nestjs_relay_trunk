import { dag, type Container, type Directory } from "@dagger.io/dagger";

import type {
  GitCommandPlan,
  GitSourcePlan,
  LocalCopySourcePlan,
  SourcePlan,
} from "../model/source.ts";
import type {
  ToolchainImageProvider,
  ToolchainImageProvidersDefinition,
} from "../model/toolchain-image.ts";
import { rushWorkflowToolchainSpec } from "../rush/container.ts";
import {
  buildResolvedToolchainContainer,
  resolveToolchainImage,
} from "../toolchain-images/resolve.ts";
import {
  buildGitAskPassScript,
  buildLocalCopySourceCommand,
  GIT_ASKPASS_PATH,
  GIT_TOKEN_ENV,
  shellQuote,
} from "./source-commands.ts";

export type ResolveSourceOptions = {
  hostEnv?: Record<string, string>;
  repo?: Directory;
  toolchainImageProvider?: ToolchainImageProvider;
  toolchainImageProviders?: ToolchainImageProvidersDefinition;
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

async function sourceBaseContainer(
  options: ResolveSourceOptions,
): Promise<Container> {
  return buildResolvedToolchainContainer(
    await resolveToolchainImage(
      rushWorkflowToolchainSpec(),
      {
        hostEnv: options.hostEnv,
        provider: options.toolchainImageProvider,
        providers: options.toolchainImageProviders,
      },
    ),
  );
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

async function resolveLocalCopySource(
  plan: LocalCopySourcePlan,
  options: ResolveSourceOptions,
): Promise<Directory> {
  if (options.repo === undefined) {
    throw new Error("Local copy source mode requires a repo directory.");
  }

  return (await sourceBaseContainer(options))
    .withDirectory(plan.sourcePath, options.repo)
    .withExec(["bash", "-lc", buildLocalCopySourceCommand(plan)], {
      expand: false,
    })
    .directory(plan.workdir);
}

async function resolveGitSource(
  plan: GitSourcePlan,
  options: ResolveSourceOptions,
): Promise<Directory> {
  let container = withGitAuth(
    (await sourceBaseContainer(options)).withExec([
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

export async function resolveSource(
  plan: SourcePlan,
  options: ResolveSourceOptions = {},
): Promise<Directory> {
  switch (plan.mode) {
    case "local_copy":
      return resolveLocalCopySource(plan, options);
    case "git":
      return resolveGitSource(plan, options);
  }
}
