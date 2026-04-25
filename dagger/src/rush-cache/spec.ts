import { createHash } from "node:crypto";

import type {
  NormalizedRushCacheSpec,
  RushCacheConfig,
  RushCacheKeyFile,
  RushCacheSpec,
} from "../model/rush-cache.ts";

export const RUSH_CACHE_SPEC_VERSION = "rush-delivery-rush-cache/v1";
export const RUSH_CACHE_HASH_LENGTH = 16;

export type BuildRushCacheSpecInput = {
  config: RushCacheConfig;
  keyFiles: RushCacheKeyFile[];
  toolchainIdentity: string;
};

function sortKeyFiles(keyFiles: RushCacheKeyFile[]): RushCacheKeyFile[] {
  return [...keyFiles].sort((left, right) =>
    left.path.localeCompare(right.path),
  );
}

export function buildRushCacheSpec(
  input: BuildRushCacheSpecInput,
): RushCacheSpec {
  return {
    keyFiles: sortKeyFiles(input.keyFiles),
    paths: [...input.config.paths].sort(),
    toolchainIdentity: input.toolchainIdentity,
    version: `${RUSH_CACHE_SPEC_VERSION}:${input.config.version}`,
  };
}

export function normalizeRushCacheSpec(
  spec: RushCacheSpec,
): NormalizedRushCacheSpec {
  return {
    key_files: sortKeyFiles(spec.keyFiles).map((keyFile) => ({
      contents: keyFile.contents,
      path: keyFile.path,
    })),
    paths: [...spec.paths].sort(),
    toolchain_identity: spec.toolchainIdentity,
    version: spec.version,
  };
}

export function hashRushCacheSpec(spec: RushCacheSpec): string {
  return createHash("sha256")
    .update(JSON.stringify(normalizeRushCacheSpec(spec)))
    .digest("hex")
    .slice(0, RUSH_CACHE_HASH_LENGTH);
}

export function rushCacheTag(spec: RushCacheSpec): string {
  return `sha256-${hashRushCacheSpec(spec)}`;
}
