import * as assert from "node:assert/strict";
import { test } from "node:test";

import { parseDeployTarget } from "../src/stages/deploy/parse-deploy-target.ts";
import { buildGithubToolchainImageReference } from "../src/toolchain-images/github-reference.ts";
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
