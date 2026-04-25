import { CacheSharingMode, dag, Container, Directory } from "@dagger.io/dagger";

export const RUSH_WORKDIR = "/workspace";

const RUSH_IMAGE = "node:24-bookworm-slim";
const RUSH_INSTALL_COMMAND =
  "apt-get update && apt-get install -y ca-certificates git";
const RUSH_HOME_CACHE_PATH = "/root/.rush";
const RUSH_INSTALL_RUN_CACHE_PATH = `${RUSH_WORKDIR}/common/temp/install-run`;
const RUSH_PNPM_STORE_CACHE_PATH = `${RUSH_WORKDIR}/common/temp/pnpm-store`;

export function prepareRushContainer(repo: Directory): Container {
  return dag
    .container()
    .from(RUSH_IMAGE)
    .withDirectory(RUSH_WORKDIR, repo)
    .withWorkdir(RUSH_WORKDIR)
    .withExec(["bash", "-lc", RUSH_INSTALL_COMMAND]);
}

export function withRushCaches(container: Container): Container {
  return container
    .withMountedCache(RUSH_HOME_CACHE_PATH, dag.cacheVolume("cache-rush-home"), {
      sharing: CacheSharingMode.Locked,
    })
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
