import type {
  ToolchainImageResolution,
  ToolchainImageSpec,
} from "../model/toolchain-image.ts";

export function resolveOffToolchainImage(
  spec: ToolchainImageSpec,
): ToolchainImageResolution {
  return {
    image: spec.baseImage,
    install: [...spec.install],
    prebuilt: false,
    provider: "off",
  };
}

export function isMissingToolchainImageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  return [
    "manifest unknown",
    "name unknown",
    "not found",
    "404",
  ].some((pattern) => lowerMessage.includes(pattern));
}
