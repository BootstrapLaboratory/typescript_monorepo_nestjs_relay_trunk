import * as assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import * as path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { getDeployExecutor } from "../src/deploy/executors/registry.ts"
import { parseServicesMesh } from "../src/planning/parse-services-mesh.ts"

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(testDirectory, "../..")
const servicesMeshPath = path.join(repoRoot, "deploy/services-mesh.yaml")

async function readRealServicesMesh() {
  return parseServicesMesh(await readFile(servicesMeshPath, "utf8"))
}

test("loads every deploy executor referenced by the real services mesh", async () => {
  const mesh = await readRealServicesMesh()
  const executorNames = [...new Set(Object.values(mesh.services).map((service) => service.executor))].sort()

  const loadedExecutors = await Promise.all(
    executorNames.map(async (executorName) => ({
      executor: await getDeployExecutor(executorName),
      executorName,
    })),
  )

  for (const { executor, executorName } of loadedExecutors) {
    assert.equal(typeof executor.image, "string", `executor "${executorName}" must expose an image`)
    assert.notEqual(executor.image.length, 0, `executor "${executorName}" image must be non-empty`)
    assert.equal(typeof executor.buildEnvironment, "function", `executor "${executorName}" must expose buildEnvironment`)
  }
})

test("real services mesh deploy scripts exist on disk", async () => {
  const mesh = await readRealServicesMesh()

  await Promise.all(
    Object.entries(mesh.services).map(async ([target, service]) => {
      const deployScriptPath = path.resolve(repoRoot, service.deploy_script)
      await access(deployScriptPath)
      assert.ok(deployScriptPath.endsWith(service.deploy_script), `target "${target}" deploy script should resolve correctly`)
    }),
  )
})
