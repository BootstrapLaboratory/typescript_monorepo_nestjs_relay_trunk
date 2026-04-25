import { dag, type Container, type Secret } from "@dagger.io/dagger";

import type {
  ToolchainImageProvidersDefinition,
  ToolchainImageProvider,
  ToolchainImageResolution,
  ToolchainImageSpec,
} from "../model/toolchain-image.ts";
import { buildGithubToolchainImageReference } from "./github-reference.ts";
import {
  isMissingToolchainImageError,
  resolveOffToolchainImage,
} from "./resolve-plan.ts";
import { toolchainImageName, toolchainImageTag } from "./spec.ts";

export type ResolveToolchainImageOptions = {
  hostEnv?: Record<string, string>;
  provider?: ToolchainImageProvider;
  providers?: ToolchainImageProvidersDefinition;
};

type RegistryAuth = {
  address: string;
  secret: Secret;
  username: string;
};

export type ResolvedToolchainImage = ToolchainImageResolution & {
  registryAuth?: RegistryAuth;
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

function buildToolchainContainer(spec: ToolchainImageSpec): Container {
  let container = dag.container().from(spec.baseImage);

  if (spec.install.length > 0) {
    container = container.withExec(["bash", "-lc", spec.install.join(" && ")]);
  }

  return container;
}

export async function resolveToolchainImage(
  spec: ToolchainImageSpec,
  options: ResolveToolchainImageOptions = {},
): Promise<ResolvedToolchainImage> {
  const provider = options.provider ?? "off";

  switch (provider) {
    case "off":
      return resolveOffToolchainImage(spec);
    case "github":
      return resolveGithubToolchainImage(spec, options);
  }
}

async function resolveGithubToolchainImage(
  spec: ToolchainImageSpec,
  options: ResolveToolchainImageOptions,
): Promise<ResolvedToolchainImage> {
  const githubProvider = options.providers?.providers.github;

  if (githubProvider === undefined) {
    throw new Error(
      "GitHub toolchain image provider metadata is required when provider is github.",
    );
  }

  const hostEnv = options.hostEnv ?? {};
  const repository = requireHostEnv(
    hostEnv,
    githubProvider.repository_env,
    "GitHub toolchain image provider",
  );
  const token = requireHostEnv(
    hostEnv,
    githubProvider.token_env,
    "GitHub toolchain image provider",
  );
  const username = requireHostEnv(
    hostEnv,
    githubProvider.username_env,
    "GitHub toolchain image provider",
  );
  const reference = buildGithubToolchainImageReference({
    imageName: toolchainImageName(spec),
    imageNamespace: githubProvider.image_namespace,
    registry: githubProvider.registry,
    repository,
    tag: toolchainImageTag(spec),
  });
  const secret = dag.setSecret(
    `toolchain-image-${spec.kind}-${spec.name}-github-token`,
    token,
  );
  const registryAuth = {
    address: githubProvider.registry,
    secret,
    username,
  };
  const authenticatedContainer = dag
    .container()
    .withRegistryAuth(registryAuth.address, username, secret);

  try {
    await authenticatedContainer.from(reference.reference).sync();
    console.log(`[toolchain-images] using ${reference.reference}`);
  } catch (error) {
    if (!isMissingToolchainImageError(error)) {
      throw error;
    }

    console.log(`[toolchain-images] building ${reference.reference}`);

    const publishedReference = await buildToolchainContainer(spec)
      .withLabel(
        "org.opencontainers.image.source",
        `https://github.com/${repository}`,
      )
      .withRegistryAuth(registryAuth.address, username, secret)
      .publish(reference.reference);

    console.log(`[toolchain-images] published ${publishedReference}`);
  }

  return {
    image: reference.reference,
    install: [],
    prebuilt: true,
    provider: "github",
    reference,
    registryAuth,
  };
}

export function applyToolchainImageRegistryAuth(
  container: Container,
  resolution: ResolvedToolchainImage,
): Container {
  if (resolution.registryAuth === undefined) {
    return container;
  }

  return container.withRegistryAuth(
    resolution.registryAuth.address,
    resolution.registryAuth.username,
    resolution.registryAuth.secret,
  );
}

export function applyToolchainImageResolution(
  container: Container,
  resolution: ResolvedToolchainImage,
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
