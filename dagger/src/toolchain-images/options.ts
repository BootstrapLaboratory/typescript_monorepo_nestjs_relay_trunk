import type {
  ToolchainImagePolicy,
  ToolchainImageProvider,
} from "../model/toolchain-image.ts";

export function parseToolchainImageProvider(
  value: string,
): ToolchainImageProvider {
  switch (value) {
    case "off":
    case "github":
      return value;
    default:
      throw new Error(`Unsupported toolchain image provider "${value}".`);
  }
}

export function parseToolchainImagePolicy(value: string): ToolchainImagePolicy {
  switch (value) {
    case "lazy":
      return value;
    default:
      throw new Error(`Unsupported toolchain image policy "${value}".`);
  }
}
