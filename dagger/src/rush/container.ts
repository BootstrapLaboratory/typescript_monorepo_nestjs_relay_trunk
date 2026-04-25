import { CacheSharingMode, dag, Container, Directory } from "@dagger.io/dagger";
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
const RUSH_HOME_CACHE_PATH = "/root/.rush";
const RUSH_INSTALL_RUN_CACHE_PATH = `${RUSH_WORKDIR}/common/temp/install-run`;
const RUSH_PNPM_STORE_CACHE_PATH = `${RUSH_WORKDIR}/common/temp/pnpm-store`;

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
    .withDirectory(RUSH_WORKDIR, repo)
    .withWorkdir(RUSH_WORKDIR);
}

export function withRushCaches(container: Container): Container {
  return container
    .withMountedCache(
      RUSH_HOME_CACHE_PATH,
      dag.cacheVolume("cache-rush-home"),
      {
        sharing: CacheSharingMode.Locked,
      },
    )
    .withMountedCache(
      RUSH_INSTALL_RUN_CACHE_PATH,
      dag.cacheVolume("cache-rush-install-run"),
      { sharing: CacheSharingMode.Locked },
    )
    .withMountedCache(
      RUSH_PNPM_STORE_CACHE_PATH,
      dag.cacheVolume("cache-rush-pnpm-store"),
      { sharing: CacheSharingMode.Locked },
    );
}

export function installRush(container: Container): Container {
  return withRushCaches(container).withExec([
    "node",
    "common/scripts/install-run-rush.js",
    "install",
    "--max-install-attempts",
    "1",
  ]);
}
