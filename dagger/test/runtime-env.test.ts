import * as assert from "node:assert/strict"
import { test } from "node:test"

import type { DeployRuntimeSpec } from "../src/model/deploy-target.ts"
import {
  getRequiredMountSource,
  getRequiredRepoRelativeHostPathSource,
  parseDeployEnvFile,
  resolveSpecEnvironment,
  validateRequiredHostEnv,
} from "../src/deploy/runtime-env.ts"

const webappLikeSpec: DeployRuntimeSpec = {
  dry_run_defaults: {
    CLOUDFLARE_PAGES_PROJECT_NAME: "webapp",
    WEBAPP_URL: "https://webapp.pages.dev",
  },
  env: {
    STATIC_ENV: "always",
  },
  file_mounts: [],
  image: "node:24-bookworm-slim",
  install: [],
  pass_env: [
    "CLOUDFLARE_PAGES_PROJECT_NAME",
    "WEBAPP_URL",
  ],
  required_host_env: ["REQUIRED_ONLY_IN_LIVE_RUN"],
  socket_mounts: [],
}

test("parses a flat deploy env file into a host env map", () => {
  const parsedEnv = parseDeployEnvFile(`
    # comment
    CLOUDFLARE_PAGES_PROJECT_NAME=beltapp
    WEBAPP_URL=https://beltapp.pages.dev
  `)

  assert.deepEqual(parsedEnv, {
    CLOUDFLARE_PAGES_PROJECT_NAME: "beltapp",
    WEBAPP_URL: "https://beltapp.pages.dev",
  })
})

test("resolves pass-through env from host env and static env values", () => {
  const resolvedEnv = resolveSpecEnvironment(
    webappLikeSpec,
    {
      CLOUDFLARE_PAGES_PROJECT_NAME: "beltapp",
      WEBAPP_URL: "https://beltapp.pages.dev",
    },
    false,
    "webapp",
  )

  assert.deepEqual(resolvedEnv, {
    CLOUDFLARE_PAGES_PROJECT_NAME: "beltapp",
    STATIC_ENV: "always",
    WEBAPP_URL: "https://beltapp.pages.dev",
  })
})

test("uses dry-run defaults for missing pass-through env values", () => {
  const resolvedEnv = resolveSpecEnvironment(webappLikeSpec, {}, true, "webapp")

  assert.deepEqual(resolvedEnv, {
    CLOUDFLARE_PAGES_PROJECT_NAME: "webapp",
    STATIC_ENV: "always",
    WEBAPP_URL: "https://webapp.pages.dev",
  })
})

test("fails in a live runtime when a required pass-through env value is missing", () => {
  assert.throws(
    () =>
      resolveSpecEnvironment(
        webappLikeSpec,
        {
          CLOUDFLARE_PAGES_PROJECT_NAME: "beltapp",
        },
        false,
        "webapp",
      ),
    /WEBAPP_URL/,
  )
})

test("required host env validation only applies to live runs", () => {
  assert.doesNotThrow(() => validateRequiredHostEnv(webappLikeSpec, {}, true, "webapp"))
  assert.throws(
    () => validateRequiredHostEnv(webappLikeSpec, {}, false, "webapp"),
    /REQUIRED_ONLY_IN_LIVE_RUN/,
  )
})

test("fails in a live runtime when a required mount source env value is missing", () => {
  assert.throws(
    () => getRequiredMountSource({}, "GOOGLE_GHA_CREDS_PATH", "server"),
    /GOOGLE_GHA_CREDS_PATH/,
  )
})

test("normalizes a workspace-backed mount source under hostWorkspaceDir to a repo-relative path", () => {
  assert.equal(
    getRequiredRepoRelativeHostPathSource(
      {
        GOOGLE_GHA_CREDS_PATH: "/home/runner/work/beltapp/beltapp/gha-creds.json",
      },
      "GOOGLE_GHA_CREDS_PATH",
      "server",
      "/home/runner/work/beltapp/beltapp",
    ),
    "gha-creds.json",
  )
})

test("keeps an already repo-relative file mount source unchanged", () => {
  assert.equal(
    getRequiredRepoRelativeHostPathSource(
      {
        GOOGLE_GHA_CREDS_PATH: "./secrets/gha-creds.json",
      },
      "GOOGLE_GHA_CREDS_PATH",
      "server",
      "/home/runner/work/beltapp/beltapp",
    ),
    "secrets/gha-creds.json",
  )
})

test("fails when an absolute workspace-backed mount source is outside hostWorkspaceDir", () => {
  assert.throws(
    () =>
      getRequiredRepoRelativeHostPathSource(
        {
          GOOGLE_GHA_CREDS_PATH: "/tmp/gha-creds.json",
        },
        "GOOGLE_GHA_CREDS_PATH",
        "server",
        "/home/runner/work/beltapp/beltapp",
      ),
    /hostWorkspaceDir/,
  )
})

test("fails when an absolute workspace-backed mount source is provided without hostWorkspaceDir", () => {
  assert.throws(
    () =>
      getRequiredRepoRelativeHostPathSource(
        {
          GOOGLE_GHA_CREDS_PATH: "/home/runner/work/beltapp/beltapp/gha-creds.json",
        },
        "GOOGLE_GHA_CREDS_PATH",
        "server",
      ),
    /hostWorkspaceDir/,
  )
})

test("normalizes a workspace-backed socket source under hostWorkspaceDir to a repo-relative path", () => {
  assert.equal(
    getRequiredRepoRelativeHostPathSource(
      {
        DOCKER_SOCKET_FILE: "/home/runner/work/beltapp/beltapp/.dagger/runtime/docker.sock",
      },
      "DOCKER_SOCKET_FILE",
      "server",
      "/home/runner/work/beltapp/beltapp",
    ),
    ".dagger/runtime/docker.sock",
  )
})
