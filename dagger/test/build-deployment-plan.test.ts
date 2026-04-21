import * as assert from "node:assert/strict"
import { test } from "node:test"

import { buildDeploymentPlan } from "../src/planning/build-deployment-plan.ts"
import { parseReleaseTargets } from "../src/planning/parse-release-targets.ts"
import { parseServicesMesh } from "../src/planning/parse-services-mesh.ts"

test("plans a single selected target without its unselected dependency", () => {
  const mesh = parseServicesMesh(`
services:
  server:
    executor: deploy_server
    deploy_after: []
    deploy_script: scripts/ci/deploy-server.sh
    artifact_path: /workspace/common/deploy/server
  webapp:
    executor: deploy_webapp
    deploy_after:
      - server
    deploy_script: scripts/ci/deploy-webapp.sh
    artifact_path: /workspace/apps/webapp/dist
`)

  const plan = buildDeploymentPlan(mesh, parseReleaseTargets('["webapp"]'))

  assert.deepStrictEqual(plan, {
    selectedTargets: ["webapp"],
    waves: [[{ target: "webapp", executor: "deploy_webapp" }]],
  })
})

test("plans ordered waves when server and webapp are both selected", () => {
  const mesh = parseServicesMesh(`
services:
  server:
    executor: deploy_server
    deploy_after: []
    deploy_script: scripts/ci/deploy-server.sh
    artifact_path: /workspace/common/deploy/server
  webapp:
    executor: deploy_webapp
    deploy_after:
      - server
    deploy_script: scripts/ci/deploy-webapp.sh
    artifact_path: /workspace/apps/webapp/dist
`)

  const plan = buildDeploymentPlan(mesh, parseReleaseTargets('["server","webapp"]'))

  assert.deepStrictEqual(plan, {
    selectedTargets: ["server", "webapp"],
    waves: [
      [{ target: "server", executor: "deploy_server" }],
      [{ target: "webapp", executor: "deploy_webapp" }],
    ],
  })
})

test("plans a future parallel wave after server", () => {
  const mesh = parseServicesMesh(`
services:
  server:
    executor: deploy_server
    deploy_after: []
    deploy_script: scripts/ci/deploy-server.sh
    artifact_path: /workspace/common/deploy/server
  webapp:
    executor: deploy_webapp
    deploy_after:
      - server
    deploy_script: scripts/ci/deploy-webapp.sh
    artifact_path: /workspace/apps/webapp/dist
  mobile:
    executor: deploy_mobile
    deploy_after:
      - server
    deploy_script: scripts/ci/deploy-mobile.sh
    artifact_path: /workspace/apps/mobile/dist
`)

  const plan = buildDeploymentPlan(mesh, parseReleaseTargets('["server","webapp","mobile"]'))

  assert.deepStrictEqual(plan, {
    selectedTargets: ["server", "webapp", "mobile"],
    waves: [
      [{ target: "server", executor: "deploy_server" }],
      [
        { target: "mobile", executor: "deploy_mobile" },
        { target: "webapp", executor: "deploy_webapp" },
      ],
    ],
  })
})

test("fails when a selected target is not present in the services mesh", () => {
  const mesh = parseServicesMesh(`
services:
  server:
    executor: deploy_server
    deploy_after: []
    deploy_script: scripts/ci/deploy-server.sh
    artifact_path: /workspace/common/deploy/server
`)

  assert.throws(
    () => buildDeploymentPlan(mesh, parseReleaseTargets('["webapp"]')),
    /Unknown release target "webapp" in services mesh\./,
  )
})

test("fails when a selected target depends on an unknown service", () => {
  const mesh = parseServicesMesh(`
services:
  server:
    executor: deploy_server
    deploy_after:
      - database
    deploy_script: scripts/ci/deploy-server.sh
    artifact_path: /workspace/common/deploy/server
`)

  assert.throws(
    () => buildDeploymentPlan(mesh, parseReleaseTargets('["server"]')),
    /Unknown dependency "database" referenced by "server"\./,
  )
})

test("fails on cycles in the selected deploy graph", () => {
  const mesh = parseServicesMesh(`
services:
  server:
    executor: deploy_server
    deploy_after:
      - webapp
    deploy_script: scripts/ci/deploy-server.sh
    artifact_path: /workspace/common/deploy/server
  webapp:
    executor: deploy_webapp
    deploy_after:
      - server
    deploy_script: scripts/ci/deploy-webapp.sh
    artifact_path: /workspace/apps/webapp/dist
`)

  assert.throws(
    () => buildDeploymentPlan(mesh, parseReleaseTargets('["server","webapp"]')),
    /Cycle detected in services mesh deploy_after graph\./,
  )
})
