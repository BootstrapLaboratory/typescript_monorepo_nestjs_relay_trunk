import * as assert from "node:assert/strict"
import { test } from "node:test"

import type { DeployRuntimeSpec } from "../src/model/deploy-target.ts"
import {
  getRequiredMountSource,
  getRequiredRepoFileMountSource,
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

test("accepts repository-relative file mount sources", () => {
  assert.equal(
    getRequiredRepoFileMountSource(
      {
        GOOGLE_GHA_CREDS_PATH: "./gha-creds.json",
      },
      "GOOGLE_GHA_CREDS_PATH",
      "server",
    ),
    "gha-creds.json",
  )
})

test("rejects absolute file mount sources for repo-mounted files", () => {
  assert.throws(
    () =>
      getRequiredRepoFileMountSource(
        {
          GOOGLE_GHA_CREDS_PATH: "/home/runner/work/app/gha-creds.json",
        },
        "GOOGLE_GHA_CREDS_PATH",
        "server",
      ),
    /repository-relative file path/,
  )
})

test("rejects parent-directory traversal in repo-mounted file sources", () => {
  assert.throws(
    () =>
      getRequiredRepoFileMountSource(
        {
          GOOGLE_GHA_CREDS_PATH: "../gha-creds.json",
        },
        "GOOGLE_GHA_CREDS_PATH",
        "server",
      ),
    /must stay within the repository/,
  )
})
