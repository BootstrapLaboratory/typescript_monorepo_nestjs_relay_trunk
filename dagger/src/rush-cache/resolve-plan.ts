import type {
  RushCacheProvidersDefinition,
  RushCacheReference,
  RushCacheSpec,
} from "../model/rush-cache.ts";
import { buildGithubRushCacheReference } from "./github-reference.ts";
import { hashRushCacheSpec, rushCacheTag } from "./spec.ts";

export const RUSH_CACHE_ARCHIVE_IMAGE_PATH = "/rush-cache/cache.tar.gz";
export const RUSH_CACHE_ARCHIVE_WORK_PATH = "/tmp/rush-cache.tar.gz";
export const RUSH_CACHE_IMAGE_NAME = "rush-install";
export const RUSH_CACHE_WORKDIR = "/workspace";

export type GithubRushCacheRegistryAuthPlan = {
  address: string;
  token: string;
  tokenSecretName: string;
  username: string;
};

export type GithubRushCacheResolvePlan = {
  reference: RushCacheReference;
  registryAuth: GithubRushCacheRegistryAuthPlan;
};

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

export function buildGithubRushCacheResolvePlan(
  spec: RushCacheSpec,
  providers: RushCacheProvidersDefinition,
  hostEnv: Record<string, string> = {},
): GithubRushCacheResolvePlan {
  const githubProvider = providers.providers.github;

  if (githubProvider === undefined) {
    throw new Error(
      "GitHub Rush cache provider metadata is required when provider is github.",
    );
  }

  const repository = requireHostEnv(
    hostEnv,
    githubProvider.repository_env,
    "GitHub Rush cache provider",
  );
  const token = requireHostEnv(
    hostEnv,
    githubProvider.token_env,
    "GitHub Rush cache provider",
  );
  const username = requireHostEnv(
    hostEnv,
    githubProvider.username_env,
    "GitHub Rush cache provider",
  );
  const reference = buildGithubRushCacheReference({
    imageName: RUSH_CACHE_IMAGE_NAME,
    imageNamespace: githubProvider.image_namespace,
    registry: githubProvider.registry,
    repository,
    tag: rushCacheTag(spec),
  });

  return {
    reference,
    registryAuth: {
      address: githubProvider.registry,
      token,
      tokenSecretName: `rush-cache-${hashRushCacheSpec(spec)}-github-token`,
      username,
    },
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildRushCacheArchiveCommand(paths: string[]): string {
  if (paths.length === 0) {
    throw new Error("Rush cache archive requires at least one path.");
  }

  return [
    "set -euo pipefail",
    [
      "tar",
      "-C",
      shellQuote(RUSH_CACHE_WORKDIR),
      "-cf",
      "-",
      ...paths.map(shellQuote),
      "|",
      "gzip",
      "-9",
      ">",
      shellQuote(RUSH_CACHE_ARCHIVE_WORK_PATH),
    ].join(" "),
    `printf '[rush-cache] created archive size: %s bytes\\n' "$(stat -c %s ${shellQuote(RUSH_CACHE_ARCHIVE_WORK_PATH)})"`,
  ].join(" && ");
}

export function buildRushCacheRestoreCommand(): string {
  return [
    "set -euo pipefail",
    `printf '[rush-cache] restore archive size: %s bytes\\n' "$(stat -c %s ${shellQuote(RUSH_CACHE_ARCHIVE_WORK_PATH)})"`,
    [
      "tar",
      "-xzf",
      shellQuote(RUSH_CACHE_ARCHIVE_WORK_PATH),
      "-C",
      shellQuote(RUSH_CACHE_WORKDIR),
    ].join(" "),
  ].join(" && ");
}

export function isMissingRushCacheImageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  return [
    "manifest unknown",
    "name unknown",
    "not found",
    "404",
  ].some((pattern) => lowerMessage.includes(pattern));
}
