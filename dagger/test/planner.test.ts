import * as assert from "node:assert/strict"
import { test } from "node:test"

import { buildDeploymentPlan, parseReleaseTargets, parseServicesMesh } from "../src/planner.ts"

test("plans a single selected target without its unselected dependency", () => {
  const mesh = parseServicesMesh(`
services:
  server:
    executor: server
    deploy_after: []
  webapp:
    executor: webapp
    deploy_after:
      - server
`)

  const plan = buildDeploymentPlan(mesh, parseReleaseTargets('["webapp"]'))

  assert.deepStrictEqual(plan, {
    selectedTargets: ["webapp"],
    waves: [[{ target: "webapp", executor: "webapp" }]],
  })
})

test("plans ordered waves when server and webapp are both selected", () => {
  const mesh = parseServicesMesh(`
services:
  server:
    executor: server
    deploy_after: []
  webapp:
    executor: webapp
    deploy_after:
      - server
`)

  const plan = buildDeploymentPlan(mesh, parseReleaseTargets('["server","webapp"]'))

  assert.deepStrictEqual(plan, {
    selectedTargets: ["server", "webapp"],
    waves: [
      [{ target: "server", executor: "server" }],
      [{ target: "webapp", executor: "webapp" }],
    ],
  })
})

test("plans a future parallel wave after server", () => {
  const mesh = parseServicesMesh(`
services:
  server:
    executor: server
    deploy_after: []
  webapp:
    executor: webapp
    deploy_after:
      - server
  mobile:
    executor: mobile
    deploy_after:
      - server
`)

  const plan = buildDeploymentPlan(mesh, parseReleaseTargets('["server","webapp","mobile"]'))

  assert.deepStrictEqual(plan, {
    selectedTargets: ["server", "webapp", "mobile"],
    waves: [
      [{ target: "server", executor: "server" }],
      [
        { target: "mobile", executor: "mobile" },
        { target: "webapp", executor: "webapp" },
      ],
    ],
  })
})

test("fails on cycles in the selected deploy graph", () => {
  const mesh = parseServicesMesh(`
services:
  server:
    executor: server
    deploy_after:
      - webapp
  webapp:
    executor: webapp
    deploy_after:
      - server
`)

  assert.throws(
    () => buildDeploymentPlan(mesh, parseReleaseTargets('["server","webapp"]')),
    /Cycle detected in services mesh deploy_after graph\./,
  )
})
