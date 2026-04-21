import * as assert from "node:assert/strict"
import { test } from "node:test"

import { parseServicesMesh } from "../src/planning/parse-services-mesh.ts"

test("parses service metadata and normalizes duplicate dependencies", () => {
  const mesh = parseServicesMesh(`
services:
  webapp:
    executor: deploy_webapp
    deploy_after:
      - server
      - server
    deploy_script: scripts/ci/deploy-webapp.sh
    artifact_path: /workspace/apps/webapp/dist
`)

  assert.deepStrictEqual(mesh, {
    services: {
      webapp: {
        executor: "deploy_webapp",
        deploy_after: ["server"],
        deploy_script: "scripts/ci/deploy-webapp.sh",
        artifact_path: "/workspace/apps/webapp/dist",
      },
    },
  })
})

test("fails when the services mesh does not define a top-level services mapping", () => {
  assert.throws(
    () => parseServicesMesh("foo: bar\n"),
    /services-mesh\.yaml must define a top-level services mapping\./,
  )
})

test("fails when a service is missing its executor", () => {
  assert.throws(
    () =>
      parseServicesMesh(`
services:
  server:
    deploy_after: []
    deploy_script: scripts/ci/deploy-server.sh
    artifact_path: /workspace/common/deploy/server
`),
    /Service mesh executor for "server" must be a non-empty string\./,
  )
})

test("fails when a service is missing its deploy_script", () => {
  assert.throws(
    () =>
      parseServicesMesh(`
services:
  server:
    executor: deploy_server
    deploy_after: []
    artifact_path: /workspace/common/deploy/server
`),
    /Service mesh deploy_script for "server" must be a non-empty string\./,
  )
})

test("fails when a service is missing its artifact_path", () => {
  assert.throws(
    () =>
      parseServicesMesh(`
services:
  server:
    executor: deploy_server
    deploy_after: []
    deploy_script: scripts/ci/deploy-server.sh
`),
    /Service mesh artifact_path for "server" must be a non-empty string\./,
  )
})

test("fails when deploy_after is not an array", () => {
  assert.throws(
    () =>
      parseServicesMesh(`
services:
  server:
    executor: deploy_server
    deploy_after: webapp
    deploy_script: scripts/ci/deploy-server.sh
    artifact_path: /workspace/common/deploy/server
`),
    /Service mesh deploy_after for "server" must be an array\./,
  )
})
