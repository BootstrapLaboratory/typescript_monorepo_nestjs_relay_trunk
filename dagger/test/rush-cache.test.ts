import * as assert from "node:assert/strict";
import { test } from "node:test";

import { parseRushCacheProviders } from "../src/rush-cache/parse-providers.ts";

test("parses GitHub Rush cache provider metadata", () => {
  const providers = parseRushCacheProviders(`
cache:
  version: v1
  key_files:
    - rush.json
    - common/config/rush/pnpm-lock.yaml
  paths:
    - /rush-cache/temp
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
      paths: ["/rush-cache/temp"],
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
    - /rush-cache/temp
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
    - /rush-cache/temp
providers: {}
`),
    /key_files\[0\] must be a repository-relative path/,
  );
});

test("fails when Rush cache paths are inside the workspace", () => {
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
    /paths\[0\] must stay outside \/workspace/,
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
    - /rush-cache/temp
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
    - /rush-cache/temp
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
