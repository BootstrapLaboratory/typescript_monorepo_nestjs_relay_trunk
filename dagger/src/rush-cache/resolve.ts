import {
  dag,
  type Container,
  type Secret,
} from "@dagger.io/dagger";

import type {
  RushCacheProvider,
  RushCacheProvidersDefinition,
  RushCacheResolution,
  RushCacheSpec,
} from "../model/rush-cache.ts";
import {
  buildRushCacheArchiveCommand,
  buildRushCacheRestoreCommand,
  buildGithubRushCacheResolvePlan,
  isMissingRushCacheImageError,
  RUSH_CACHE_ARCHIVE_IMAGE_PATH,
  RUSH_CACHE_ARCHIVE_WORK_PATH,
} from "./resolve-plan.ts";

export type ResolveRushInstallCacheOptions = {
  hostEnv?: Record<string, string>;
  provider?: RushCacheProvider;
  providers: RushCacheProvidersDefinition;
};

type RegistryAuth = {
  address: string;
  secret: Secret;
  username: string;
};

export type ResolvedRushInstallCache = RushCacheResolution & {
  container: Container;
  registryAuth?: RegistryAuth;
};

function withRushCacheArchive(
  container: Container,
  cacheContainer: Container,
): Container {
  return container
    .withFile(
      RUSH_CACHE_ARCHIVE_WORK_PATH,
      cacheContainer.file(RUSH_CACHE_ARCHIVE_IMAGE_PATH),
    )
    .withExec(["bash", "-lc", buildRushCacheRestoreCommand()], {
      expand: false,
    });
}

export async function resolveRushInstallCache(
  container: Container,
  spec: RushCacheSpec,
  options: ResolveRushInstallCacheOptions,
): Promise<ResolvedRushInstallCache> {
  const provider = options.provider ?? "off";

  switch (provider) {
    case "off":
      return {
        cacheHit: false,
        container,
        paths: [...options.providers.cache.paths],
        provider,
        spec,
      };
    case "github":
      return resolveGithubRushInstallCache(container, spec, options);
  }
}

async function resolveGithubRushInstallCache(
  container: Container,
  spec: RushCacheSpec,
  options: ResolveRushInstallCacheOptions,
): Promise<ResolvedRushInstallCache> {
  const plan = buildGithubRushCacheResolvePlan(
    spec,
    options.providers,
    options.hostEnv ?? {},
  );
  const secret = dag.setSecret(
    plan.registryAuth.tokenSecretName,
    plan.registryAuth.token,
  );
  const registryAuth = {
    address: plan.registryAuth.address,
    secret,
    username: plan.registryAuth.username,
  };
  const authenticatedContainer = dag
    .container()
    .withRegistryAuth(registryAuth.address, registryAuth.username, secret);

  try {
    const cacheContainer = authenticatedContainer.from(plan.reference.reference);

    await cacheContainer.sync();
    console.log(`[rush-cache] using ${plan.reference.reference}`);

    return {
      cacheHit: true,
      container: withRushCacheArchive(
        container,
        cacheContainer,
      ),
      paths: [...options.providers.cache.paths],
      provider: "github",
      reference: plan.reference,
      registryAuth,
      spec,
    };
  } catch (error) {
    if (!isMissingRushCacheImageError(error)) {
      throw error;
    }

    console.log(`[rush-cache] building ${plan.reference.reference}`);

    return {
      cacheHit: false,
      container,
      paths: [...options.providers.cache.paths],
      provider: "github",
      reference: plan.reference,
      registryAuth,
      spec,
    };
  }
}

export async function publishResolvedRushInstallCache(
  installedContainer: Container,
  resolution: ResolvedRushInstallCache,
): Promise<string | undefined> {
  if (
    resolution.provider !== "github" ||
    resolution.cacheHit ||
    resolution.reference === undefined ||
    resolution.registryAuth === undefined
  ) {
    return undefined;
  }

  const archiveFile = installedContainer
    .withExec(["bash", "-lc", buildRushCacheArchiveCommand(resolution.paths)], {
      expand: false,
    })
    .file(RUSH_CACHE_ARCHIVE_WORK_PATH);
  const cacheImage = dag
    .container()
    .withRegistryAuth(
      resolution.registryAuth.address,
      resolution.registryAuth.username,
      resolution.registryAuth.secret,
    )
    .withLabel(
      "org.opencontainers.image.source",
      `https://github.com/${resolution.reference.repository}`,
    )
    .withFile(RUSH_CACHE_ARCHIVE_IMAGE_PATH, archiveFile);

  const publishedReference = await cacheImage.publish(
    resolution.reference.reference,
  );

  console.log(`[rush-cache] published ${publishedReference}`);

  return publishedReference;
}
