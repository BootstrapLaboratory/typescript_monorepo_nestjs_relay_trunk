import * as assert from "node:assert/strict";
import { test } from "node:test";

import { parseDeployTarget } from "../src/stages/deploy/parse-deploy-target.ts";
import { buildGithubToolchainImageReference } from "../src/toolchain-images/github-reference.ts";
import {
  parseToolchainImagePolicy,
  parseToolchainImageProvider,
} from "../src/toolchain-images/options.ts";
import { parseToolchainImageProviders } from "../src/toolchain-images/parse-providers.ts";
import {
  isMissingToolchainImageError,
  resolveOffToolchainImage,
} from "../src/toolchain-images/resolve-plan.ts";
import {
  deployTargetToolchainImageSpec,
  hashToolchainImageSpec,
  normalizeToolchainImageSpec,
  toolchainImageName,
  toolchainImageTag,
  TOOLCHAIN_IMAGE_HASH_LENGTH,
  TOOLCHAIN_IMAGE_SPEC_VERSION,
} from "../src/toolchain-images/spec.ts";

test("builds a deploy executor toolchain spec from deploy runtime metadata", () => {
  const definition = parseDeployTarget(`
name: server
deploy_script: deploy/cloudrun/scripts/deploy-server.sh

runtime:
  image: node:24-bookworm-slim
  install:
    - apt-get update
    - apt-get install -y git
  pass_env:
    - GCP_PROJECT_ID
  env:
    GOOGLE_APPLICATION_CREDENTIALS: /tmp/gcp-credentials.json
  dry_run_defaults:
    GCP_PROJECT_ID: dry-run-project
  file_mounts:
    - source_var: GOOGLE_GHA_CREDS_PATH
      target: /tmp/gcp-credentials.json
`);

  assert.deepStrictEqual(deployTargetToolchainImageSpec(definition), {
    baseImage: "node:24-bookworm-slim",
    env: {},
    install: ["apt-get update", "apt-get install -y git"],
    kind: "deploy-executor",
    name: "server",
    version: TOOLCHAIN_IMAGE_SPEC_VERSION,
  });
});

test("normalizes toolchain specs for stable hashing", () => {
  const left = {
    baseImage: "node:24-bookworm-slim",
    env: {
      Z_VAR: "last",
      A_VAR: "first",
    },
    install: ["apt-get update"],
    kind: "deploy-executor" as const,
    name: "server",
    version: TOOLCHAIN_IMAGE_SPEC_VERSION,
  };
  const right = {
    ...left,
    env: {
      A_VAR: "first",
      Z_VAR: "last",
    },
  };

  assert.deepStrictEqual(normalizeToolchainImageSpec(left), {
    base_image: "node:24-bookworm-slim",
    env: {
      A_VAR: "first",
      Z_VAR: "last",
    },
    install: ["apt-get update"],
    kind: "deploy-executor",
    name: "server",
    version: TOOLCHAIN_IMAGE_SPEC_VERSION,
  });
  assert.equal(hashToolchainImageSpec(left), hashToolchainImageSpec(right));
});

test("changes the toolchain hash when install commands change", () => {
  const baseSpec = {
    baseImage: "node:24-bookworm-slim",
    env: {},
    install: ["apt-get update"],
    kind: "deploy-executor" as const,
    name: "webapp",
    version: TOOLCHAIN_IMAGE_SPEC_VERSION,
  };
  const changedSpec = {
    ...baseSpec,
    install: ["apt-get update", "apt-get install -y git"],
  };

  assert.notEqual(
    hashToolchainImageSpec(baseSpec),
    hashToolchainImageSpec(changedSpec),
  );
  assert.match(toolchainImageTag(baseSpec), /^sha256-[a-f0-9]+$/);
  assert.equal(
    toolchainImageTag(baseSpec).length,
    "sha256-".length + TOOLCHAIN_IMAGE_HASH_LENGTH,
  );
});

