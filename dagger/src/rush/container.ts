import { Container, Directory } from "@dagger.io/dagger";
import type {
  ToolchainImageProvider,
  ToolchainImageProvidersDefinition,
} from "../model/toolchain-image.ts";
import {
  buildResolvedToolchainContainer,
  resolveToolchainImage,
} from "../toolchain-images/resolve.ts";
import { rushToolchainImageSpec } from "../toolchain-images/spec.ts";

export const RUSH_WORKDIR = "/workspace";

const RUSH_IMAGE = "node:24-bookworm-slim";
const RUSH_INSTALL_COMMANDS = [
  "apt-get update",
  "apt-get install -y ca-certificates git",
];
const HOST_RUSH_BOOTSTRAP_PATHS = [
  "common/temp/install-run",
  "common/temp/rush-recycler",
];

export type RushToolchainImageOptions = {
  hostEnv?: Record<string, string>;
  provider?: ToolchainImageProvider;
  providers?: ToolchainImageProvidersDefinition;
};

export async function prepareRushContainer(
  repo: Directory,
  options: RushToolchainImageOptions = {},
): Promise<Container> {
  const toolchainImage = await resolveToolchainImage(
    rushToolchainImageSpec(RUSH_IMAGE, RUSH_INSTALL_COMMANDS),
    options,
  );

  return buildResolvedToolchainContainer(toolchainImage)
    .withDirectory(RUSH_WORKDIR, withoutHostRushBootstrapState(repo))
    .withWorkdir(RUSH_WORKDIR);
}

function withoutHostRushBootstrapState(repo: Directory): Directory {
  return HOST_RUSH_BOOTSTRAP_PATHS.reduce(
    (nextRepo, path) => nextRepo.withoutDirectory(path),
    repo,
  );
}

export function installRush(container: Container): Container {
  return container.withExec([
    "node",
    "common/scripts/install-run-rush.js",
    "install",
    "--max-install-attempts",
    "1",
  ]);
}
