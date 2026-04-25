import * as assert from "node:assert/strict";
import { test } from "node:test";

import { buildGithubRushCacheReference } from "../src/rush-cache/github-reference.ts";
import {
  parseRushCachePolicy,
  parseRushCacheProvider,
} from "../src/rush-cache/options.ts";
import { parseRushCacheProviders } from "../src/rush-cache/parse-providers.ts";
import {
  buildGithubRushCacheResolvePlan,
  buildRushCacheArchiveCommand,
  buildRushCacheRestoreCommand,
  isMissingRushCacheImageError,
} from "../src/rush-cache/resolve-plan.ts";
import {
  buildRushCacheSpec,
  hashRushCacheSpec,
  normalizeRushCacheSpec,
  RUSH_CACHE_HASH_LENGTH,
  rushCacheTag,
} from "../src/rush-cache/spec.ts";

test("parses GitHub Rush cache provider metadata", () => {
  const providers = parseRushCacheProviders(`
cache:
  version: v1
  key_files:
    - rush.json
    - common/config/rush/pnpm-lock.yaml
  paths:
    - common/temp/node_modules
providers:
  github:
    kind: github_container_registry
    registry: ghcr.io
    image_namespace: custom-caches
    repository_env: GITHUB_REPOSITORY
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
`);

  assert.deepStrictEqual(providers, {
    cache: {
      key_files: ["rush.json", "common/config/rush/pnpm-lock.yaml"],
      paths: ["common/temp/node_modules"],
      version: "v1",
    },
    providers: {
      github: {
        image_namespace: "custom-caches",
        kind: "github_container_registry",
        registry: "ghcr.io",
        repository_env: "GITHUB_REPOSITORY",
        token_env: "GITHUB_TOKEN",
        username_env: "GITHUB_ACTOR",
      },
    },
  });
});

test("fills GitHub Rush cache provider metadata defaults", () => {
  const providers = parseRushCacheProviders(`
cache:
  version: v1
  key_files:
    - rush.json
  paths:
    - common/temp/node_modules
providers:
  github:
    kind: github_container_registry
    repository_env: GITHUB_REPOSITORY
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
`);

  assert.deepStrictEqual(providers.providers.github, {
    image_namespace: "rush-delivery-caches",
    kind: "github_container_registry",
    registry: "ghcr.io",
    repository_env: "GITHUB_REPOSITORY",
    token_env: "GITHUB_TOKEN",
    username_env: "GITHUB_ACTOR",
  });
});

test("fails when Rush cache key files are not repo-relative", () => {
  assert.throws(
    () =>
      parseRushCacheProviders(`
cache:
  version: v1
  key_files:
    - /rush.json
  paths:
    - common/temp/node_modules
providers: {}
`),
    /key_files\[0\] must be a repository-relative path/,
  );
});

test("allows repository-relative Rush cache paths", () => {
  const providers = parseRushCacheProviders(`
cache:
  version: v1
  key_files:
    - rush.json
  paths:
    - common/temp/node_modules
providers: {}
`);

  assert.deepStrictEqual(providers.cache.paths, ["common/temp/node_modules"]);
});

test("fails when Rush cache paths are absolute", () => {
  assert.throws(
    () =>
      parseRushCacheProviders(`
cache:
  version: v1
  key_files:
    - rush.json
  paths:
    - /workspace/common/temp
providers: {}
`),
    /paths\[0\] must be a repository-relative path/,
  );
});

test("fails when Rush cache provider metadata contains unsupported providers", () => {
  assert.throws(
    () =>
      parseRushCacheProviders(`
cache:
  version: v1
  key_files:
    - rush.json
  paths:
    - common/temp/node_modules
providers:
  gitlab:
    kind: gitlab_container_registry
`),
    /Rush cache providers has unsupported field: gitlab\./,
  );
});

test("fails when GitHub Rush cache provider env names are invalid", () => {
  assert.throws(
    () =>
      parseRushCacheProviders(`
cache:
  version: v1
  key_files:
    - rush.json
  paths:
    - common/temp/node_modules
providers:
  github:
    kind: github_container_registry
    repository_env: github_repository
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
`),
    /repository_env "github_repository" must match/,
  );
});

