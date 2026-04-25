import { parse as parseYaml } from "yaml";

import { assertKnownKeys } from "../metadata/parse-utils.ts";
import type {
  GithubToolchainImageProviderDefinition,
  ToolchainImageProvidersDefinition,
} from "../model/toolchain-image.ts";

const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const DEFAULT_GITHUB_REGISTRY = "ghcr.io";
const DEFAULT_TOOLCHAIN_IMAGE_NAMESPACE = "rush-delivery-toolchains";

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

function parseGithubProvider(
  rawValue: unknown,
): GithubToolchainImageProviderDefinition {
  if (
    typeof rawValue !== "object" ||
    rawValue === null ||
    Array.isArray(rawValue)
  ) {
    throw new Error("GitHub toolchain image provider must be a mapping.");
  }

  assertKnownKeys(
    rawValue as Record<string, unknown>,
    ["image_namespace", "kind", "registry", "repository_env", "token_env"],
    "GitHub toolchain image provider",
  );

  const kind = parseRequiredString(
    "kind" in rawValue ? rawValue.kind : undefined,
    "GitHub toolchain image provider kind",
  );

  if (kind !== "github_container_registry") {
    throw new Error(
      `GitHub toolchain image provider kind must be "github_container_registry".`,
    );
  }

  return {
    image_namespace: parseOptionalString(
      "image_namespace" in rawValue ? rawValue.image_namespace : undefined,
      "GitHub toolchain image provider image_namespace",
      DEFAULT_TOOLCHAIN_IMAGE_NAMESPACE,
    ),
    kind,
    registry: parseOptionalString(
      "registry" in rawValue ? rawValue.registry : undefined,
      "GitHub toolchain image provider registry",
      DEFAULT_GITHUB_REGISTRY,
    ),
    repository_env: parseEnvName(
      "repository_env" in rawValue ? rawValue.repository_env : undefined,
      "GitHub toolchain image provider repository_env",
    ),
    token_env: parseEnvName(
      "token_env" in rawValue ? rawValue.token_env : undefined,
      "GitHub toolchain image provider token_env",
    ),
  };
}

export function parseToolchainImageProviders(
  providersYaml: string,
): ToolchainImageProvidersDefinition {
  const parsedValue = parseYaml(providersYaml);

  if (
    typeof parsedValue !== "object" ||
    parsedValue === null ||
    Array.isArray(parsedValue)
  ) {
    throw new Error(
      "Toolchain image providers file must define a top-level mapping.",
    );
  }

  assertKnownKeys(
    parsedValue as Record<string, unknown>,
    ["providers"],
    "Toolchain image providers file",
  );

  const rawProviders =
    "providers" in parsedValue ? parsedValue.providers : undefined;

  if (
    typeof rawProviders !== "object" ||
    rawProviders === null ||
    Array.isArray(rawProviders)
  ) {
    throw new Error("Toolchain image providers must be a mapping.");
  }

  assertKnownKeys(
    rawProviders as Record<string, unknown>,
    ["github"],
    "Toolchain image providers",
  );

  return {
    providers: {
      github:
        "github" in rawProviders
          ? parseGithubProvider(rawProviders.github)
          : undefined,
    },
  };
}
