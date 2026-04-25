import { parse as parseYaml } from "yaml";

import { assertKnownKeys } from "../metadata/parse-utils.ts";
import type {
  GithubRushCacheProviderDefinition,
  RushCacheConfig,
  RushCacheProvidersDefinition,
} from "../model/rush-cache.ts";

const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const DEFAULT_GITHUB_REGISTRY = "ghcr.io";
const DEFAULT_RUSH_CACHE_IMAGE_NAMESPACE = "rush-delivery-caches";
const WORKSPACE_PATH = "/workspace";
const WORKSPACE_RUNTIME_CACHE_PATH = `${WORKSPACE_PATH}/.dagger/runtime`;

function parseRequiredString(rawValue: unknown, name: string): string {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return rawValue;
}

function parseOptionalString(
  rawValue: unknown,
  name: string,
  defaultValue: string,
): string {
  if (rawValue === undefined) {
    return defaultValue;
  }

  return parseRequiredString(rawValue, name);
}

function parseEnvName(rawValue: unknown, name: string): string {
  const value = parseRequiredString(rawValue, name);

  if (!ENV_NAME_PATTERN.test(value)) {
    throw new Error(`${name} "${value}" must match ${ENV_NAME_PATTERN}.`);
  }

  return value;
}

function parseStringArray(rawValue: unknown, name: string): string[] {
  if (!Array.isArray(rawValue) || rawValue.length === 0) {
    throw new Error(`${name} must be a non-empty array.`);
  }

  return rawValue.map((item, index) =>
    parseRequiredString(item, `${name}[${index}]`),
  );
}

function hasParentSegment(value: string): boolean {
  return value.split("/").some((segment) => segment === "..");
}

function parseRepoRelativePath(rawValue: unknown, name: string): string {
  const value = parseRequiredString(rawValue, name).replace(/\\/g, "/");

  if (value.startsWith("/") || value.length === 0 || value === ".") {
    throw new Error(`${name} must be a repository-relative path.`);
  }

  if (hasParentSegment(value)) {
    throw new Error(`${name} must stay inside the repository.`);
  }

  return value;
}

function parseCachePath(rawValue: unknown, name: string): string {
  const value = parseRequiredString(rawValue, name).replace(/\\/g, "/");

  if (!value.startsWith("/")) {
    throw new Error(`${name} must be an absolute container path.`);
  }

  if (value === "/" || hasParentSegment(value)) {
    throw new Error(`${name} must be a specific absolute container path.`);
  }

  if (
    (value === WORKSPACE_PATH || value.startsWith(`${WORKSPACE_PATH}/`)) &&
    !value.startsWith(`${WORKSPACE_RUNTIME_CACHE_PATH}/`)
  ) {
    throw new Error(
      `${name} must stay outside ${WORKSPACE_PATH} unless it is under ${WORKSPACE_RUNTIME_CACHE_PATH}.`,
    );
  }

  return value;
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function parseRushCacheConfig(rawValue: unknown): RushCacheConfig {
  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error("Rush cache config must be a mapping.");
  }

  assertKnownKeys(
    rawValue as Record<string, unknown>,
    ["key_files", "paths", "version"],
    "Rush cache config",
  );

  return {
    key_files: uniqueValues(
      parseStringArray(
        "key_files" in rawValue ? rawValue.key_files : undefined,
        "Rush cache key_files",
      ).map((path, index) =>
        parseRepoRelativePath(path, `Rush cache key_files[${index}]`),
      ),
    ),
    paths: uniqueValues(
      parseStringArray(
        "paths" in rawValue ? rawValue.paths : undefined,
        "Rush cache paths",
      ).map((path, index) =>
        parseCachePath(path, `Rush cache paths[${index}]`),
      ),
    ),
    version: parseRequiredString(
      "version" in rawValue ? rawValue.version : undefined,
      "Rush cache version",
    ),
  };
}

function parseGithubProvider(
  rawValue: unknown,
): GithubRushCacheProviderDefinition {
  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error("GitHub Rush cache provider must be a mapping.");
  }

  assertKnownKeys(
    rawValue as Record<string, unknown>,
    [
      "image_namespace",
      "kind",
      "registry",
      "repository_env",
      "token_env",
      "username_env",
    ],
    "GitHub Rush cache provider",
  );

  const kind = parseRequiredString(
    "kind" in rawValue ? rawValue.kind : undefined,
    "GitHub Rush cache provider kind",
  );

  if (kind !== "github_container_registry") {
    throw new Error(
      `GitHub Rush cache provider kind must be "github_container_registry".`,
    );
  }

  return {
    image_namespace: parseOptionalString(
      "image_namespace" in rawValue ? rawValue.image_namespace : undefined,
      "GitHub Rush cache provider image_namespace",
      DEFAULT_RUSH_CACHE_IMAGE_NAMESPACE,
    ),
    kind,
    registry: parseOptionalString(
      "registry" in rawValue ? rawValue.registry : undefined,
      "GitHub Rush cache provider registry",
      DEFAULT_GITHUB_REGISTRY,
    ),
    repository_env: parseEnvName(
      "repository_env" in rawValue ? rawValue.repository_env : undefined,
      "GitHub Rush cache provider repository_env",
    ),
    token_env: parseEnvName(
      "token_env" in rawValue ? rawValue.token_env : undefined,
      "GitHub Rush cache provider token_env",
    ),
    username_env: parseEnvName(
      "username_env" in rawValue ? rawValue.username_env : undefined,
      "GitHub Rush cache provider username_env",
    ),
  };
}

export function parseRushCacheProviders(
  providersYaml: string,
): RushCacheProvidersDefinition {
  const parsedValue = parseYaml(providersYaml);

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error(
      "Rush cache providers file must define a top-level mapping.",
    );
  }

  assertKnownKeys(
    parsedValue as Record<string, unknown>,
    ["cache", "providers"],
    "Rush cache providers file",
  );

  const rawCache = "cache" in parsedValue ? parsedValue.cache : undefined;
  const rawProviders =
    "providers" in parsedValue ? parsedValue.providers : undefined;

  if (
    typeof rawProviders !== "object" ||
    rawProviders === null ||
    Array.isArray(rawProviders)
  ) {
    throw new Error("Rush cache providers must be a mapping.");
  }

  assertKnownKeys(
    rawProviders as Record<string, unknown>,
    ["github"],
    "Rush cache providers",
  );

  return {
    cache: parseRushCacheConfig(rawCache),
    providers: {
      github:
        "github" in rawProviders
          ? parseGithubProvider(rawProviders.github)
          : undefined,
    },
  };
}
