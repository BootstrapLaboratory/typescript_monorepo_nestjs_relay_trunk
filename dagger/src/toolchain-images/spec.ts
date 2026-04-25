import { createHash } from "node:crypto";

import type { DeployTargetDefinition } from "../model/deploy-target.ts";
import type {
  NormalizedToolchainImageSpec,
  ToolchainImageSpec,
} from "../model/toolchain-image.ts";

export const TOOLCHAIN_IMAGE_SPEC_VERSION = "rush-delivery-toolchain-image/v1";
export const TOOLCHAIN_IMAGE_HASH_LENGTH = 16;

export function deployTargetToolchainImageSpec(
  definition: DeployTargetDefinition,
): ToolchainImageSpec {
  return {
    baseImage: definition.runtime.image,
    env: {},
    install: [...definition.runtime.install],
    kind: "deploy-executor",
    name: definition.name,
    version: TOOLCHAIN_IMAGE_SPEC_VERSION,
  };
}

export function normalizeToolchainImageSpec(
  spec: ToolchainImageSpec,
): NormalizedToolchainImageSpec {
  return {
    base_image: spec.baseImage,
    env: Object.fromEntries(
      Object.entries(spec.env).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
    install: [...spec.install],
    kind: spec.kind,
    name: spec.name,
    version: spec.version,
  };
}

export function hashToolchainImageSpec(spec: ToolchainImageSpec): string {
  return createHash("sha256")
    .update(JSON.stringify(normalizeToolchainImageSpec(spec)))
    .digest("hex")
    .slice(0, TOOLCHAIN_IMAGE_HASH_LENGTH);
}

export function toolchainImageTag(spec: ToolchainImageSpec): string {
  return `sha256-${hashToolchainImageSpec(spec)}`;
}

export function toolchainImageName(spec: ToolchainImageSpec): string {
  switch (spec.kind) {
    case "deploy-executor":
      return `deploy-${spec.name}`;
  }
}
