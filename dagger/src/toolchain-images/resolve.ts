import type { Container } from "@dagger.io/dagger";

import type {
  ToolchainImageProvider,
  ToolchainImageResolution,
  ToolchainImageSpec,
} from "../model/toolchain-image.ts";

export type ResolveToolchainImageOptions = {
  provider?: ToolchainImageProvider;
};

export function resolveToolchainImage(
  spec: ToolchainImageSpec,
  options: ResolveToolchainImageOptions = {},
): ToolchainImageResolution {
  const provider = options.provider ?? "off";

  switch (provider) {
    case "off":
      return {
        image: spec.baseImage,
        install: [...spec.install],
        prebuilt: false,
        provider,
      };
    case "github":
      throw new Error("GitHub toolchain image provider is not implemented yet.");
  }
}

export function applyToolchainImageResolution(
  container: Container,
  resolution: ToolchainImageResolution,
): Container {
  if (resolution.install.length === 0) {
    return container;
  }

  return container.withExec([
    "bash",
    "-lc",
    resolution.install.join(" && "),
  ]);
}
