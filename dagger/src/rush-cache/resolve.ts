import {
  CacheSharingMode,
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
  buildGithubRushCacheResolvePlan,
  isMissingRushCacheImageError,
  RUSH_CACHE_TEMP_FOLDER_ENV,
  rushCacheTempFolder,
  rushCacheVolumeName,
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

function withRushCacheEnvironment(
  container: Container,
  tempFolder: string,
): Container {
  return container.withEnvVariable(RUSH_CACHE_TEMP_FOLDER_ENV, tempFolder);
}

function withRushCacheVolumes(
  container: Container,
  spec: RushCacheSpec,
  providers: RushCacheProvidersDefinition,
): Container {
  let nextContainer = withRushCacheEnvironment(
    container,
    rushCacheTempFolder(providers.cache),
  );

  for (const path of providers.cache.paths) {
    nextContainer = nextContainer.withMountedCache(
      path,
      dag.cacheVolume(rushCacheVolumeName(spec, path)),
      {
        sharing: CacheSharingMode.Locked,
      },
    );
  }

  return nextContainer;
}

function withRushCacheDirectories(
  container: Container,
  cacheContainer: Container,
  providers: RushCacheProvidersDefinition,
): Container {
  let nextContainer = withRushCacheEnvironment(
    container,
    rushCacheTempFolder(providers.cache),
  );

  for (const path of providers.cache.paths) {
    nextContainer = nextContainer.withDirectory(
      path,
      cacheContainer.directory(path),
    );
  }

  return nextContainer;
}

function withEmptyRushCacheDirectories(
  container: Container,
  providers: RushCacheProvidersDefinition,
): Container {
  return withRushCacheEnvironment(
    container,
    rushCacheTempFolder(providers.cache),
  ).withExec(["mkdir", "-p", ...providers.cache.paths], {
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
        container: withRushCacheVolumes(container, spec, options.providers),
        paths: [...options.providers.cache.paths],
        provider,
        spec,
        tempFolder: rushCacheTempFolder(options.providers.cache),
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
      container: withRushCacheDirectories(
        container,
        cacheContainer,
        options.providers,
      ),
      paths: [...options.providers.cache.paths],
      provider: "github",
      reference: plan.reference,
      registryAuth,
      spec,
      tempFolder: rushCacheTempFolder(options.providers.cache),
    };
  } catch (error) {
    if (!isMissingRushCacheImageError(error)) {
      throw error;
    }

    console.log(`[rush-cache] building ${plan.reference.reference}`);

    return {
      cacheHit: false,
      container: withEmptyRushCacheDirectories(container, options.providers),
      paths: [...options.providers.cache.paths],
      provider: "github",
      reference: plan.reference,
      registryAuth,
      spec,
      tempFolder: rushCacheTempFolder(options.providers.cache),
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

  let cacheImage = dag
    .container()
    .withRegistryAuth(
      resolution.registryAuth.address,
      resolution.registryAuth.username,
      resolution.registryAuth.secret,
    )
    .withLabel(
      "org.opencontainers.image.source",
      `https://github.com/${resolution.reference.repository}`,
    );

  for (const path of resolution.paths) {
    cacheImage = cacheImage.withDirectory(
      path,
      installedContainer.directory(path),
    );
  }

  const publishedReference = await cacheImage.publish(
    resolution.reference.reference,
  );

  console.log(`[rush-cache] published ${publishedReference}`);

  return publishedReference;
}