test("normalizes Rush cache specs for stable hashing", () => {
  const config = {
    key_files: ["common/config/rush/pnpm-lock.yaml", "rush.json"],
    paths: ["common/temp/node_modules", "common/temp/pnpm-store"],
    version: "v1",
  };
  const left = buildRushCacheSpec({
    config,
    keyFiles: [
      { contents: "lock", path: "common/config/rush/pnpm-lock.yaml" },
      { contents: "rush", path: "rush.json" },
    ],
    toolchainIdentity: "rush-workflow:sha256-abc123",
  });
  const right = buildRushCacheSpec({
    config: {
      ...config,
      paths: ["common/temp/pnpm-store", "common/temp/node_modules"],
    },
    keyFiles: [
      { contents: "rush", path: "rush.json" },
      { contents: "lock", path: "common/config/rush/pnpm-lock.yaml" },
    ],
    toolchainIdentity: "rush-workflow:sha256-abc123",
  });

  assert.deepStrictEqual(normalizeRushCacheSpec(left), {
    key_files: [
      { contents: "lock", path: "common/config/rush/pnpm-lock.yaml" },
      { contents: "rush", path: "rush.json" },
    ],
    paths: ["common/temp/node_modules", "common/temp/pnpm-store"],
    toolchain_identity: "rush-workflow:sha256-abc123",
    version: "rush-delivery-rush-cache/v1:v1",
  });
  assert.equal(hashRushCacheSpec(left), hashRushCacheSpec(right));
  assert.match(rushCacheTag(left), /^sha256-[a-f0-9]+$/);
  assert.equal(
    rushCacheTag(left).length,
    "sha256-".length + RUSH_CACHE_HASH_LENGTH,
  );
});

test("changes the Rush cache hash when key file contents change", () => {
  const baseSpec = buildRushCacheSpec({
    config: {
      key_files: ["rush.json"],
      paths: ["common/temp/node_modules"],
      version: "v1",
    },
    keyFiles: [{ contents: "rush", path: "rush.json" }],
    toolchainIdentity: "rush-workflow:sha256-abc123",
  });
  const changedSpec = buildRushCacheSpec({
    config: {
      key_files: ["rush.json"],
      paths: ["common/temp/node_modules"],
      version: "v1",
    },
    keyFiles: [{ contents: "changed", path: "rush.json" }],
    toolchainIdentity: "rush-workflow:sha256-abc123",
  });

  assert.notEqual(hashRushCacheSpec(baseSpec), hashRushCacheSpec(changedSpec));
});

test("changes the Rush cache hash when cache paths change", () => {
  const baseSpec = buildRushCacheSpec({
    config: {
      key_files: ["rush.json"],
      paths: ["common/temp/node_modules"],
      version: "v1",
    },
    keyFiles: [{ contents: "rush", path: "rush.json" }],
    toolchainIdentity: "rush-workflow:sha256-abc123",
  });
  const changedSpec = buildRushCacheSpec({
    config: {
      key_files: ["rush.json"],
      paths: ["common/temp/node_modules", "common/temp/pnpm-store"],
      version: "v1",
    },
    keyFiles: [{ contents: "rush", path: "rush.json" }],
    toolchainIdentity: "rush-workflow:sha256-abc123",
  });

  assert.notEqual(hashRushCacheSpec(baseSpec), hashRushCacheSpec(changedSpec));
});

test("changes the Rush cache hash when toolchain identity changes", () => {
  const baseSpec = buildRushCacheSpec({
    config: {
      key_files: ["rush.json"],
      paths: ["common/temp/node_modules"],
      version: "v1",
    },
    keyFiles: [{ contents: "rush", path: "rush.json" }],
    toolchainIdentity: "rush-workflow:sha256-abc123",
  });
  const changedSpec = buildRushCacheSpec({
    config: {
      key_files: ["rush.json"],
      paths: ["common/temp/node_modules"],
      version: "v1",
    },
    keyFiles: [{ contents: "rush", path: "rush.json" }],
    toolchainIdentity: "rush-workflow:sha256-def456",
  });

  assert.notEqual(hashRushCacheSpec(baseSpec), hashRushCacheSpec(changedSpec));
});

test("builds a default GitHub Container Registry Rush cache reference", () => {
  const spec = buildRushCacheSpec({
    config: {
      key_files: ["rush.json"],
      paths: ["common/temp/node_modules"],
      version: "v1",
    },
    keyFiles: [{ contents: "rush", path: "rush.json" }],
    toolchainIdentity: "rush-workflow:sha256-abc123",
  });
  const reference = buildGithubRushCacheReference({
    repository: "BeltOrg/beltapp",
    tag: rushCacheTag(spec),
  });

  assert.deepStrictEqual(reference, {
    imagePath: "beltorg/beltapp/rush-delivery-caches/rush-install",
    reference: `ghcr.io/beltorg/beltapp/rush-delivery-caches/rush-install:${rushCacheTag(spec)}`,
    registry: "ghcr.io",
    repository: "beltorg/beltapp",
    tag: rushCacheTag(spec),
  });
});