test("builds a default GitHub Container Registry toolchain image reference", () => {
  const spec = {
    baseImage: "node:24-bookworm-slim",
    env: {},
    install: ["apt-get update"],
    kind: "deploy-executor" as const,
    name: "server",
    version: TOOLCHAIN_IMAGE_SPEC_VERSION,
  };
  const reference = buildGithubToolchainImageReference({
    imageName: toolchainImageName(spec),
    repository: "BeltOrg/beltapp",
    tag: toolchainImageTag(spec),
  });

  assert.deepStrictEqual(reference, {
    imagePath: "beltorg/beltapp/rush-delivery-toolchains/deploy-server",
    reference: `ghcr.io/beltorg/beltapp/rush-delivery-toolchains/deploy-server:${toolchainImageTag(spec)}`,
    registry: "ghcr.io",
    repository: "beltorg/beltapp",
    tag: toolchainImageTag(spec),
  });
});

test("fails when GitHub toolchain image repository is not owner/repo", () => {
  assert.throws(
    () =>
      buildGithubToolchainImageReference({
        imageName: "deploy-server",
        repository: "beltapp",
        tag: "sha256-abc123",
      }),
    /must use owner\/repo form/,
  );
});

test("resolves provider off to the current base image and install commands", () => {
  const spec = {
    baseImage: "node:24-bookworm-slim",
    env: {},
    install: ["apt-get update", "apt-get install -y git"],
    kind: "deploy-executor" as const,
    name: "webapp",
    version: TOOLCHAIN_IMAGE_SPEC_VERSION,
  };

  assert.deepStrictEqual(resolveOffToolchainImage(spec), {
    image: "node:24-bookworm-slim",
    install: ["apt-get update", "apt-get install -y git"],
    prebuilt: false,
    provider: "off",
  });
});

test("parses GitHub toolchain image provider metadata", () => {
  const providers = parseToolchainImageProviders(`
providers:
  github:
    kind: github_container_registry
    registry: ghcr.io
    image_namespace: custom-toolchains
    repository_env: GITHUB_REPOSITORY
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
`);

  assert.deepStrictEqual(providers, {
    providers: {
      github: {
        image_namespace: "custom-toolchains",
        kind: "github_container_registry",
        registry: "ghcr.io",
        repository_env: "GITHUB_REPOSITORY",
        token_env: "GITHUB_TOKEN",
        username_env: "GITHUB_ACTOR",
      },
    },
  });
});

test("fills GitHub provider metadata defaults", () => {
  const providers = parseToolchainImageProviders(`
providers:
  github:
    kind: github_container_registry
    repository_env: GITHUB_REPOSITORY
    token_env: GITHUB_TOKEN
    username_env: GITHUB_ACTOR
`);

  assert.deepStrictEqual(providers.providers.github, {
    image_namespace: "rush-delivery-toolchains",
    kind: "github_container_registry",
    registry: "ghcr.io",
    repository_env: "GITHUB_REPOSITORY",
    token_env: "GITHUB_TOKEN",
    username_env: "GITHUB_ACTOR",
  });
});

test("fails when provider metadata contains unsupported providers", () => {
  assert.throws(
    () =>
      parseToolchainImageProviders(`
providers:
  gitlab:
    kind: gitlab_container_registry
`),
    /Toolchain image providers has unsupported field: gitlab\./,
  );
});

test("fails when GitHub provider env names are invalid", () => {
  assert.throws(
    () =>
      parseToolchainImageProviders(`
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

test("parses supported toolchain image options", () => {
  assert.equal(parseToolchainImageProvider("off"), "off");
  assert.equal(parseToolchainImageProvider("github"), "github");
  assert.equal(parseToolchainImagePolicy("lazy"), "lazy");
});

test("rejects unsupported toolchain image options", () => {
  assert.throws(
    () => parseToolchainImageProvider("gitlab"),
    /Unsupported toolchain image provider "gitlab"\./,
  );
  assert.throws(
    () => parseToolchainImagePolicy("prewarm"),
    /Unsupported toolchain image policy "prewarm"\./,
  );
});

test("detects missing image errors without treating auth failures as misses", () => {
  assert.equal(
    isMissingToolchainImageError(new Error("manifest unknown")),
    true,
  );
  assert.equal(
    isMissingToolchainImageError(new Error("pull access denied")),
    false,
  );
});
