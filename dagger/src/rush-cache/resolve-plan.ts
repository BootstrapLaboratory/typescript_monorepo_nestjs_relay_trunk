import { createHash } from "node:crypto";

import type {
  RushCacheConfig,
  RushCacheProvidersDefinition,
  RushCacheReference,
  RushCacheSpec,
} from "../model/rush-cache.ts";
import { buildGithubRushCacheReference } from "./github-reference.ts";
import { hashRushCacheSpec, rushCacheTag } from "./spec.ts";

export const RUSH_CACHE_IMAGE_NAME = "rush-install";
export const RUSH_CACHE_TEMP_FOLDER_ENV = "RUSH_TEMP_FOLDER";
export const RUSH_CACHE_VOLUME_PREFIX = "rush-delivery-rush-cache";

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

function hashCachePath(path: string): string {
  return createHash("sha256").update(path).digest("hex").slice(0, 8);
}

export function rushCacheTempFolder(config: RushCacheConfig): string {
  const tempFolder = config.paths[0];

  if (tempFolder === undefined) {
    throw new Error("Rush cache config must define at least one cache path.");
  }

  return tempFolder;
}

export function rushCacheVolumeName(
  spec: RushCacheSpec,
  path: string,
): string {
  return `${RUSH_CACHE_VOLUME_PREFIX}-${hashRushCacheSpec(spec)}-${hashCachePath(path)}`;
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