test("fails when GitHub Rush cache repository is not owner/repo", () => {
  assert.throws(
    () =>
      buildGithubRushCacheReference({
        repository: "beltapp",
        tag: "sha256-abc123",
      }),
    /must use owner\/repo form/,
  );
});

test("builds Rush cache archive and restore commands", () => {
  assert.equal(
    buildRushCacheArchiveCommand([
      "common/temp/node_modules",
      "common/temp/pnpm-store",
    ]),
    "set -euo pipefail && tar -C '/workspace' -cf - 'common/temp/node_modules' 'common/temp/pnpm-store' | gzip -9 > '/tmp/rush-cache.tar.gz'",
  );
  assert.equal(
    buildRushCacheRestoreCommand(),
    "set -euo pipefail && tar -xzf '/tmp/rush-cache.tar.gz' -C '/workspace'",
  );
});

test("fails when building a Rush cache archive command without paths", () => {
  assert.throws(
    () => buildRushCacheArchiveCommand([]),
    /requires at least one path/,
  );
});

test("builds a GitHub Rush cache resolve plan from provider metadata", () => {
  const providers = parseRushCacheProviders(`
cache:
  version: v1
  key_files:
    - rush.json
  paths:
    - common/temp/node_modules
providers:
  github:
    kind: github_container_registry
    repository_env: GITHUB_REPOSITORY
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
`);
  const spec = buildRushCacheSpec({
    config: providers.cache,
    keyFiles: [{ contents: "rush", path: "rush.json" }],
    toolchainIdentity: "rush-workflow:sha256-abc123",
  });
  const plan = buildGithubRushCacheResolvePlan(spec, providers, {
    GITHUB_ACTOR: "octocat",
    GITHUB_REPOSITORY: "BeltOrg/beltapp",
    GITHUB_TOKEN: "secret-token",
  });

  assert.deepStrictEqual(plan, {
    reference: {
      imagePath: "beltorg/beltapp/rush-delivery-caches/rush-install",
      reference: `ghcr.io/beltorg/beltapp/rush-delivery-caches/rush-install:${rushCacheTag(spec)}`,
      registry: "ghcr.io",
      repository: "beltorg/beltapp",
      tag: rushCacheTag(spec),
    },
    registryAuth: {
      address: "ghcr.io",
      token: "secret-token",
      tokenSecretName: `rush-cache-${hashRushCacheSpec(spec)}-github-token`,
      username: "octocat",
    },
  });
});

test("fails when GitHub Rush cache provider env is missing", () => {
  const providers = parseRushCacheProviders(`
cache:
  version: v1
  key_files:
    - rush.json
  paths:
    - common/temp/node_modules
providers:
  github:
    kind: github_container_registry
    repository_env: GITHUB_REPOSITORY
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
`);
  const spec = buildRushCacheSpec({
    config: providers.cache,
    keyFiles: [{ contents: "rush", path: "rush.json" }],
    toolchainIdentity: "rush-workflow:sha256-abc123",
  });

  assert.throws(
    () => buildGithubRushCacheResolvePlan(spec, providers, {}),
    /requires host env GITHUB_REPOSITORY/,
  );
});

test("detects missing Rush cache image errors without hiding auth failures", () => {
  assert.equal(
    isMissingRushCacheImageError(new Error("manifest unknown")),
    true,
  );
  assert.equal(
    isMissingRushCacheImageError(new Error("pull access denied")),
    false,
  );
});

test("parses supported Rush cache options", () => {
  assert.equal(parseRushCacheProvider("off"), "off");
  assert.equal(parseRushCacheProvider("github"), "github");
  assert.equal(parseRushCachePolicy("lazy"), "lazy");
});

test("rejects unsupported Rush cache options", () => {
  assert.throws(
    () => parseRushCacheProvider("gitlab"),
    /Unsupported Rush cache provider "gitlab"\./,
  );
  assert.throws(
    () => parseRushCachePolicy("prewarm"),
    /Unsupported Rush cache policy "prewarm"\./,
  );
});
